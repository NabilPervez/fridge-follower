import { addDays } from '../domain/dates';
import { guessCategory, isSlot, nameKey } from '../domain/constants';
import { matchItem, type ParsedRecipe } from '../domain/parse';
import { isLow, stepLevel } from '../domain/levels';
import { generateList } from '../domain/shopping';
import {
  db,
  newId,
  nowIso,
  type Consumes,
  type Item,
  type Level,
  type LevelEvent,
  type Location,
  type PlanEntry,
  type Recipe,
  type RecipeIngredient,
  type ShoppingItem,
  type Slot,
} from './db';
import { record, type Recorder } from './recorder';
import { SETTINGS_DEFAULTS, type SettingKey, type Settings } from './settings';

export class DuplicateItemError extends Error {
  existing: Item;
  constructor(existing: Item) {
    super(`Already have ${existing.name}`);
    this.existing = existing;
  }
}

// ---------- settings ----------

export async function setSetting<K extends SettingKey>(key: K, value: Settings[K], rec?: Recorder) {
  if (rec) await rec.put('settings', { key, value });
  else await db.settings.put({ key, value });
}

export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  const row = await db.settings.get(key);
  return (row?.value ?? SETTINGS_DEFAULTS[key]) as Settings[K];
}

const markStale = (rec: Recorder) => setSetting('shopStale', true, rec);

// ---------- items ----------

export function makeItem(name: string, location: Location, level: Level, extra: Partial<Item> = {}): Item {
  const now = nowIso();
  const clean = name.trim();
  return {
    id: newId(),
    name: clean,
    nameKey: nameKey(clean),
    location,
    category: guessCategory(clean),
    level,
    isStaple: false,
    lowThreshold: 'low',
    lastUpdated: now,
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

/** Callers must skip no-op changes themselves (see Recorder.remember). */
async function writeLevel(rec: Recorder, item: Item, to: Level, cause: LevelEvent['cause']) {
  const now = nowIso();
  await rec.update('items', item.id, { level: to, lastUpdated: now, updatedAt: now });
  await rec.put<LevelEvent>('levelEvents', { id: newId(), itemId: item.id, from: item.level, to, at: now, cause });
}

export async function setLevel(itemId: string, to: Level, cause: LevelEvent['cause'] = 'tap') {
  return record(async (rec) => {
    const item = await db.items.get(itemId);
    if (!item || item.level === to) return;
    await writeLevel(rec, item, to, cause);
    // Only crossing the low threshold can change the shopping list.
    if (isLow(item) !== isLow({ ...item, level: to })) await markStale(rec);
  });
}

/** dir 1 = lower, -1 = raise. Returns null if already at the end of the scale. */
export async function stepItem(item: Item, dir: 1 | -1) {
  const to = stepLevel(item.level, dir);
  if (!to) return null;
  const rec = await setLevel(item.id, to);
  return { rec, to };
}

export async function updateItem(itemId: string, changes: Partial<Pick<Item, 'location' | 'isStaple' | 'category'>>) {
  return record(async (rec) => {
    await rec.update('items', itemId, { ...changes, updatedAt: nowIso() });
    if ('isStaple' in changes) await markStale(rec);
  });
}

export async function findItemByName(name: string) {
  return db.items.where('nameKey').equals(nameKey(name)).first();
}

export async function addItem(name: string, location: Location, level: Level) {
  const existing = await findItemByName(name);
  if (existing) throw new DuplicateItemError(existing);
  const item = makeItem(name, location, level);
  const rec = await record(async (r) => {
    await r.put('items', item);
    await markStale(r);
  });
  return { rec, item };
}

export async function deleteItem(itemId: string) {
  return record(async (rec) => {
    await rec.delete('items', itemId);
    const shop = await db.shopping.where('itemId').equals(itemId).toArray();
    await rec.bulkDelete(
      'shopping',
      shop.map((s) => s.id),
    );
    await markStale(rec);
  });
}

// ---------- plan ----------

export const planId = (date: string, slot: Slot) => `${date}|${slot}`;

export type PlanChoice = { recipe: Recipe } | { freeText: string } | null;

export async function setPlan(date: string, slot: Slot, choice: PlanChoice) {
  return record(async (rec) => {
    const id = planId(date, slot);
    if (!choice) {
      await rec.delete('plan', id);
    } else {
      const now = nowIso();
      const prev = await db.plan.get(id);
      const entry: PlanEntry = {
        id,
        date,
        slot,
        nameSnapshot: 'recipe' in choice ? choice.recipe.name : choice.freeText,
        servings: 'recipe' in choice ? choice.recipe.servings : 1,
        cooked: false,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
        ...('recipe' in choice ? { recipeId: choice.recipe.id } : { freeText: choice.freeText }),
      };
      await rec.put('plan', entry);
    }
    await markStale(rec);
  });
}

/** Toggle cooked; when turning on and `decrement` is set, lowers ingredients per their `consumes`. */
export async function toggleCooked(entryId: string, decrement: boolean) {
  let lowered = 0;
  let cooked = false;
  const rec = await record(async (r) => {
    const e = await db.plan.get(entryId);
    if (!e) return;
    cooked = !e.cooked;
    await r.update('plan', e.id, { cooked, updatedAt: nowIso() });
    if (cooked && decrement && e.recipeId) {
      const ings = await db.recipeIngredients.where('recipeId').equals(e.recipeId).toArray();
      for (const g of ings) {
        if (g.consumes === 'none') continue;
        const item = await db.items.get(g.itemId);
        if (!item) continue;
        const to = g.consumes === 'depletes' ? 'out' : (stepLevel(item.level, 1) ?? 'out');
        if (to === item.level) continue;
        await writeLevel(r, item, to, 'cooked');
        lowered++;
      }
    }
    await markStale(r);
  });
  return { rec, cooked, lowered };
}

export async function copyDay(from: string, to: string) {
  let n = 0;
  const rec = await record(async (r) => {
    const entries = await db.plan.where('date').equals(from).toArray();
    const now = nowIso();
    for (const e of entries) {
      await r.put<PlanEntry>('plan', { ...e, id: planId(to, e.slot), date: to, cooked: false, createdAt: now, updatedAt: now });
      n++;
    }
    if (n) await markStale(r);
  });
  return { rec, n };
}

/** Fill empty slots on `days` (from `today` on) with what was planned 7 days earlier. */
export async function copyLastWeek(days: string[], today: string) {
  let n = 0;
  const rec = await record(async (r) => {
    const now = nowIso();
    for (const d of days) {
      if (d < today) continue;
      const prevWeek = await db.plan.where('date').equals(addDays(d, -7)).toArray();
      for (const e of prevWeek) {
        const id = planId(d, e.slot);
        if (await db.plan.get(id)) continue;
        await r.put<PlanEntry>('plan', { ...e, id, date: d, cooked: false, createdAt: now, updatedAt: now });
        n++;
      }
    }
    if (n) await markStale(r);
  });
  return { rec, n };
}

export async function clearDay(date: string) {
  let n = 0;
  const rec = await record(async (r) => {
    const entries = await db.plan.where('date').equals(date).toArray();
    n = entries.length;
    await r.bulkDelete(
      'plan',
      entries.map((e) => e.id),
    );
    if (n) await markStale(r);
  });
  return { rec, n };
}

// ---------- recipes ----------

export interface DraftIngredient {
  key: string;
  itemId: string | null;
  newName?: string;
  qty: string;
  consumes: Consumes;
  /** Original imported text when it fuzzy-matched a differently named item. */
  matchedFrom?: string | null;
}

export interface RecipeDraft {
  id: string | null;
  name: string;
  slots: Slot[];
  prep: number;
  serv: number;
  ings: DraftIngredient[];
  steps: string[];
  favorite: boolean;
  /** Where an imported draft came from ("pasted text", a file name). */
  source: string | null;
}

export const blankDraft = (): RecipeDraft => ({
  id: null,
  name: '',
  slots: [],
  prep: 15,
  serv: 2,
  ings: [],
  steps: [''],
  favorite: false,
  source: null,
});

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function draftFromParsed(p: ParsedRecipe, source: string, items: Item[]): RecipeDraft {
  return {
    id: null,
    name: p.name,
    slots: (p.slots ?? []).filter(isSlot),
    prep: p.prep || 15,
    serv: p.serv || 2,
    favorite: false,
    source,
    steps: p.steps.length ? p.steps : [''],
    ings: p.ings.map((g) => {
      const m = matchItem(g.name, items);
      return {
        key: newId(),
        itemId: m?.id ?? null,
        newName: m ? undefined : capitalise(g.name),
        qty: g.qty,
        consumes: 'one-level' as Consumes,
        matchedFrom: m && nameKey(m.name) !== nameKey(g.name) ? g.name : null,
      };
    }),
  };
}

export async function draftFromRecipe(id: string): Promise<RecipeDraft | null> {
  const r = await db.recipes.get(id);
  if (!r) return null;
  const ings = await db.recipeIngredients.where('recipeId').equals(id).sortBy('position');
  return {
    id: r.id,
    name: r.name,
    slots: [...r.slots],
    prep: r.prepMinutes ?? 15,
    serv: r.servings,
    favorite: r.favorite,
    source: null,
    steps: r.steps.length ? [...r.steps] : [''],
    ings: ings.map((g) => ({ key: g.id, itemId: g.itemId, qty: g.qtyText ?? '', consumes: g.consumes })),
  };
}

/** Resolves draft ingredients to items, creating unknown ones in the Pantry as Out. */
async function resolveIngredient(rec: Recorder, g: { itemId: string | null; newName?: string }) {
  if (g.itemId) {
    const it = await db.items.get(g.itemId);
    if (it) return { item: it, created: false };
  }
  const name = (g.newName ?? '').trim();
  const existing = await findItemByName(name);
  if (existing) return { item: existing, created: false };
  const item = makeItem(name, 'pantry', 'out');
  await rec.put('items', item);
  return { item, created: true };
}

export async function saveRecipe(draft: RecipeDraft) {
  const id = draft.id ?? newId();
  let created = 0;
  const rec = await record(async (r) => {
    const now = nowIso();
    const prev = draft.id ? await db.recipes.get(draft.id) : undefined;
    const recipe: Recipe = {
      id,
      name: draft.name.trim(),
      slots: draft.slots.length ? draft.slots : ['dinner'],
      servings: draft.serv,
      prepMinutes: draft.prep,
      steps: draft.steps.map((s) => s.trim()).filter(Boolean),
      tags: prev?.tags ?? [],
      favorite: draft.favorite,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };
    await r.put('recipes', recipe);
    const old = await db.recipeIngredients.where('recipeId').equals(id).primaryKeys();
    await r.bulkDelete('recipeIngredients', old);
    let position = 0;
    for (const g of draft.ings) {
      const { item, created: c } = await resolveIngredient(r, g);
      if (c) created++;
      await r.put<RecipeIngredient>('recipeIngredients', {
        id: newId(),
        recipeId: id,
        itemId: item.id,
        nameSnapshot: item.name,
        qtyText: g.qty.trim() || undefined,
        consumes: g.consumes,
        optional: false,
        position: position++,
      });
    }
    // Planned entries follow a renamed recipe.
    const planned = await db.plan.where('recipeId').equals(id).toArray();
    for (const e of planned) if (e.nameSnapshot !== recipe.name) await r.update('plan', e.id, { nameSnapshot: recipe.name });
    await markStale(r);
  });
  return { rec, id, created };
}

/** Planned entries keep their snapshot name. */
export async function deleteRecipe(id: string) {
  return record(async (r) => {
    await r.delete('recipes', id);
    const ings = await db.recipeIngredients.where('recipeId').equals(id).primaryKeys();
    await r.bulkDelete('recipeIngredients', ings);
    await markStale(r);
  });
}

export async function toggleFavorite(id: string) {
  const r = await db.recipes.get(id);
  if (r) await db.recipes.update(id, { favorite: !r.favorite, updatedAt: nowIso() });
}

/** Bulk import without review: matches ingredients to inventory, creates the rest as Out. */
export async function importRecipes(list: ParsedRecipe[]) {
  return record(async (r) => {
    const now = nowIso();
    const items = await db.items.toArray();
    for (const p of list) {
      const id = newId();
      await r.put<Recipe>('recipes', {
        id,
        name: p.name,
        slots: (p.slots ?? []).filter(isSlot).length ? (p.slots ?? []).filter(isSlot) : ['dinner'],
        servings: p.serv,
        prepMinutes: p.prep,
        steps: p.steps,
        tags: [],
        favorite: false,
        createdAt: now,
        updatedAt: now,
      });
      let position = 0;
      for (const g of p.ings) {
        let item = matchItem(g.name, items);
        if (!item) {
          item = makeItem(capitalise(g.name), 'pantry', 'out');
          items.push(item);
          await r.put('items', item);
        }
        await r.put<RecipeIngredient>('recipeIngredients', {
          id: newId(),
          recipeId: id,
          itemId: item.id,
          nameSnapshot: item.name,
          qtyText: g.qty || undefined,
          consumes: 'one-level',
          optional: false,
          position: position++,
        });
      }
    }
    await markStale(r);
  });
}

// ---------- shopping ----------

export async function regenerateShopping(from: string) {
  let toBuy = 0;
  const rec = await record(async (r) => {
    const items = await db.items.toArray();
    const plan = await db.plan.where('date').between(from, addDays(from, 6), true, true).toArray();
    const ingredients = await db.recipeIngredients.toArray();
    const prev = await db.shopping.toArray();
    const next = generateList({ items, plan, ingredients, prev, listWeekStart: from, now: nowIso() });
    const keep = new Set(next.map((x) => x.id));
    await r.bulkDelete(
      'shopping',
      prev.filter((p) => !keep.has(p.id)).map((p) => p.id),
    );
    await r.bulkPut('shopping', next);
    await setSetting('shopStale', false, r);
    await setSetting('shopGeneratedFor', from, r);
    toBuy = next.filter((x) => !x.checked).length;
  });
  return { rec, toBuy };
}

/** Checking a linked row restocks the item to Full; unchecking puts the old level back. */
export async function toggleShopItem(id: string) {
  let checked = false;
  let restocked = false;
  const rec = await record(async (r) => {
    const x = await db.shopping.get(id);
    if (!x) return;
    const item = x.itemId ? await db.items.get(x.itemId) : undefined;
    checked = !x.checked;
    if (checked) {
      await r.update('shopping', id, { checked: true, prevLevel: item?.level, updatedAt: nowIso() });
      if (item && item.level !== 'full') {
        await writeLevel(r, item, 'full', 'shopping');
        restocked = true;
      }
    } else {
      await r.update('shopping', id, { checked: false, updatedAt: nowIso() });
      if (item && x.prevLevel && x.prevLevel !== item.level) await writeLevel(r, item, x.prevLevel, 'shopping');
    }
  });
  return { rec, checked, restocked };
}

export async function finishTrip() {
  let restocked = 0;
  const rec = await record(async (r) => {
    const done = (await db.shopping.toArray()).filter((x) => x.checked);
    restocked = done.filter((x) => x.itemId).length;
    await r.bulkDelete(
      'shopping',
      done.map((x) => x.id),
    );
  });
  return { rec, restocked };
}

export async function addManualShop(name: string, listWeekStart: string) {
  const clean = name.trim();
  const item = await findItemByName(clean);
  const now = nowIso();
  const row: ShoppingItem = {
    id: newId(),
    itemId: item?.id,
    name: item?.name ?? clean,
    category: item?.category ?? guessCategory(clean),
    source: 'manual',
    reasonRecipeIds: [],
    mayRunShort: false,
    checked: false,
    listWeekStart,
    createdAt: now,
    updatedAt: now,
  };
  return record(async (r) => {
    await r.put('shopping', row);
  });
}

// ---------- data management ----------

export async function resetAll() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}

import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  addItem,
  DuplicateItemError,
  regenerateShopping,
  saveRecipe,
  setLevel,
  setPlan,
  stepItem,
  toggleCooked,
  toggleShopItem,
  blankDraft,
  deleteRecipe,
  copyLastWeek,
  resetAll,
} from './actions';
import { buildBackup, restoreBackup, validateBackup } from './backup';
import { loadStarterPack } from './starter';

const TODAY = '2026-09-30';

beforeEach(async () => {
  await resetAll();
});

describe('inventory', () => {
  it('steps a level and logs a LevelEvent in the same action; undo reverts both', async () => {
    const { item } = await addItem('Milk', 'fridge', 'full');
    const r = await stepItem(item, 1);
    expect(r?.to).toBe('high');
    expect((await db.items.get(item.id))?.level).toBe('high');
    expect(await db.levelEvents.where('itemId').equals(item.id).count()).toBe(1);
    await r!.rec.undo();
    expect((await db.items.get(item.id))?.level).toBe('full');
    expect(await db.levelEvents.count()).toBe(0);
  });

  it('rejects duplicate names regardless of case and spacing', async () => {
    await addItem('Greek yogurt', 'fridge', 'full');
    await expect(addItem('  greek  YOGURT ', 'fridge', 'low')).rejects.toBeInstanceOf(DuplicateItemError);
  });

  it('returns null when stepping past the end of the scale', async () => {
    const { item } = await addItem('Salt', 'spice', 'out');
    expect(await stepItem(item, 1)).toBeNull();
  });
});

describe('recipes and plan', () => {
  it('creates unknown ingredients as Out in the pantry', async () => {
    const { id, created } = await saveRecipe({
      ...blankDraft(),
      name: 'Toast',
      ings: [{ key: 'k', itemId: null, newName: 'Bread', qty: '2', consumes: 'one-level' }],
    });
    expect(created).toBe(1);
    const bread = await db.items.where('nameKey').equals('bread').first();
    expect(bread).toMatchObject({ location: 'pantry', level: 'out' });
    expect(await db.recipeIngredients.where('recipeId').equals(id).count()).toBe(1);
  });

  it('keeps the snapshot name when a planned recipe is deleted', async () => {
    const { id } = await saveRecipe({ ...blankDraft(), name: 'Curry', ings: [{ key: 'k', itemId: null, newName: 'Rice', qty: '', consumes: 'none' }] });
    const recipe = (await db.recipes.get(id))!;
    await setPlan(TODAY, 'dinner', { recipe });
    await deleteRecipe(id);
    expect(await db.plan.get(`${TODAY}|dinner`)).toMatchObject({ nameSnapshot: 'Curry', recipeId: id });
  });

  it('cooking lowers one-level ingredients and depletes others', async () => {
    const { item: rice } = await addItem('Rice', 'pantry', 'full');
    const { item: salmon } = await addItem('Salmon', 'freezer', 'full');
    const { item: salt } = await addItem('Salt', 'spice', 'full');
    const { id } = await saveRecipe({
      ...blankDraft(),
      name: 'Bowl',
      ings: [
        { key: 'a', itemId: rice.id, qty: '', consumes: 'one-level' },
        { key: 'b', itemId: salmon.id, qty: '', consumes: 'depletes' },
        { key: 'c', itemId: salt.id, qty: '', consumes: 'none' },
      ],
    });
    await setPlan(TODAY, 'dinner', { recipe: (await db.recipes.get(id))! });
    const { lowered, cooked } = await toggleCooked(`${TODAY}|dinner`, true);
    expect(cooked).toBe(true);
    expect(lowered).toBe(2);
    expect((await db.items.get(rice.id))?.level).toBe('high');
    expect((await db.items.get(salmon.id))?.level).toBe('out');
    expect((await db.items.get(salt.id))?.level).toBe('full');
  });

  it('copies last week into empty slots only, from today on', async () => {
    const { item } = await addItem('Oats', 'pantry', 'full');
    const { id } = await saveRecipe({ ...blankDraft(), name: 'Oats', ings: [{ key: 'a', itemId: item.id, qty: '', consumes: 'none' }] });
    const r = (await db.recipes.get(id))!;
    await setPlan('2026-09-22', 'breakfast', { recipe: r }); // Tue last week
    await setPlan('2026-09-23', 'breakfast', { recipe: r }); // Wed last week
    await setPlan('2026-09-23', 'lunch', { freeText: 'Leftovers' });
    await setPlan(TODAY, 'lunch', { freeText: 'Eat out' }); // already filled
    const days = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
    const { n } = await copyLastWeek(days, TODAY);
    expect(n).toBe(1); // Tue is in the past; Wed lunch is taken
    expect(await db.plan.get(`${TODAY}|breakfast`)).toMatchObject({ recipeId: id, cooked: false });
    expect((await db.plan.get(`${TODAY}|lunch`))?.freeText).toBe('Eat out');
  });
});

describe('shopping', () => {
  it('check-off restocks to Full; undo restores level and unchecks', async () => {
    const { item } = await addItem('Bread', 'pantry', 'low');
    await db.items.update(item.id, { isStaple: true });
    await regenerateShopping(TODAY);
    const [row] = await db.shopping.toArray();
    expect(row).toMatchObject({ itemId: item.id, source: 'staple', checked: false });
    const { rec } = await toggleShopItem(row.id);
    expect((await db.items.get(item.id))?.level).toBe('full');
    expect((await db.shopping.get(row.id))?.checked).toBe(true);
    await rec.undo();
    expect((await db.items.get(item.id))?.level).toBe('low');
    expect((await db.shopping.get(row.id))?.checked).toBe(false);
  });

  it('only counts plan entries in the next 7 days', async () => {
    const { item } = await addItem('Eggs', 'fridge', 'out');
    const { id } = await saveRecipe({ ...blankDraft(), name: 'Omelette', ings: [{ key: 'a', itemId: item.id, qty: '', consumes: 'one-level' }] });
    await setPlan('2026-10-08', 'breakfast', { recipe: (await db.recipes.get(id))! });
    await regenerateShopping(TODAY);
    expect(await db.shopping.count()).toBe(0);
    await setPlan('2026-10-06', 'breakfast', { recipe: (await db.recipes.get(id))! });
    await regenerateShopping(TODAY);
    expect(await db.shopping.count()).toBe(1);
  });
});

describe('backup', () => {
  it('export → wipe → import restores identical record counts', async () => {
    await loadStarterPack(TODAY);
    await setLevel((await db.items.toCollection().first())!.id, 'low');
    await regenerateShopping(TODAY);
    const counts = async () => Object.fromEntries(await Promise.all(['items', 'recipes', 'recipeIngredients', 'plan', 'shopping'].map(async (t) => [t, await db.table(t).count()])));
    const before = await counts();
    const json = JSON.parse(JSON.stringify(await buildBackup()));
    await resetAll();
    expect((await counts()).items).toBe(0);
    await restoreBackup(validateBackup(json).backup, 'replace');
    expect(await counts()).toEqual(before);
  });

  it('rejects malformed files without touching data', async () => {
    await addItem('Milk', 'fridge', 'full');
    expect(() => validateBackup({ hello: 1 })).toThrow();
    expect(() => validateBackup({ schemaVersion: 1, items: 'nope' })).toThrow();
    expect(() => validateBackup({ schemaVersion: 1, items: [{ name: 'no id' }] })).toThrow();
    expect(await db.items.count()).toBe(1);
  });

  it('merge keeps the newer copy of a row', async () => {
    const { item } = await addItem('Milk', 'fridge', 'full');
    const backup = await buildBackup();
    (backup.items as { level: string; updatedAt: string }[])[0].level = 'low';
    (backup.items as { updatedAt: string }[])[0].updatedAt = '2000-01-01T00:00:00.000Z';
    await restoreBackup(backup, 'merge');
    expect((await db.items.get(item.id))?.level).toBe('full');
  });
});

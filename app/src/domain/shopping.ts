import type { Item, PlanEntry, RecipeIngredient, ShoppingItem } from '../data/db';
import { nameKey } from './constants';
import { isLow } from './levels';

export interface GenInput {
  items: Item[];
  /** Plan entries already limited to the shopping window. */
  plan: PlanEntry[];
  ingredients: RecipeIngredient[];
  /** The current list, so checked state and manual items survive. */
  prev: ShoppingItem[];
  listWeekStart: string;
  now: string;
}

/** An item at Med with this many planned uses is flagged "may run short". */
export const RUN_SHORT_USES = 3;

export const shopIdForItem = (itemId: string) => `shop:${itemId}`;
export const shopIdForMissing = (name: string) => `shop:missing:${nameKey(name)}`;

/**
 * PRD §5.5: everything the plan needs that is at/below its threshold (or missing
 * from inventory), plus low staples. Previously checked rows and manual rows are kept.
 */
export function generateList({ items, plan, ingredients, prev, listWeekStart, now }: GenInput): ShoppingItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const ingsByRecipe = new Map<string, RecipeIngredient[]>();
  for (const g of ingredients) {
    const arr = ingsByRecipe.get(g.recipeId) ?? [];
    arr.push(g);
    ingsByRecipe.set(g.recipeId, arr);
  }

  // key -> uses + recipe ids
  const need = new Map<string, { uses: number; recipes: Set<string>; name: string; itemId?: string }>();
  for (const e of plan) {
    if (!e.recipeId || e.cooked) continue;
    for (const g of ingsByRecipe.get(e.recipeId) ?? []) {
      if (g.optional) continue;
      const item = byId.get(g.itemId);
      const key = item ? shopIdForItem(item.id) : shopIdForMissing(g.nameSnapshot);
      const n = need.get(key) ?? { uses: 0, recipes: new Set(), name: item?.name ?? g.nameSnapshot, itemId: item?.id };
      n.uses++;
      n.recipes.add(e.recipeId);
      need.set(key, n);
    }
  }

  const prevById = new Map(prev.map((p) => [p.id, p]));
  const out = new Map<string, ShoppingItem>();
  const push = (
    id: string,
    base: { itemId?: string; name: string; category: string },
    source: ShoppingItem['source'],
    recipes: string[],
    mayRunShort: boolean,
  ) => {
    const p = prevById.get(id);
    out.set(id, {
      id,
      ...base,
      source,
      reasonRecipeIds: recipes,
      mayRunShort,
      checked: p?.checked ?? false,
      prevLevel: p?.prevLevel,
      listWeekStart,
      createdAt: p?.createdAt ?? now,
      updatedAt: now,
    });
  };

  for (const [id, n] of need) {
    const item = n.itemId ? byId.get(n.itemId) : undefined;
    const recipes = [...n.recipes];
    if (!item) {
      push(id, { name: n.name, category: 'Other' }, 'plan', recipes, false);
    } else if (isLow(item)) {
      push(id, { itemId: item.id, name: item.name, category: item.category }, 'plan', recipes, false);
    } else if (item.level === 'med' && n.uses >= RUN_SHORT_USES) {
      push(id, { itemId: item.id, name: item.name, category: item.category }, 'plan', recipes, true);
    }
  }

  for (const item of items) {
    const id = shopIdForItem(item.id);
    if (item.isStaple && isLow(item) && !out.has(id)) {
      push(id, { itemId: item.id, name: item.name, category: item.category }, 'staple', [], false);
    }
  }

  // Keep what's already in the cart and anything added by hand.
  for (const p of prev) {
    if (out.has(p.id)) continue;
    if (p.source === 'manual' || p.checked) out.set(p.id, p);
  }

  return [...out.values()];
}

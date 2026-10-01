import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Item, type Recipe, type RecipeIngredient } from './db';
import { SETTINGS_DEFAULTS, type Settings } from './settings';
import { todayKey } from '../domain/dates';
import { LEVEL_RANK } from '../domain/constants';
import { isLow } from '../domain/levels';

export const useItems = () => useLiveQuery(() => db.items.toArray(), [], undefined);
export const useRecipes = () => useLiveQuery(() => db.recipes.toArray(), [], undefined);
export const useIngredients = () => useLiveQuery(() => db.recipeIngredients.toArray(), [], undefined);
export const usePlan = () => useLiveQuery(() => db.plan.toArray(), [], undefined);
export const useShopping = () => useLiveQuery(() => db.shopping.toArray(), [], undefined);

export function useSettings(): Settings {
  const rows = useLiveQuery(() => db.settings.toArray(), []);
  return useMemo(() => {
    const s = { ...SETTINGS_DEFAULTS } as Record<string, unknown>;
    for (const r of rows ?? []) s[r.key] = r.value;
    return s as unknown as Settings;
  }, [rows]);
}

/** Today's date key; rolls over at midnight and when the app returns to the foreground. */
export function useToday() {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const tick = () => setToday(todayKey());
    const t = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return today;
}

export type StockKind = 'ok' | 'low' | 'missing';
export interface Stock {
  kind: StockKind;
  color: string;
  text: string;
}

export const STOCK_COLOR: Record<StockKind, string> = { ok: '#3FD1A6', low: '#F0BE4E', missing: '#FF5A7E' };

/** All in stock / some low / missing (an Out or deleted ingredient). */
export function stockOf(ings: RecipeIngredient[], itemsById: Map<string, Item>): Stock {
  const missing = ings.filter((g) => {
    const it = itemsById.get(g.itemId);
    return !it || it.level === 'out';
  });
  if (missing.length) {
    const first = itemsById.get(missing[0].itemId)?.name ?? missing[0].nameSnapshot;
    return {
      kind: 'missing',
      color: STOCK_COLOR.missing,
      text: `Missing ${first.toLowerCase()}${missing.length > 1 ? ` +${missing.length - 1}` : ''}`,
    };
  }
  if (ings.some((g) => isLow(itemsById.get(g.itemId)!))) return { kind: 'low', color: STOCK_COLOR.low, text: 'Some low' };
  return { kind: 'ok', color: STOCK_COLOR.ok, text: 'All in stock' };
}

export interface Kitchen {
  items: Item[];
  recipes: Recipe[];
  ingredients: RecipeIngredient[];
  itemsById: Map<string, Item>;
  recipesById: Map<string, Recipe>;
  ingsByRecipe: Map<string, RecipeIngredient[]>;
  stock: (recipeId: string) => Stock;
  lowItems: Item[];
}

/** Items, recipes and ingredients with lookups. Undefined while loading. */
export function useKitchen(): Kitchen | undefined {
  const items = useItems();
  const recipes = useRecipes();
  const ingredients = useIngredients();
  return useMemo(() => {
    if (!items || !recipes || !ingredients) return undefined;
    const itemsById = new Map(items.map((i) => [i.id, i]));
    const recipesById = new Map(recipes.map((r) => [r.id, r]));
    const ingsByRecipe = new Map<string, RecipeIngredient[]>();
    for (const g of [...ingredients].sort((a, b) => a.position - b.position)) {
      const arr = ingsByRecipe.get(g.recipeId) ?? [];
      arr.push(g);
      ingsByRecipe.set(g.recipeId, arr);
    }
    const stockCache = new Map<string, Stock>();
    const stock = (id: string) => {
      let s = stockCache.get(id);
      if (!s) {
        s = stockOf(ingsByRecipe.get(id) ?? [], itemsById);
        stockCache.set(id, s);
      }
      return s;
    };
    const lowItems = items.filter(isLow).sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);
    return { items, recipes, ingredients, itemsById, recipesById, ingsByRecipe, stock, lowItems };
  }, [items, recipes, ingredients]);
}

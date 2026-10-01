import { describe, expect, it } from 'vitest';
import type { Item, Level, PlanEntry, RecipeIngredient, ShoppingItem } from '../data/db';
import { generateList, shopIdForItem } from './shopping';

const now = '2026-09-30T00:00:00.000Z';
const item = (id: string, level: Level, extra: Partial<Item> = {}): Item => ({
  id, name: id, nameKey: id, location: 'fridge', category: 'Dairy', level, isStaple: false, lowThreshold: 'low',
  lastUpdated: now, createdAt: now, updatedAt: now, ...extra,
});
const ing = (recipeId: string, itemId: string, extra: Partial<RecipeIngredient> = {}): RecipeIngredient => ({
  id: `${recipeId}-${itemId}`, recipeId, itemId, nameSnapshot: itemId, consumes: 'one-level', optional: false, position: 0, ...extra,
});
const entry = (date: string, recipeId: string, extra: Partial<PlanEntry> = {}): PlanEntry => ({
  id: `${date}|dinner`, date, slot: 'dinner', recipeId, nameSnapshot: recipeId, servings: 1, cooked: false, createdAt: now, updatedAt: now, ...extra,
});
const gen = (items: Item[], plan: PlanEntry[], ingredients: RecipeIngredient[], prev: ShoppingItem[] = []) =>
  generateList({ items, plan, ingredients, prev, listWeekStart: '2026-09-30', now });

describe('generateList', () => {
  it('excludes in-stock items and includes low ones', () => {
    const out = gen([item('milk', 'high'), item('yogurt', 'low')], [entry('2026-09-30', 'r1')], [ing('r1', 'milk'), ing('r1', 'yogurt')]);
    expect(out.map((x) => x.itemId)).toEqual(['yogurt']);
    expect(out[0]).toMatchObject({ source: 'plan', reasonRecipeIds: ['r1'] });
  });

  it('treats an ingredient whose item was deleted as Out', () => {
    const out = gen([], [entry('2026-09-30', 'r1')], [ing('r1', 'gone', { nameSnapshot: 'Saffron' })]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: 'Saffron', source: 'plan' });
    expect(out[0].itemId).toBeUndefined();
  });

  it('adds low staples even when nothing planned needs them', () => {
    const out = gen([item('bread', 'out', { isStaple: true }), item('oats', 'full', { isStaple: true })], [], []);
    expect(out.map((x) => [x.itemId, x.source])).toEqual([['bread', 'staple']]);
  });

  it('does not duplicate a staple that the plan also needs', () => {
    const out = gen([item('bread', 'low', { isStaple: true })], [entry('2026-09-30', 'r1'), entry('2026-10-01', 'r2')], [ing('r1', 'bread'), ing('r2', 'bread')]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ source: 'plan', reasonRecipeIds: ['r1', 'r2'] });
  });

  it('flags Med items with 3+ planned uses as may run short', () => {
    const plan = ['2026-09-30', '2026-10-01', '2026-10-02'].map((d) => entry(d, 'r1'));
    const out = gen([item('eggs', 'med')], plan, [ing('r1', 'eggs')]);
    expect(out).toHaveLength(1);
    expect(out[0].mayRunShort).toBe(true);
    expect(gen([item('eggs', 'med')], plan.slice(0, 2), [ing('r1', 'eggs')])).toHaveLength(0);
  });

  it('ignores cooked entries, free-text entries and optional ingredients', () => {
    const out = gen(
      [item('a', 'out'), item('b', 'out')],
      [entry('2026-09-30', 'r1', { cooked: true }), { ...entry('2026-10-01', 'x'), recipeId: undefined, freeText: 'Eat out' }, entry('2026-10-02', 'r2')],
      [ing('r1', 'a'), ing('r2', 'b', { optional: true })],
    );
    expect(out).toHaveLength(0);
  });

  it('keeps manual rows and checked rows across regeneration', () => {
    const manual: ShoppingItem = {
      id: 'm1', name: 'Candles', category: 'Household', source: 'manual', reasonRecipeIds: [], mayRunShort: false, checked: false, listWeekStart: '2026-09-28', createdAt: now, updatedAt: now,
    };
    const checked: ShoppingItem = { ...manual, id: shopIdForItem('milk'), itemId: 'milk', name: 'milk', source: 'plan', checked: true, prevLevel: 'low' };
    const out = gen([item('milk', 'full')], [], [], [manual, checked]);
    expect(out.map((x) => x.id).sort()).toEqual(['m1', shopIdForItem('milk')].sort());
    expect(out.find((x) => x.id === shopIdForItem('milk'))?.checked).toBe(true);
  });

  it('preserves checked state when an item is still needed', () => {
    const prev = gen([item('yogurt', 'low')], [entry('2026-09-30', 'r1')], [ing('r1', 'yogurt')]).map((x) => ({ ...x, checked: true }));
    const out = gen([item('yogurt', 'low')], [entry('2026-09-30', 'r1')], [ing('r1', 'yogurt')], prev);
    expect(out).toHaveLength(1);
    expect(out[0].checked).toBe(true);
  });
});

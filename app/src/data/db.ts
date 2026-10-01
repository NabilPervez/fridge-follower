import Dexie, { type Table } from 'dexie';

export type Level = 'full' | 'high' | 'med' | 'low' | 'out';
export type Slot = 'breakfast' | 'snack1' | 'lunch' | 'snack2' | 'dinner';
export type Location = 'fridge' | 'freezer' | 'pantry' | 'spice';
export type Consumes = 'none' | 'one-level' | 'depletes';

/** An inventory item. Also the ingredient master list. */
export interface Item {
  id: string;
  name: string;
  nameKey: string; // lowercased/trimmed for dedupe + search
  location: Location;
  category: string; // drives shopping aisle grouping
  level: Level;
  isStaple: boolean; // auto-add to shopping list when low/out
  lowThreshold: Level; // at/below this triggers shopping
  unitHint?: string; // display only
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

export interface Recipe {
  id: string;
  name: string;
  slots: Slot[];
  servings: number;
  prepMinutes?: number;
  steps: string[];
  tags: string[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  itemId: string;
  nameSnapshot: string; // survives item deletion
  qtyText?: string;
  consumes: Consumes;
  optional: boolean;
  position: number;
}

export interface PlanEntry {
  id: string;
  date: string; // local date "2026-09-28"
  slot: Slot;
  recipeId?: string;
  freeText?: string;
  nameSnapshot: string; // survives recipe deletion
  servings: number;
  cooked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingItem {
  id: string;
  itemId?: string;
  name: string;
  category: string;
  source: 'plan' | 'staple' | 'manual';
  reasonRecipeIds: string[];
  mayRunShort: boolean;
  checked: boolean;
  prevLevel?: Level; // level before check-off restocked it, for uncheck
  listWeekStart: string;
  createdAt: string;
  updatedAt: string;
}

export interface LevelEvent {
  id: string;
  itemId: string;
  from: Level;
  to: Level;
  at: string;
  cause: 'tap' | 'shopping' | 'cooked' | 'edit';
}

export interface Setting {
  key: string;
  value: unknown;
}

export class FridgeFollowerDB extends Dexie {
  items!: Table<Item, string>;
  recipes!: Table<Recipe, string>;
  recipeIngredients!: Table<RecipeIngredient, string>;
  plan!: Table<PlanEntry, string>;
  shopping!: Table<ShoppingItem, string>;
  levelEvents!: Table<LevelEvent, string>;
  settings!: Table<Setting, string>;

  constructor(name = 'fridge-follower') {
    super(name);
    this.version(1).stores({
      items: 'id, &nameKey, location, category, level, isStaple, updatedAt',
      recipes: 'id, name, *slots, *tags, favorite, updatedAt',
      recipeIngredients: 'id, recipeId, itemId, [recipeId+itemId]',
      plan: 'id, date, [date+slot], recipeId',
      shopping: 'id, listWeekStart, checked, category, itemId',
      levelEvents: 'id, itemId, at',
      settings: 'key',
    });
  }
}

export const db = new FridgeFollowerDB();

export const TABLES = [
  'items',
  'recipes',
  'recipeIngredients',
  'plan',
  'shopping',
  'levelEvents',
  'settings',
] as const;
export type TableName = (typeof TABLES)[number];

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

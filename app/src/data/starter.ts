import { addDays } from '../domain/dates';
import { nameKey } from '../domain/constants';
import { db, newId, nowIso, type Consumes, type Item, type Level, type Location, type PlanEntry, type Recipe, type RecipeIngredient, type Slot } from './db';
import { makeItem, planId } from './actions';
import { record } from './recorder';

/** The prototype's sample kitchen, offered as an optional starter pack. */
const ITEMS: [key: string, name: string, loc: Location, cat: string, level: Level, staple: boolean, unit?: string][] = [
  ['milk', 'Milk', 'fridge', 'Dairy', 'high', true, '2 L jug'],
  ['yogurt', 'Greek yogurt', 'fridge', 'Dairy', 'low', true, 'tub'],
  ['eggs', 'Eggs', 'fridge', 'Dairy', 'med', true, 'dozen'],
  ['cheddar', 'Cheddar', 'fridge', 'Dairy', 'full', false, 'block'],
  ['butter', 'Butter', 'fridge', 'Dairy', 'med', false],
  ['spinach', 'Baby spinach', 'fridge', 'Produce', 'low', false, 'bag'],
  ['apples', 'Apples', 'fridge', 'Produce', 'high', true],
  ['avocado', 'Avocados', 'fridge', 'Produce', 'out', false],
  ['lemons', 'Lemons', 'fridge', 'Produce', 'med', false],
  ['chicken', 'Chicken thighs', 'fridge', 'Meat', 'med', false, 'pack'],
  ['hummus', 'Hummus', 'fridge', 'Deli', 'med', false, 'tub'],
  ['salmon', 'Salmon fillets', 'freezer', 'Seafood', 'full', false],
  ['peas', 'Frozen peas', 'freezer', 'Frozen', 'high', false, 'bag'],
  ['berries', 'Mixed berries', 'freezer', 'Frozen', 'low', false, 'bag'],
  ['oats', 'Rolled oats', 'pantry', 'Grains', 'full', true],
  ['rice', 'Basmati rice', 'pantry', 'Grains', 'high', true],
  ['pasta', 'Spaghetti', 'pantry', 'Grains', 'out', false],
  ['tortillas', 'Tortillas', 'pantry', 'Bakery', 'med', false, 'pack'],
  ['bread', 'Sourdough', 'pantry', 'Bakery', 'low', true, 'loaf'],
  ['pb', 'Peanut butter', 'pantry', 'Spreads', 'high', false, 'jar'],
  ['chickpeas', 'Chickpeas', 'pantry', 'Canned', 'full', false, '2 cans'],
  ['cumin', 'Cumin', 'spice', 'Spices', 'high', false],
  ['paprika', 'Smoked paprika', 'spice', 'Spices', 'low', false],
  ['cinnamon', 'Cinnamon', 'spice', 'Spices', 'full', false],
];

type Ing = [item: string, qty: string, consumes: Consumes];
const RECIPES: [key: string, name: string, slots: Slot[], prep: number, serv: number, fav: boolean, ings: Ing[], steps: string[]][] = [
  ['r1', 'Overnight oats', ['breakfast'], 5, 1, true,
    [['oats', '½ cup', 'one-level'], ['milk', '½ cup', 'one-level'], ['yogurt', '¼ cup', 'one-level'], ['berries', 'handful', 'one-level']],
    ['Stir oats, milk and yogurt together in a jar.', 'Top with berries, cover, and refrigerate overnight.', 'Eat cold or warm for 60 seconds.']],
  ['r2', 'Spinach omelette', ['breakfast'], 10, 1, false,
    [['eggs', '3', 'one-level'], ['spinach', '1 cup', 'one-level'], ['cheddar', '¼ cup grated', 'none'], ['butter', '1 tsp', 'none']],
    ['Whisk eggs with a pinch of salt.', 'Wilt spinach in butter, pour in eggs.', 'Add cheddar, fold, and serve.']],
  ['r3', 'Avocado toast', ['breakfast', 'lunch'], 8, 1, false,
    [['bread', '2 slices', 'one-level'], ['avocado', '1', 'depletes'], ['eggs', '1', 'one-level'], ['lemons', 'squeeze', 'none']],
    ['Toast the bread.', 'Mash avocado with lemon and salt.', 'Spread, top with a fried egg.']],
  ['r4', 'Apple + PB', ['snack1', 'snack2'], 2, 1, true,
    [['apples', '1', 'one-level'], ['pb', '2 tbsp', 'none']],
    ['Slice the apple and dip.']],
  ['r5', 'Yogurt & berries', ['snack1', 'snack2'], 3, 1, false,
    [['yogurt', '¾ cup', 'one-level'], ['berries', '½ cup', 'one-level']],
    ['Spoon yogurt into a bowl and top with berries.']],
  ['r6', 'Hummus toast', ['snack1', 'snack2'], 4, 1, false,
    [['bread', '1 slice', 'none'], ['hummus', '3 tbsp', 'one-level'], ['paprika', 'pinch', 'none']],
    ['Toast, spread hummus, dust with paprika.']],
  ['r7', 'Chicken wrap', ['lunch'], 15, 2, true,
    [['chicken', '2 thighs', 'one-level'], ['tortillas', '2', 'one-level'], ['spinach', '1 cup', 'one-level'], ['cheddar', '⅓ cup', 'none'], ['paprika', '1 tsp', 'none']],
    ['Season chicken with paprika and pan-fry 6 min a side.', 'Slice and layer on tortillas with spinach and cheddar.', 'Roll tightly and toast seam-side down.']],
  ['r8', 'Chickpea curry', ['lunch', 'dinner'], 30, 4, false,
    [['chickpeas', '2 cans', 'depletes'], ['rice', '1½ cups', 'one-level'], ['spinach', '2 cups', 'one-level'], ['cumin', '2 tsp', 'none'], ['paprika', '1 tsp', 'none']],
    ['Start the rice.', 'Toast cumin and paprika in oil, add drained chickpeas and a splash of water.', 'Simmer 15 min, stir in spinach until wilted.', 'Serve over rice.']],
  ['r9', 'Salmon bowl', ['dinner'], 25, 2, true,
    [['salmon', '2 fillets', 'depletes'], ['rice', '1 cup', 'one-level'], ['avocado', '1', 'depletes'], ['lemons', '½', 'one-level']],
    ['Cook rice.', 'Roast salmon at 220°C for 12 min.', 'Build bowls with rice, flaked salmon, sliced avocado and lemon.']],
  ['r10', 'Lemon pasta with peas', ['dinner'], 20, 3, false,
    [['pasta', '300 g', 'depletes'], ['peas', '1 cup', 'one-level'], ['lemons', '1', 'one-level'], ['butter', '2 tbsp', 'one-level'], ['cheddar', '½ cup', 'none']],
    ['Boil pasta, adding peas for the last 2 min.', 'Toss with butter, lemon zest and juice, and cheese.', 'Loosen with pasta water.']],
];

/** A typical week, by recipe key, for slots breakfast → dinner. */
const WEEK: (string | null)[][] = [
  ['r1', 'r4', 'r7', null, 'r9'],
  ['r3', 'r5', 'r8', 'r4', 'r10'],
  ['r1', null, 'r7', null, 'Eat out'],
  ['r2', null, null, null, 'r8'],
];
const SLOT_ORDER: Slot[] = ['breakfast', 'snack1', 'lunch', 'snack2', 'dinner'];

/**
 * Adds the sample items and recipes, skipping items whose names already exist,
 * and fills empty plan slots for the next few days.
 */
export async function loadStarterPack(today: string) {
  const added = { items: 0, recipes: 0, meals: 0 };
  const rec = await record(async (r) => {
    const now = nowIso();
    const ids = new Map<string, Item>();
    for (const [key, name, loc, cat, level, staple, unit] of ITEMS) {
      const existing = await db.items.where('nameKey').equals(nameKey(name)).first();
      if (existing) {
        ids.set(key, existing);
        continue;
      }
      const item = makeItem(name, loc, level, { category: cat, isStaple: staple, unitHint: unit });
      await r.put('items', item);
      ids.set(key, item);
      added.items++;
    }
    const existingNames = new Set((await db.recipes.toArray()).map((x) => x.name.toLowerCase()));
    const recipeIds = new Map<string, Recipe>();
    for (const [key, name, slots, prep, serv, fav, ings, steps] of RECIPES) {
      if (existingNames.has(name.toLowerCase())) continue;
      const recipe: Recipe = { id: newId(), name, slots, servings: serv, prepMinutes: prep, steps, tags: [], favorite: fav, createdAt: now, updatedAt: now };
      await r.put('recipes', recipe);
      recipeIds.set(key, recipe);
      added.recipes++;
      let position = 0;
      for (const [ik, qty, consumes] of ings) {
        const item = ids.get(ik)!;
        await r.put<RecipeIngredient>('recipeIngredients', {
          id: newId(), recipeId: recipe.id, itemId: item.id, nameSnapshot: item.name, qtyText: qty, consumes, optional: false, position: position++,
        });
      }
    }
    for (let d = 0; d < WEEK.length; d++) {
      const date = addDays(today, d);
      for (let s = 0; s < 5; s++) {
        const v = WEEK[d][s];
        if (!v) continue;
        const id = planId(date, SLOT_ORDER[s]);
        if (await db.plan.get(id)) continue;
        const recipe = recipeIds.get(v);
        if (v.startsWith('r') && !recipe) continue;
        await r.put<PlanEntry>('plan', {
          id, date, slot: SLOT_ORDER[s],
          ...(recipe ? { recipeId: recipe.id } : { freeText: v }),
          nameSnapshot: recipe ? recipe.name : v,
          servings: recipe ? recipe.servings : 1,
          cooked: false, createdAt: now, updatedAt: now,
        });
        added.meals++;
      }
    }
    await r.put('settings', { key: 'shopStale', value: true });
  });
  return { rec, added };
}

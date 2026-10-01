import { describe, expect, it } from 'vitest';
import { matchItem, parseRecipeJson, parseRecipeText, SAMPLE_RECIPE, splitQty } from './parse';

describe('parseRecipeText', () => {
  it('reads the sample recipe', () => {
    const p = parseRecipeText(SAMPLE_RECIPE)!;
    expect(p.name).toBe('Shakshuka');
    expect(p.serv).toBe(2);
    expect(p.prep).toBe(25);
    expect(p.ings).toHaveLength(6);
    expect(p.ings[0]).toEqual({ qty: '4', name: 'eggs' });
    expect(p.ings[3]).toEqual({ qty: '2 tsp', name: 'smoked paprika' });
    expect(p.steps).toHaveLength(4);
    expect(p.steps[0]).toBe('Soften the onion in olive oil for 5 minutes.');
  });

  it('switches to steps at a numbered list without a Steps heading', () => {
    const p = parseRecipeText('Toast\nIngredients\n- 2 slices bread\n1. Toast it.\n2. Eat it.')!;
    expect(p.ings).toEqual([{ qty: '2 slices', name: 'bread' }]);
    expect(p.steps).toEqual(['Toast it.', 'Eat it.']);
  });

  it('returns null for empty text', () => {
    expect(parseRecipeText('  \n ')).toBeNull();
  });
});

describe('splitQty', () => {
  it('handles fractions and "of"', () => {
    expect(splitQty('½ cup of rolled oats')).toEqual({ qty: '½ cup', name: 'rolled oats' });
    expect(splitQty('salt')).toEqual({ qty: '', name: 'salt' });
  });
});

describe('matchItem', () => {
  const items = [{ name: 'Eggs' }, { name: 'Smoked paprika' }, { name: 'Baby spinach' }];
  it('matches plurals and partial names', () => {
    expect(matchItem('egg', items)?.name).toBe('Eggs');
    expect(matchItem('paprika', items)?.name).toBe('Smoked paprika');
    expect(matchItem('1 handful baby spinach', items)?.name).toBe('Baby spinach');
    expect(matchItem('saffron', items)).toBeNull();
  });
});

describe('parseRecipeJson', () => {
  it('accepts a single loose recipe', () => {
    const [r] = parseRecipeJson({ title: 'Soup', ingredients: ['2 cups stock', { name: 'Leek', qty: '1' }], instructions: 'Chop.\nSimmer.' });
    expect(r).toMatchObject({ name: 'Soup', steps: ['Chop.', 'Simmer.'] });
    expect(r.ings).toEqual([{ qty: '2 cups', name: 'stock' }, { name: 'Leek', qty: '1' }]);
  });

  it('reads recipes from our own backup format', () => {
    const list = parseRecipeJson({
      schemaVersion: 1,
      items: [{ id: 'i1', name: 'Rice' }],
      recipes: [{ id: 'r1', name: 'Rice bowl', slots: ['lunch'], servings: 2, steps: ['Cook.'] }],
      recipeIngredients: [{ id: 'g1', recipeId: 'r1', itemId: 'i1', nameSnapshot: 'Rice', qtyText: '1 cup' }],
    });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'Rice bowl', slots: ['lunch'], serv: 2, ings: [{ name: 'Rice', qty: '1 cup' }] });
  });
});

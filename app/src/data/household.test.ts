import { describe, it, expect } from 'vitest';
import { itemKey, mergeGroceries, toFridgeRows, type FtGrocery } from './household';

describe('Family Table household sync', () => {
  it('fridge rows use Family Table grocery keys', () => {
    const [r] = toFridgeRows([{ name: 'Baby Spinach!', level: 'high', updatedAt: '2026-11-07T10:00:00.000Z' }]);
    expect(r).toEqual({ table: 'fridge', row: { id: 'baby spinach', key: 'baby spinach', name: 'Baby Spinach!', level: 'high', updatedAt: Date.parse('2026-11-07T10:00:00.000Z') } });
    expect(itemKey('Tater-tots ')).toBe('tater tots');
  });
  it('grocery merge keeps the newest row and ignores other tables', () => {
    const g = (updatedAt: number, checked: boolean): FtGrocery => ({ id: '2026-11-07:pasta', weekStart: '2026-11-07', key: 'pasta', name: 'pasta', checked, updatedAt });
    let m = mergeGroceries({}, [{ table: 'groceryItems', row: g(5, false) }, { table: 'slots', row: g(9, true) }]);
    m = mergeGroceries(m, [{ table: 'groceryItems', row: g(3, true) }]);
    expect(m['2026-11-07:pasta'].checked).toBe(false);
    m = mergeGroceries(m, [{ table: 'groceryItems', row: g(7, true) }]);
    expect(m['2026-11-07:pasta'].checked).toBe(true);
  });
});

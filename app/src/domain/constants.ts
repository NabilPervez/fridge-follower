import type { Level, Location, Slot } from '../data/db';

export const LEVEL_RANK: Record<Level, number> = { out: 0, low: 1, med: 2, high: 3, full: 4 };
/** Highest to lowest; stepping "down" moves right. */
export const LEVELS: Level[] = ['full', 'high', 'med', 'low', 'out'];
export const LEVEL_NAME: Record<Level, string> = { full: 'Full', high: 'High', med: 'Med', low: 'Low', out: 'Out' };
/** Base jewel colour per level. */
export const LEVEL_BASE: Record<Level, string> = {
  full: '#0F9D76',
  high: '#2E5BDB',
  med: '#E3A21A',
  low: '#D6264F',
  out: '#D6264F',
};
/** Lighter tint used for text and glows. */
export const LEVEL_TINT: Record<Level, string> = {
  full: '#3FD1A6',
  high: '#9DB4FF',
  med: '#F0BE4E',
  low: '#FF7A95',
  out: '#FF7A95',
};

export type Jewel = 'emerald' | 'sapphire' | 'amethyst' | 'topaz' | 'ruby' | 'citrine';
/** [base, tint] */
export const JEWEL: Record<Jewel, [string, string]> = {
  emerald: ['#0F9D76', '#3FD1A6'],
  sapphire: ['#2E5BDB', '#9DB4FF'],
  amethyst: ['#8B3FD9', '#C9A4F5'],
  topaz: ['#E3A21A', '#F0BE4E'],
  ruby: ['#D6264F', '#FF7A95'],
  citrine: ['#F2D544', '#F2D544'],
};

export const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

export interface SlotDef {
  k: Slot;
  n: string;
  short: string;
  j: Jewel;
}
export const SLOTS: SlotDef[] = [
  { k: 'breakfast', n: 'Breakfast', short: 'Breakfast', j: 'citrine' },
  { k: 'snack1', n: 'Snack 1', short: 'Snack', j: 'emerald' },
  { k: 'lunch', n: 'Lunch', short: 'Lunch', j: 'sapphire' },
  { k: 'snack2', n: 'Snack 2', short: 'Snack', j: 'topaz' },
  { k: 'dinner', n: 'Dinner', short: 'Dinner', j: 'amethyst' },
];
export const slotOf = (k: Slot) => SLOTS.find((s) => s.k === k)!;
export const isSlot = (k: unknown): k is Slot => SLOTS.some((s) => s.k === k);

export interface LocDef {
  k: Location;
  n: string;
}
export const LOCS: LocDef[] = [
  { k: 'fridge', n: 'Fridge' },
  { k: 'freezer', n: 'Freezer' },
  { k: 'pantry', n: 'Pantry' },
  { k: 'spice', n: 'Spices' },
];
export const locOf = (k: Location) => LOCS.find((l) => l.k === k)!;

export const CATEGORIES = [
  'Produce',
  'Dairy',
  'Deli',
  'Meat',
  'Seafood',
  'Bakery',
  'Grains',
  'Canned',
  'Spreads',
  'Frozen',
  'Spices',
  'Household',
  'Other',
];

const KEYWORDS: Record<string, string> = {
  yogurt: 'Dairy', milk: 'Dairy', chees: 'Dairy', butter: 'Dairy', cream: 'Dairy', egg: 'Dairy',
  apple: 'Produce', banana: 'Produce', lettuce: 'Produce', spinach: 'Produce', tomato: 'Produce',
  onion: 'Produce', garlic: 'Produce', lemon: 'Produce', carrot: 'Produce', avocado: 'Produce',
  pepper: 'Produce', herb: 'Produce', cilantro: 'Produce',
  berr: 'Frozen', chicken: 'Meat', beef: 'Meat', turkey: 'Meat',
  salmon: 'Seafood', fish: 'Seafood', shrimp: 'Seafood',
  bread: 'Bakery', tortilla: 'Bakery', bagel: 'Bakery',
  rice: 'Grains', pasta: 'Grains', oat: 'Grains', flour: 'Grains',
  bean: 'Canned', chickpea: 'Canned', soup: 'Canned',
  salt: 'Spices', cumin: 'Spices', paprika: 'Spices', cinnamon: 'Spices',
  ice: 'Frozen', frozen: 'Frozen', peas: 'Frozen',
  peanut: 'Spreads', jam: 'Spreads', honey: 'Spreads', oil: 'Spreads',
  hummus: 'Deli', ham: 'Deli',
  candle: 'Household', soap: 'Household', foil: 'Household',
};

export function guessCategory(name: string): string {
  const n = name.toLowerCase();
  for (const k in KEYWORDS) if (n.includes(k)) return KEYWORDS[k];
  return 'Other';
}

export const nameKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

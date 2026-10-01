/** On-device recipe text parsing and ingredient-to-inventory matching. */

export interface ParsedIngredient {
  qty: string;
  name: string;
}
export interface ParsedRecipe {
  name: string;
  ings: ParsedIngredient[];
  steps: string[];
  serv: number;
  prep: number;
  slots?: string[];
}

/** Loose key for fuzzy matching: letters only, singularised. */
export const matchKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(es|s)$/, '');

export function matchItem<T extends { name: string }>(name: string, items: T[]): T | null {
  const n = matchKey(name);
  if (!n) return null;
  return (
    items.find((i) => matchKey(i.name) === n) ??
    items.find((i) => {
      const m = matchKey(i.name);
      return m.length > 2 && (n.includes(m) || m.includes(n));
    }) ??
    null
  );
}

const QTY_RE =
  /^((?:[\d½¼¾⅓⅔⅛./-]+\s*)+(?:(?:cups?|tbsp|tsp|tablespoons?|teaspoons?|g|kg|ml|l|oz|lbs?|cans?|cloves?|slices?|pinch|handful|bunch|fillets?|thighs?|tins?)\b\.?)?)\s*(?:of\s+)?(.+)$/i;

export function splitQty(line: string): ParsedIngredient {
  const m = line.match(QTY_RE);
  return m ? { qty: m[1].trim(), name: m[2].trim() } : { qty: '', name: line.trim() };
}

export function parseRecipeText(text: string): ParsedRecipe | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  const name = lines[0].replace(/^#+\s*/, '');
  let mode: 'ing' | 'step' = 'ing';
  let sawHeading = false;
  let serv = 2;
  let prep = 20;
  const ings: ParsedIngredient[] = [];
  const steps: string[] = [];

  for (const raw of lines.slice(1)) {
    const l = raw.replace(/^[-*•·]\s*/, '');
    if (/^ingredients?\s*:?$/i.test(l)) {
      mode = 'ing';
      sawHeading = true;
      continue;
    }
    if (/^(steps|method|directions|instructions|preparation)\s*:?$/i.test(l)) {
      mode = 'step';
      continue;
    }
    const sv = l.match(/serves\s*(\d+)|(\d+)\s*servings?/i);
    const pm = l.match(/(\d+)\s*(min|mins|minutes)\b/i);
    if (sv && l.length < 40) {
      serv = +(sv[1] || sv[2]);
      if (pm) prep = +pm[1];
      continue;
    }
    if (pm && l.length < 24 && mode === 'ing' && !ings.length) {
      prep = +pm[1];
      continue;
    }
    // A numbered list after ingredients without a heading is most likely the method.
    if (mode === 'ing' && sawHeading && /^\d+[.)]\s/.test(raw) && ings.length) mode = 'step';
    if (mode === 'ing') ings.push(splitQty(l));
    else steps.push(l.replace(/^\d+[.)]\s*/, ''));
  }
  return { name, ings, steps, serv, prep };
}

/** Accepts our own backup/recipe JSON plus common loose shapes. */
export function parseRecipeJson(data: unknown): ParsedRecipe[] {
  const obj = data as Record<string, unknown>;
  const list: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(obj?.recipes)
      ? (obj.recipes as unknown[])
      : [data];
  // Our own backup format stores ingredients in a separate table.
  const ingTable = Array.isArray(obj?.recipeIngredients)
    ? (obj.recipeIngredients as Record<string, unknown>[])
    : null;
  const itemTable = Array.isArray(obj?.items) ? (obj.items as Record<string, unknown>[]) : null;

  return list
    .map((x): ParsedRecipe | null => {
      if (!x || typeof x !== 'object') return null;
      const r = x as Record<string, unknown>;
      const name = String(r.name ?? r.title ?? '').trim();
      if (!name) return null;
      let rawIngs = (r.ingredients ?? r.ings ?? []) as unknown[];
      if (!Array.isArray(rawIngs)) rawIngs = [];
      if (!rawIngs.length && ingTable && r.id) {
        rawIngs = ingTable
          .filter((g) => g.recipeId === r.id)
          .map((g) => ({
            name: g.nameSnapshot ?? itemTable?.find((i) => i.id === g.itemId)?.name ?? '',
            qty: g.qtyText ?? '',
          }));
      }
      const ings = rawIngs
        .map((g) =>
          typeof g === 'string'
            ? splitQty(g)
            : {
                name: String((g as Record<string, unknown>).name ?? (g as Record<string, unknown>).item ?? ''),
                qty: String((g as Record<string, unknown>).qtyText ?? (g as Record<string, unknown>).qty ?? ''),
              },
        )
        .filter((g) => g.name.trim());
      const steps = Array.isArray(r.steps)
        ? r.steps.map(String)
        : String(r.steps ?? r.instructions ?? '')
            .split(/\n+/)
            .map((s) => s.trim())
            .filter(Boolean);
      return {
        name,
        ings,
        steps,
        serv: Number(r.servings ?? r.serv) || 2,
        prep: Number(r.prepMinutes ?? r.prep) || 15,
        slots: Array.isArray(r.slots) ? r.slots.map(String) : [],
      };
    })
    .filter((r): r is ParsedRecipe => !!r);
}

export const SAMPLE_RECIPE = `Shakshuka
Serves 2 · 25 min

Ingredients
- 4 eggs
- 1 can crushed tomatoes
- 1 onion
- 2 tsp smoked paprika
- 1 tsp cumin
- 1 handful baby spinach

Steps
1. Soften the onion in olive oil for 5 minutes.
2. Add paprika and cumin, then the tomatoes. Simmer 10 minutes.
3. Make wells, crack in the eggs, cover and cook until set.
4. Wilt in the spinach and serve with bread.`;

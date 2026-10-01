import type { PlanEntry } from '../data/db';
import type { Kitchen } from '../data/hooks';
import { toggleCooked } from '../data/actions';
import { SLOTS } from '../domain/constants';
import { toast, useUI, vibrate } from '../state/ui';
import { SlotCard } from '../ui/kit';

/** The five slot cards for one day; shared by Today and Plan. */
export function SlotList({
  date,
  kitchen,
  plan,
  cookDecrements,
}: {
  date: string;
  kitchen: Kitchen | undefined;
  plan: PlanEntry[] | undefined;
  cookDecrements: boolean;
}) {
  const openSheet = useUI((s) => s.openSheet);
  return (
    <>
      {SLOTS.map((sl) => {
        const e = plan?.find((x) => x.date === date && x.slot === sl.k);
        const recipe = e?.recipeId ? kitchen?.recipesById.get(e.recipeId) : undefined;
        const deleted = !!(e?.recipeId && kitchen && !recipe);
        const stock = recipe ? kitchen?.stock(recipe.id) : undefined;
        return (
          <SlotCard
            key={sl.k}
            slot={sl.k}
            jewel={sl.j}
            label={sl.n + (deleted ? ' · recipe deleted' : '')}
            title={e ? (recipe?.name ?? e.nameSnapshot) : null}
            muted={!!e?.freeText || deleted}
            cooked={e?.cooked}
            dot={stock?.color}
            onOpen={() => openSheet({ type: 'slot', date, slot: sl.k })}
            onToggleCook={async () => {
              if (!e) return;
              vibrate();
              const { rec, cooked, lowered } = await toggleCooked(e.id, cookDecrements);
              if (cooked) toast(lowered ? `Cooked · ${lowered} ingredient${lowered > 1 ? 's' : ''} lowered` : 'Marked cooked', rec.undo);
            }}
          />
        );
      })}
    </>
  );
}

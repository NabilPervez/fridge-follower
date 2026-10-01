import { useNavigate } from 'react-router';
import { CaretRight } from '@phosphor-icons/react';
import { useKitchen, usePlan, useShopping, useToday } from '../data/hooks';
import { addDays, dayInfo } from '../domain/dates';
import { LEVEL_NAME } from '../domain/constants';

/** "Why is this on my list?" — the planned recipes that need it. */
export function ReasonSheet({ shopId }: { shopId: string }) {
  const navigate = useNavigate();
  const shop = useShopping();
  const kitchen = useKitchen();
  const plan = usePlan();
  const today = useToday();
  const x = shop?.find((s) => s.id === shopId);
  if (!x || !kitchen) return null;
  const it = x.itemId ? kitchen.itemsById.get(x.itemId) : undefined;
  const end = addDays(today, 6);

  return (
    <div className="sheet__body" style={{ gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 4px' }}>
        <span className="sheet__title">{x.name}</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {it ? `Currently ${LEVEL_NAME[it.level]}` : 'Not in inventory'}
          {x.mayRunShort ? ' · may run short' : ''}
        </span>
      </div>
      <span className="section-label" style={{ padding: '4px 4px 0' }}>
        Needed for
      </span>
      <div className="list" style={{ background: 'var(--well-2)', borderRadius: 20 }}>
        {x.reasonRecipeIds.map((rid) => {
          const r = kitchen.recipesById.get(rid);
          const days = [
            ...new Set(
              (plan ?? [])
                .filter((e) => e.recipeId === rid && !e.cooked && e.date >= today && e.date <= end)
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((e) => dayInfo(e.date).dow),
            ),
          ];
          return (
            <button
              key={rid}
              type="button"
              className="set-row"
              style={{ cursor: r ? 'pointer' : 'default', paddingRight: 16 }}
              onClick={() => r && navigate(`/recipes/${rid}`)}
              disabled={!r}
            >
              <span className="set-row__text">
                <span>{r?.name ?? 'Recipe deleted'}</span>
                {days.length > 0 && <span className="set-row__sub" style={{ fontSize: 12 }}>Planned {days.join(', ')}</span>}
              </span>
              <CaretRight weight="bold" style={{ color: 'var(--text-dim)' }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

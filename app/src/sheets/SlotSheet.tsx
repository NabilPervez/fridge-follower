import { useState } from 'react';
import { Heart, MagnifyingGlass } from '@phosphor-icons/react';
import type { Slot } from '../data/db';
import { useKitchen, usePlan } from '../data/hooks';
import { planId, setPlan } from '../data/actions';
import { dayInfo } from '../domain/dates';
import { slotOf } from '../domain/constants';
import { toast, useUI } from '../state/ui';
import { StockDot } from '../ui/kit';
import { chipStyle } from '../ui/helpers';

export function SlotSheet({ date, slot }: { date: string; slot: Slot }) {
  const kitchen = useKitchen();
  const plan = usePlan();
  const close = useUI((s) => s.closeSheet);
  const entry = plan?.find((e) => e.id === planId(date, slot));
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'suited' | 'fav' | 'all'>('suited');
  const [free, setFree] = useState(entry?.freeText ?? '');
  const sl = slotOf(slot);
  const pq = q.trim().toLowerCase();

  const results = (kitchen?.recipes ?? [])
    .filter((r) => filter === 'all' || (filter === 'fav' ? r.favorite : r.slots.includes(slot)))
    .filter((r) => !pq || r.name.toLowerCase().includes(pq))
    .sort((a, b) => Number(b.slots.includes(slot)) - Number(a.slots.includes(slot)) || Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));

  const choose = async (choice: Parameters<typeof setPlan>[2], msg?: string) => {
    close();
    const rec = await setPlan(date, slot, choice);
    if (msg) toast(msg, rec.undo);
  };

  return (
    <>
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 16px 12px' }}>
        <div className="sheet__head">
          <span className="sheet__title">
            {sl.n} · {dayInfo(date).label}
          </span>
          {entry && (
            <button
              type="button"
              onClick={() => choose(null, `${sl.n} cleared`)}
              style={{ height: 36, padding: '0 12px', borderRadius: 12, border: 0, background: 'rgba(214,38,79,.18)', color: '#FF7A95', font: '600 13px var(--ui)', cursor: 'pointer', flex: '0 0 auto' }}
            >
              Clear slot
            </button>
          )}
        </div>
        <label className="search">
          <MagnifyingGlass weight="bold" />
          <span className="sr-only">Search recipes</span>
          <input autoFocus className="input input--well" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recipes" />
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(
            [
              ['suited', `Suited for ${sl.short.toLowerCase()}`],
              ['fav', 'Favorites'],
              ['all', 'All'],
            ] as const
          ).map(([k, n]) => (
            <button key={k} type="button" className="chip" aria-pressed={filter === k} style={{ ...chipStyle(filter === k), height: 34 }} onClick={() => setFilter(k)}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: '1 1 auto', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, padding: '0 16px 12px', minHeight: 0, scrollbarWidth: 'none' }}>
        {results.map((r) => {
          const st = kitchen!.stock(r.id);
          return (
            <button
              key={r.id}
              type="button"
              className="pick-row"
              style={{ borderColor: entry?.recipeId === r.id ? '#2E5BDB' : 'transparent' }}
              onClick={() => choose({ recipe: r })}
            >
              <StockDot color={st.color} size={9} />
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="ellipsis" style={{ font: '500 16px var(--ui)' }}>
                  {r.name}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {r.prepMinutes ?? '–'} min · {st.text}
                </span>
              </span>
              {r.favorite && <Heart weight="fill" style={{ color: '#FF7A95' }} />}
            </button>
          );
        })}
        {kitchen && !results.length && (
          <span style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            {kitchen.recipes.length ? 'No recipes match. Use free text below.' : 'No recipes yet. Use free text below, or add recipes from the Recipes tab.'}
          </span>
        )}
      </div>
      <form
        style={{ flex: '0 0 auto', display: 'flex', gap: 8, padding: '12px 16px 0', borderTop: '1px solid rgba(255,255,255,.06)' }}
        onSubmit={(e) => {
          e.preventDefault();
          const t = free.trim();
          if (t) void choose({ freeText: t });
        }}
      >
        <input
          className="input input--well"
          aria-label="Free text"
          style={{ flex: 1, minWidth: 0, borderRadius: 14, padding: '0 14px' }}
          value={free}
          onChange={(e) => setFree(e.target.value)}
          placeholder="Free text… Leftovers, Eat out"
        />
        <button type="submit" style={{ flex: '0 0 auto', height: 48, padding: '0 18px', borderRadius: 14, border: 0, background: 'var(--sapphire)', color: '#fff', font: '600 15px var(--ui)', cursor: 'pointer' }}>
          Save
        </button>
      </form>
    </>
  );
}

import { useState } from 'react';
import type { Slot } from '../data/db';
import { useKitchen, usePlan, useToday } from '../data/hooks';
import { planId, setPlan } from '../data/actions';
import { addDays, dayInfo } from '../domain/dates';
import { SLOTS, slotOf } from '../domain/constants';
import { toast, useUI } from '../state/ui';
import { chipStyle, SLOT_ICON } from '../ui/helpers';

/** Pick a day (next 7 days) and slot for a recipe. */
export function AddPlanSheet({ recipeId }: { recipeId: string }) {
  const kitchen = useKitchen();
  const plan = usePlan();
  const today = useToday();
  const close = useUI((s) => s.closeSheet);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const r = kitchen?.recipesById.get(recipeId);
  const [day, setDay] = useState(days[0]);
  const [slot, setSlot] = useState<Slot | null>(null);
  if (!r) return null;
  const sl = slot ?? r.slots[0] ?? 'dinner';
  const existing = plan?.find((e) => e.id === planId(day, sl));
  const di = dayInfo(day);

  return (
    <div className="sheet__body" style={{ padding: '4px 0 0' }}>
      <span className="sheet__title" style={{ padding: '0 20px' }}>
        Add {r.name}
      </span>
      <div className="hscroll" style={{ padding: '0 16px' }} role="radiogroup" aria-label="Day">
        {days.map((d) => {
          const x = dayInfo(d);
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={d === day}
              onClick={() => setDay(d)}
              style={{
                ...chipStyle(d === day),
                flex: '0 0 46px',
                height: 66,
                borderRadius: 16,
                border: '1px solid',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                padding: 0,
              }}
            >
              <span style={{ font: '500 12px var(--ui)' }}>{x.dow}</span>
              <span style={{ font: '700 18px var(--display)' }}>{x.dom}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 16px' }} role="radiogroup" aria-label="Meal">
        {[...SLOTS]
          .sort((a, b) => Number(r.slots.includes(b.k)) - Number(r.slots.includes(a.k)))
          .map((x) => {
            const I = SLOT_ICON[x.k];
            return (
              <button key={x.k} type="button" role="radio" aria-checked={x.k === sl} className="chip chip--sq" style={{ ...chipStyle(x.k === sl, x.j), height: 42 }} onClick={() => setSlot(x.k)}>
                <I weight="duotone" style={{ fontSize: 16 }} />
                {x.n}
              </button>
            );
          })}
      </div>
      {existing && <span style={{ fontSize: 13, color: 'var(--topaz-t)', padding: '0 20px' }}>Replaces {existing.nameSnapshot}</span>}
      <div style={{ padding: '0 16px' }}>
        <button
          type="button"
          className="btn-cta"
          onClick={async () => {
            close();
            const rec = await setPlan(day, sl, { recipe: r });
            toast(`${r.name} → ${di.dow} ${slotOf(sl).n}`, rec.undo);
          }}
        >
          Add to {di.dow} · {slotOf(sl).n}
        </button>
      </div>
    </div>
  );
}

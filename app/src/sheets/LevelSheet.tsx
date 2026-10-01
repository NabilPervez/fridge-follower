import { useEffect, useState } from 'react';
import { PushPin, Trash } from '@phosphor-icons/react';
import { useKitchen } from '../data/hooks';
import { deleteItem, updateItem } from '../data/actions';
import { LEVEL_BASE, LEVEL_NAME, LEVEL_RANK, LEVEL_TINT, LEVELS, LOCS, rgba } from '../domain/constants';
import { toast, useUI } from '../state/ui';
import { changeLevel } from '../state/feedback';
import { Toggle } from '../ui/kit';
import { chipStyle, LOC_ICON } from '../ui/helpers';

/** Pick an exact level, move location, toggle staple, or delete. */
export function LevelSheet({ itemId }: { itemId: string }) {
  const kitchen = useKitchen();
  const close = useUI((s) => s.closeSheet);
  const [delArm, setDelArm] = useState(false);
  useEffect(() => {
    if (!delArm) return;
    const t = setTimeout(() => setDelArm(false), 3000);
    return () => clearTimeout(t);
  }, [delArm]);

  const it = kitchen?.itemsById.get(itemId);
  if (!kitchen) return null;
  if (!it) return <div className="sheet__body muted">This item was deleted.</div>;
  const uses = kitchen.ingredients.filter((g) => g.itemId === it.id).length;
  const meta = [it.category, it.unitHint, uses ? `in ${uses} recipe${uses > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ');

  return (
    <div className="sheet__body" style={{ gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 4px' }}>
        <span className="sheet__title">{it.name}</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{meta}</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }} role="radiogroup" aria-label="Level">
        {LEVELS.map((l) => {
          const on = it.level === l;
          const c = LEVEL_BASE[l];
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={on}
              className="lv-opt"
              onClick={async () => {
                close();
                await changeLevel(it, l);
              }}
              style={{
                borderColor: on ? LEVEL_TINT[l] : 'rgba(255,255,255,.06)',
                background: on ? rgba(c, 0.22) : 'rgba(11,12,26,.4)',
                boxShadow: on ? `0 0 18px ${rgba(c, 0.35)}` : 'none',
                color: LEVEL_TINT[l],
              }}
            >
              <span className="lv-opt__bar">
                <span style={{ height: `${(LEVEL_RANK[l] / 4) * 100}%`, background: `linear-gradient(0deg,${rgba(c, 0.6)},${LEVEL_TINT[l]})` }} />
              </span>
              {LEVEL_NAME[l].toUpperCase()}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6 }} role="radiogroup" aria-label="Location">
        {LOCS.map((l) => {
          const I = LOC_ICON[l.k];
          const on = it.location === l.k;
          return (
            <button
              key={l.k}
              type="button"
              role="radio"
              aria-checked={on}
              className="chip chip--sq"
              style={{ ...chipStyle(on, 'emerald'), flex: '1 1 0', height: 44, borderRadius: 14, justifyContent: 'center', gap: 5, padding: 0 }}
              onClick={() => updateItem(it.id, { location: l.k })}
            >
              <I weight="duotone" style={{ fontSize: 15 }} />
              {l.n}
            </button>
          );
        })}
      </div>
      <button type="button" className="row-btn" role="switch" aria-checked={it.isStaple} onClick={() => updateItem(it.id, { isStaple: !it.isStaple })}>
        <PushPin weight="duotone" style={{ fontSize: 20, color: 'var(--topaz-t)', flex: '0 0 auto' }} />
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ font: '500 16px var(--ui)' }}>Staple</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Add to the list automatically when low</span>
        </span>
        <Toggle on={it.isStaple} />
      </button>
      <button
        type="button"
        className="btn-danger"
        style={{ height: 48, background: 'rgba(214,38,79,.12)' }}
        onClick={async () => {
          if (!delArm) return setDelArm(true);
          close();
          const rec = await deleteItem(it.id);
          toast(`${it.name} deleted`, rec.undo);
        }}
      >
        <Trash weight="duotone" />
        {delArm ? (uses ? `Used in ${uses} recipe${uses > 1 ? 's' : ''} · tap to delete` : 'Tap again to delete') : 'Delete item'}
      </button>
    </div>
  );
}

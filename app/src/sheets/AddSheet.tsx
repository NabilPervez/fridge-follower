import { useState } from 'react';
import { useItems, useShopping, useToday } from '../data/hooks';
import { addItem, addManualShop } from '../data/actions';
import type { Level, Location } from '../data/db';
import { guessCategory, LEVEL_BASE, LEVEL_NAME, LEVEL_TINT, LEVELS, LOCS, locOf, nameKey, rgba } from '../domain/constants';
import { toast, useUI } from '../state/ui';
import { chipStyle, LOC_ICON } from '../ui/helpers';

/** Quick Add: inventory (name + location + starting level) or a manual shopping row. */
export function AddSheet({ mode }: { mode: 'inv' | 'shop' }) {
  const items = useItems();
  const shop = useShopping();
  const today = useToday();
  const { loc: fridgeLoc, lowOnly, closeSheet: close, set } = useUI();
  const inv = mode === 'inv';
  const [name, setName] = useState('');
  const [loc, setLoc] = useState<Location>(() => (location.pathname.startsWith('/fridge') && !lowOnly ? fridgeLoc : 'fridge'));
  const [level, setLevel] = useState<Level>('full');
  const nm = name.trim();
  const key = nameKey(nm);
  const dupItem = inv ? items?.find((i) => i.nameKey === key) : undefined;
  const dupShop = !inv ? shop?.find((x) => !x.checked && nameKey(x.name) === key) : undefined;
  const dup = !!nm && !!(dupItem || dupShop);
  const cat = nm ? guessCategory(nm) : '—';

  const doAdd = async () => {
    if (!nm || dup) return;
    close();
    if (inv) {
      try {
        const { rec } = await addItem(nm, loc, level);
        set({ loc, lowOnly: false, q: '' });
        toast(`${nm} added to ${locOf(loc).n}`, rec.undo);
      } catch (e) {
        toast((e as Error).message);
      }
    } else {
      const rec = await addManualShop(nm, today);
      toast(`${nm} added to list`, rec.undo);
    }
  };

  return (
    <form
      className="sheet__body"
      onSubmit={(e) => {
        e.preventDefault();
        void doAdd();
      }}
    >
      <span className="sheet__title" style={{ padding: '0 4px' }}>
        {inv ? 'Add to inventory' : 'Add to list'}
      </span>
      <input
        autoFocus
        className="input input--well"
        aria-label="Name"
        aria-invalid={dup}
        style={{ height: 54, borderWidth: 1.5, borderColor: dup ? '#D6264F' : 'rgba(255,255,255,.08)', padding: '0 14px' }}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={inv ? 'Item name, e.g. Greek yogurt' : 'e.g. Birthday candles'}
      />
      {dup && (
        <span className="err" role="alert">
          {dupItem ? `Already in ${locOf(dupItem.location).n} as “${dupItem.name}”` : 'Already on your list'}
        </span>
      )}
      {inv && (
        <>
          <div style={{ display: 'flex', gap: 6 }} role="radiogroup" aria-label="Location">
            {LOCS.map((l) => {
              const I = LOC_ICON[l.k];
              return (
                <button
                  key={l.k}
                  type="button"
                  role="radio"
                  aria-checked={loc === l.k}
                  className="chip chip--sq"
                  style={{ ...chipStyle(loc === l.k, 'emerald'), flex: '1 1 0', height: 44, borderRadius: 14, justifyContent: 'center', gap: 5, padding: 0 }}
                  onClick={() => setLoc(l.k)}
                >
                  <I weight="duotone" style={{ fontSize: 15 }} />
                  {l.n}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 6 }} role="radiogroup" aria-label="Starting level">
            {LEVELS.map((l) => {
              const on = level === l;
              return (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setLevel(l)}
                  style={{
                    flex: '1 1 0',
                    height: 40,
                    borderRadius: 12,
                    border: `1px solid ${on ? LEVEL_TINT[l] : 'rgba(255,255,255,.08)'}`,
                    background: on ? rgba(LEVEL_BASE[l], 0.3) : 'rgba(255,255,255,.04)',
                    color: on ? '#fff' : LEVEL_TINT[l],
                    font: '600 12px var(--ui)',
                    letterSpacing: '.04em',
                    cursor: 'pointer',
                  }}
                >
                  {LEVEL_NAME[l]}
                </button>
              );
            })}
          </div>
        </>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', fontSize: 13, color: 'var(--text-muted)' }}>
        <span>Category</span>
        <span style={{ color: 'var(--text)' }}>
          {cat} <span style={{ color: 'var(--text-dim)' }}>· auto</span>
        </span>
      </div>
      <button type="submit" className="btn-cta" disabled={!nm || dup}>
        {inv ? `Add as ${LEVEL_NAME[level]}` : 'Add to list'}
      </button>
    </form>
  );
}

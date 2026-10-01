import { useRef, useState, type PointerEvent } from 'react';
import { FunnelSimple, MagnifyingGlass, Minus, Plus, SealCheck } from '@phosphor-icons/react';
import type { Item } from '../data/db';
import { useKitchen } from '../data/hooks';
import { CATEGORIES, LEVEL_NAME, LOCS, locOf } from '../domain/constants';
import { changeLevel, step } from '../state/feedback';
import { isLow } from '../domain/levels';
import { useUI } from '../state/ui';
import { Meter } from '../ui/kit';
import { LOC_ICON } from '../ui/helpers';

const SWIPE = 60;
const MAX_DRAG = 110;

function ItemRow({ item, meta }: { item: Item; meta: string }) {
  const [dx, setDx] = useState(0);
  const p = useRef<{ x: number; y: number; moved: boolean; id: number } | null>(null);
  const openSheet = useUI((s) => s.openSheet);

  const onDown = (e: PointerEvent) => {
    p.current = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
  };
  const onMove = (e: PointerEvent) => {
    const s = p.current;
    if (!s) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (Math.abs(mx) > 8 || Math.abs(my) > 8) s.moved = true;
    if (s.moved && Math.abs(mx) > Math.abs(my)) {
      (e.currentTarget as HTMLElement).setPointerCapture?.(s.id);
      setDx(Math.max(-MAX_DRAG, Math.min(MAX_DRAG, mx)));
    }
  };
  const onUp = (e: PointerEvent) => {
    const s = p.current;
    p.current = null;
    setDx(0);
    if (!s) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (mx > SWIPE) void changeLevel(item, 'full');
    else if (mx < -SWIPE) void changeLevel(item, 'out');
    else if (!s.moved && Math.abs(mx) < 8 && Math.abs(my) < 8) openSheet({ type: 'level', itemId: item.id });
  };
  const onCancel = () => {
    p.current = null;
    setDx(0);
  };

  return (
    <div className="item-row" style={{ background: dx > 0 ? '#0F9D76' : dx < 0 ? '#D6264F' : 'transparent' }}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${item.name}, ${LEVEL_NAME[item.level]}. Edit`}
        className={`item-row__main${dx === 0 ? ' is-settling' : ''}`}
        style={{ minHeight: 64, transform: `translateX(${dx}px)` }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openSheet({ type: 'level', itemId: item.id });
          }
        }}
      >
        <div className="item-row__text">
          <span className="item-row__name ellipsis">{item.name}</span>
          {meta && <span className="item-row__meta ellipsis">{meta}</span>}
        </div>
        <Meter level={item.level} />
      </div>
      <div className="item-row__steps">
        <button
          type="button"
          className="step-btn"
          aria-label={`Lower ${item.name}`}
          onClick={() => step(item, 1)}
          style={{ color: item.level === 'out' ? '#4F4C70' : '#FF9BB0' }}
        >
          <Minus weight="bold" />
        </button>
        <button
          type="button"
          className="step-btn"
          aria-label={`Raise ${item.name}`}
          onClick={() => step(item, -1)}
          style={{ color: item.level === 'full' ? '#4F4C70' : '#7FE6C6' }}
        >
          <Plus weight="bold" />
        </button>
      </div>
    </div>
  );
}

export function Fridge() {
  const kitchen = useKitchen();
  const { loc, q, lowOnly, set } = useUI();
  const query = q.trim().toLowerCase();
  const items = kitchen?.items ?? [];
  const list = items.filter(
    (i) => (lowOnly ? isLow(i) : query ? true : i.location === loc) && (!query || i.name.toLowerCase().includes(query)),
  );
  const cats = [...CATEGORIES, ...new Set(list.map((i) => i.category).filter((c) => !CATEGORIES.includes(c)))];
  const groups = cats
    .map((c) => ({
      cat: c,
      items: list
        .filter((i) => i.category === c)
        .sort((a, b) => Number(!isLow(a)) - Number(!isLow(b)) || a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.items.length);

  return (
    <>
      <header className="page-head" style={{ paddingRight: 22 }}>
        <div className="page-head__titles">
          <span className="eyebrow" style={{ color: 'var(--emerald-t)' }}>
            {items.length} items · {kitchen?.lowItems.length ?? 0} low
          </span>
          <h1 className="title">Inventory</h1>
        </div>
      </header>
      <div style={{ position: 'relative', flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 10, padding: '6px 16px 8px' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <label className="search">
            <MagnifyingGlass weight="bold" />
            <span className="sr-only">Search items</span>
            <input className="input" type="search" value={q} onChange={(e) => set({ q: e.target.value })} placeholder="Search items" />
          </label>
          <button
            type="button"
            aria-pressed={lowOnly}
            onClick={() => set({ lowOnly: !lowOnly, q: '' })}
            className="btn-soft"
            style={{
              height: 48,
              borderRadius: 16,
              font: '600 14px var(--ui)',
              background: lowOnly ? 'rgba(214,38,79,.22)' : 'rgba(255,255,255,.05)',
              borderColor: lowOnly ? 'rgba(255,122,149,.5)' : 'rgba(255,255,255,.08)',
              color: lowOnly ? '#FF9BB0' : '#C8C5DE',
            }}
          >
            <FunnelSimple weight="duotone" style={{ fontSize: 18 }} />
            Low only
          </button>
        </div>
        <div className="locseg" role="tablist" aria-label="Location">
          {LOCS.map((l) => {
            const on = !lowOnly && !query && loc === l.k;
            const I = LOC_ICON[l.k];
            return (
              <button
                key={l.k}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => set({ loc: l.k, lowOnly: false, q: '' })}
                style={{
                  background: on ? 'linear-gradient(135deg,rgba(15,157,118,.5),rgba(15,157,118,.25))' : 'transparent',
                  boxShadow: on ? '0 4px 14px rgba(15,157,118,.25)' : 'none',
                  color: on ? '#fff' : '#A9A6C4',
                }}
              >
                <I weight={on ? 'fill' : 'regular'} />
                {l.n}
              </button>
            );
          })}
        </div>
      </div>
      <main className="scroll" style={{ gap: 16, paddingTop: 8 }}>
        {lowOnly && <span style={{ fontSize: 13, color: 'var(--text-muted)', padding: '0 4px' }}>Low and out items from every location</span>}
        {groups.map((g) => (
          <section key={g.cat} className="group">
            <div className="group__head">
              <span className="section-label">{g.cat}</span>
              <span className="group__n">{g.items.length}</span>
            </div>
            <div className="glass list">
              {g.items.map((i) => (
                <ItemRow
                  key={i.id}
                  item={i}
                  meta={[lowOnly || query ? locOf(i.location).n : null, i.unitHint || null, i.isStaple ? 'Staple' : null].filter(Boolean).join(' · ')}
                />
              ))}
            </div>
          </section>
        ))}
        {kitchen && !groups.length && (
          <div className="empty">
            <SealCheck weight="duotone" style={{ color: 'var(--emerald-t)' }} />
            <span className="empty__title">Nothing here</span>
            <span className="empty__body">
              {lowOnly ? 'Nothing is low.' : query ? `No items match “${q}”.` : 'Add your first item with +.'}
            </span>
          </div>
        )}
        <span className="hint">− / + change levels · Tap a row to edit · Swipe → Full, ← Out</span>
      </main>
    </>
  );
}

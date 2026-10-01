import {
  ArrowsClockwise,
  CalendarDots,
  CaretDown,
  CaretUp,
  Check,
  CheckCircle,
  Confetti,
  HandPointing,
  Lightning,
  PushPin,
  ShareNetwork,
} from '@phosphor-icons/react';
import type { ShoppingItem } from '../data/db';
import { useSettings, useShopping, useToday } from '../data/hooks';
import { finishTrip, toggleShopItem } from '../data/actions';
import { regenerate } from '../state/feedback';
import { addDays, rangeLabel } from '../domain/dates';
import { CATEGORIES } from '../domain/constants';
import { toast, useUI, vibrate } from '../state/ui';
import { IconButton } from '../ui/kit';

const BADGE = {
  plan: { label: 'Plan', icon: CalendarDots, bg: 'rgba(46,91,219,.24)', color: '#B8C9FF' },
  staple: { label: 'Staple', icon: PushPin, bg: 'rgba(227,162,26,.2)', color: '#F0BE4E' },
  manual: { label: 'Added', icon: HandPointing, bg: 'rgba(255,255,255,.08)', color: '#C8C5DE' },
} as const;

const byCategory = (rows: ShoppingItem[]) => {
  const cats = [...CATEGORIES, ...new Set(rows.map((r) => r.category).filter((c) => !CATEGORIES.includes(c)))];
  return cats
    .map((c) => ({ cat: c, rows: rows.filter((r) => r.category === c).sort((a, b) => a.name.localeCompare(b.name)) }))
    .filter((g) => g.rows.length);
};

async function shareList(rows: ShoppingItem[], range: string) {
  if (!rows.length) return toast('Nothing to share');
  const text = [`Shopping · ${range}`, ...byCategory(rows).flatMap((g) => ['', g.cat.toUpperCase(), ...g.rows.map((r) => `☐ ${r.name}`)])].join('\n');
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Shopping list', text });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast(`Copied ${rows.length} items as text`);
  } catch (e) {
    if ((e as DOMException).name !== 'AbortError') toast("Couldn't share the list");
  }
}

export function Shop() {
  const today = useToday();
  const shop = useShopping();
  const settings = useSettings();
  const { cartOpen, set, openSheet } = useUI();
  const range = rangeLabel(today, addDays(today, 6));
  const unchecked = (shop ?? []).filter((x) => !x.checked);
  const cart = (shop ?? []).filter((x) => x.checked);
  const stale = settings.shopStale || (!!settings.shopGeneratedFor && settings.shopGeneratedFor !== today);

  const toggle = async (x: ShoppingItem) => {
    if (!x.checked) vibrate();
    const { rec, checked, restocked } = await toggleShopItem(x.id);
    if (checked) toast(restocked || x.itemId ? `${x.name} restocked to Full` : `${x.name} in cart`, rec.undo);
  };

  return (
    <>
      <header className="page-head">
        <div className="page-head__titles">
          <span className="eyebrow" style={{ color: 'var(--topaz-t)' }}>
            {range} · {unchecked.length} to buy
          </span>
          <h1 className="title">Shopping</h1>
        </div>
        <div className="page-head__actions">
          <IconButton label="Regenerate list" icon={ArrowsClockwise} size={21} onClick={() => regenerate(today)}>
            {stale && <span className="dot-badge" />}
          </IconButton>
          <IconButton label="Share list" icon={ShareNetwork} size={21} onClick={() => shareList(unchecked, range)} />
        </div>
      </header>
      <main className="scroll" style={{ gap: 16, paddingTop: 10, paddingBottom: 16 }}>
        {stale && (
          <div className="banner">
            <Lightning weight="duotone" />
            <span className="banner__text">Your plan or fridge changed since this list was built.</span>
            <button type="button" onClick={() => regenerate(today)}>
              Update
            </button>
          </div>
        )}
        {byCategory(unchecked).map((g) => (
          <section key={g.cat} className="group">
            <div className="group__head">
              <span className="section-label">{g.cat}</span>
            </div>
            <div className="glass list">
              {g.rows.map((r) => {
                const b = BADGE[r.source];
                const BI = b.icon;
                return (
                  <div key={r.id} className="shop-row">
                    <button type="button" className="check" aria-label={`Check ${r.name}`} onClick={() => toggle(r)}>
                      <span className="check__box" />
                    </button>
                    <button type="button" className="shop-row__name" onClick={() => toggle(r)}>
                      <span className="ellipsis" style={{ font: '500 16px var(--ui)', maxWidth: '100%' }}>
                        {r.name}
                      </span>
                      {r.mayRunShort && <span style={{ fontSize: 12, color: 'var(--topaz-t)' }}>May run short · Med, 3+ planned uses</span>}
                    </button>
                    <button
                      type="button"
                      className="badge"
                      style={{ background: b.bg, color: b.color, cursor: r.source === 'plan' ? 'pointer' : 'default' }}
                      onClick={() => r.source === 'plan' && openSheet({ type: 'reason', shopId: r.id })}
                      aria-label={r.source === 'plan' ? `Why ${r.name} is on the list` : b.label}
                    >
                      <BI weight="bold" />
                      {b.label}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {shop && !unchecked.length && (
          <div className="empty">
            <Confetti weight="duotone" style={{ color: 'var(--emerald-t)' }} />
            <span className="empty__title">Nothing left to buy</span>
            <span className="empty__body">Everything your plan needs is in stock.</span>
          </div>
        )}
        {cart.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" className="cart-head" aria-expanded={cartOpen} onClick={() => set({ cartOpen: !cartOpen })}>
              <span className="section-label">In cart · {cart.length}</span>
              <span style={{ flex: 1 }} />
              {cartOpen ? <CaretUp weight="bold" /> : <CaretDown weight="bold" />}
            </button>
            {cartOpen && (
              <div className="cart">
                {cart.map((r) => (
                  <div key={r.id} className="shop-row" style={{ minHeight: 52, paddingRight: 14 }}>
                    <button type="button" className="check" aria-label={`Uncheck ${r.name}`} onClick={() => toggle(r)}>
                      <span className="check__box check__box--on">
                        <Check weight="bold" />
                      </span>
                    </button>
                    <span style={{ flex: 1, font: '500 16px var(--ui)', textDecoration: 'line-through', color: 'var(--text-muted)' }}>{r.name}</span>
                    {r.itemId && <span style={{ fontSize: 12, color: 'var(--emerald-t)' }}>→ Full</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{ flex: '0 0 160px' }} />
      </main>
      {cart.length > 0 && (
        <div className="float-cta">
          <button
            type="button"
            className="btn-cta btn-cta--float"
            onClick={async () => {
              const { rec, restocked } = await finishTrip();
              toast(`Trip done · ${restocked} item${restocked === 1 ? '' : 's'} restocked`, rec.undo);
            }}
          >
            <CheckCircle weight="bold" style={{ fontSize: 20 }} />
            Finish trip · {cart.length} in cart
          </button>
        </div>
      )}
    </>
  );
}

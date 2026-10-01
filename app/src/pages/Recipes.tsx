import { useNavigate } from 'react-router';
import { CookingPot, Heart, MagnifyingGlass, Package, Plus, Timer } from '@phosphor-icons/react';
import { useKitchen, useToday } from '../data/hooks';
import { toggleFavorite } from '../data/actions';
import { loadStarterPack } from '../data/starter';
import { JEWEL, rgba, slotOf } from '../domain/constants';
import { toast, useUI } from '../state/ui';
import { IconButton, StockDot } from '../ui/kit';
import { chipStyle, SLOT_ICON } from '../ui/helpers';

const FILTERS: [string, string][] = [
  ['all', 'All'],
  ['fav', 'Favorites'],
  ['breakfast', 'Breakfast'],
  ['snack', 'Snacks'],
  ['lunch', 'Lunch'],
  ['dinner', 'Dinner'],
];

export function Recipes() {
  const navigate = useNavigate();
  const today = useToday();
  const kitchen = useKitchen();
  const { recQ, recFilter, set, openSheet } = useUI();
  const q = recQ.trim().toLowerCase();
  const recipes = (kitchen?.recipes ?? [])
    .filter((r) =>
      recFilter === 'all'
        ? true
        : recFilter === 'fav'
          ? r.favorite
          : recFilter === 'snack'
            ? r.slots.some((s) => s.startsWith('snack'))
            : r.slots.includes(recFilter as never),
    )
    .filter((r) => !q || r.name.toLowerCase().includes(q))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
  const none = kitchen && !kitchen.recipes.length;

  return (
    <>
      <header className="page-head">
        <div className="page-head__titles">
          <span className="eyebrow" style={{ color: 'var(--amethyst-t)' }}>
            {kitchen?.recipes.length ?? 0} saved
          </span>
          <h1 className="title">Recipes</h1>
        </div>
        <IconButton label="New recipe" icon={Plus} weight="bold" variant="violet" onClick={() => openSheet({ type: 'newRecipe' })} />
      </header>
      <main className="scroll" style={{ gap: 12, paddingTop: 10 }}>
        <label className="search">
          <MagnifyingGlass weight="bold" />
          <span className="sr-only">Search recipes</span>
          <input className="input" type="search" value={recQ} onChange={(e) => set({ recQ: e.target.value })} placeholder="Search recipes" />
        </label>
        <div className="hscroll" style={{ margin: '0 -16px', padding: '0 16px' }}>
          {FILTERS.map(([k, n]) => (
            <button key={k} type="button" className="chip" aria-pressed={recFilter === k} style={chipStyle(recFilter === k, 'amethyst')} onClick={() => set({ recFilter: k })}>
              {n}
            </button>
          ))}
        </div>
        {recipes.map((r) => {
          const st = kitchen!.stock(r.id);
          const sl = slotOf(r.slots[0] ?? 'dinner');
          const [base, tint] = JEWEL[sl.j];
          const I = SLOT_ICON[sl.k];
          return (
            <div key={r.id} className="glass rec-card">
              <button type="button" className="rec-card__main" onClick={() => navigate(`/recipes/${r.id}`)}>
                <div className="tile tile--lg" style={{ background: rgba(base, 0.2), color: tint }}>
                  <I weight="duotone" />
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span className="rec-card__name ellipsis">{r.name}</span>
                  <div className="rec-card__meta">
                    <span>
                      <Timer />
                      {r.prepMinutes ?? '–'} min
                    </span>
                    <span>
                      <StockDot color={st.color} size={7} />
                      {st.text}
                    </span>
                  </div>
                </div>
              </button>
              <button
                type="button"
                className="heart-btn"
                aria-label={r.favorite ? `Unfavorite ${r.name}` : `Favorite ${r.name}`}
                aria-pressed={r.favorite}
                onClick={() => toggleFavorite(r.id)}
                style={{ color: r.favorite ? '#FF7A95' : '#6E6B8F' }}
              >
                <Heart weight={r.favorite ? 'fill' : 'regular'} />
              </button>
            </div>
          );
        })}
        {none ? (
          <div className="empty">
            <CookingPot weight="duotone" style={{ color: 'var(--amethyst-t)' }} />
            <span className="empty__title">Add your first recipe</span>
            <span className="empty__body">Write one by hand, paste recipe text, or import a file.</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" className="btn-soft" onClick={() => openSheet({ type: 'newRecipe' })}>
                <Plus weight="bold" />
                New recipe
              </button>
              <button
                type="button"
                className="btn-soft"
                onClick={async () => {
                  const { rec, added } = await loadStarterPack(today);
                  toast(`Added ${added.recipes} recipes and ${added.items} items`, rec.undo);
                }}
              >
                <Package weight="duotone" />
                Starter pack
              </button>
            </div>
          </div>
        ) : (
          kitchen &&
          !recipes.length && <span style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No recipes match.</span>
        )}
      </main>
    </>
  );
}

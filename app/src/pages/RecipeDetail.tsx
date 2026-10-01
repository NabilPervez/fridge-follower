import { useNavigate, useParams } from 'react-router';
import { CalendarPlus, CookingPot, Heart, PencilSimple, Timer, Users } from '@phosphor-icons/react';
import { useKitchen } from '../data/hooks';
import { toggleFavorite } from '../data/actions';
import { isLow } from '../domain/levels';
import { SLOTS } from '../domain/constants';
import { useUI } from '../state/ui';
import { BackButton, IconButton, Meter } from '../ui/kit';

export function RecipeDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const kitchen = useKitchen();
  const openSheet = useUI((s) => s.openSheet);
  if (!kitchen) return null;
  const r = kitchen.recipesById.get(id);

  if (!r) {
    return (
      <>
        <div className="bar">
          <BackButton fallback="/recipes" solid />
        </div>
        <div className="empty">
          <CookingPot weight="duotone" style={{ color: 'var(--amethyst-t)' }} />
          <span className="empty__title">Recipe not found</span>
          <span className="empty__body">It may have been deleted.</span>
        </div>
      </>
    );
  }

  const ings = kitchen.ingsByRecipe.get(r.id) ?? [];
  const st = kitchen.stock(r.id);
  const lowN = ings.filter((g) => {
    const it = kitchen.itemsById.get(g.itemId);
    return !it || isLow(it);
  }).length;
  const tags = [...new Set(SLOTS.filter((s) => r.slots.includes(s.k)).map((s) => s.short))].join(' · ');

  return (
    <>
      <div className="bar">
        <BackButton fallback="/recipes" solid />
        <div style={{ display: 'flex', gap: 6 }}>
          <IconButton label="Edit recipe" icon={PencilSimple} size={21} onClick={() => navigate(`/recipes/${r.id}/edit`)} />
          <IconButton
            label={r.favorite ? 'Unfavorite' : 'Favorite'}
            icon={Heart}
            weight={r.favorite ? 'fill' : 'duotone'}
            size={21}
            style={{ color: r.favorite ? '#FF7A95' : '#C8C5DE' }}
            onClick={() => toggleFavorite(r.id)}
          />
        </div>
      </div>
      <main className="scroll" style={{ gap: 20, paddingTop: 8, paddingBottom: 'calc(190px + var(--safe-b))' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 4px' }}>
          <h1 className="title" style={{ lineHeight: 1.05, textWrap: 'balance' }}>
            {r.name}
          </h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="pill-tag pill-tag--violet">{tags}</span>
            {r.prepMinutes != null && (
              <span className="pill-tag">
                <Timer />
                {r.prepMinutes} min
              </span>
            )}
            <span className="pill-tag">
              <Users />
              {r.servings} {r.servings > 1 ? 'servings' : 'serving'}
            </span>
          </div>
        </div>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 4px' }}>
            <span className="section-title">Ingredients</span>
            <span style={{ fontSize: 13, color: st.kind === 'ok' ? '#3FD1A6' : st.kind === 'low' ? '#F0BE4E' : '#FF7A95' }}>
              {lowN ? `${lowN} of ${ings.length} low or out` : 'All in stock'}
            </span>
          </div>
          <div className="glass list">
            {ings.map((g) => {
              const it = kitchen.itemsById.get(g.itemId);
              return (
                <button key={g.id} type="button" className="ing-row" onClick={() => it && openSheet({ type: 'level', itemId: it.id })} disabled={!it}>
                  <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ font: '500 16px var(--ui)' }}>{it?.name ?? `${g.nameSnapshot} (removed)`}</span>
                    {g.qtyText && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.qtyText}</span>}
                  </div>
                  <Meter level={it?.level ?? 'out'} />
                </button>
              );
            })}
          </div>
        </section>
        {r.steps.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span className="section-title" style={{ padding: '0 4px' }}>
              Steps
            </span>
            {r.steps.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '0 4px' }}>
                <span className="step-num">{i + 1}</span>
                <span style={{ flex: 1, fontSize: 16, lineHeight: 1.5, color: '#DAD7EA', textWrap: 'pretty' }}>{t}</span>
              </div>
            ))}
          </section>
        )}
      </main>
      <div className="float-cta">
        <button type="button" className="btn-cta btn-cta--float" onClick={() => openSheet({ type: 'addPlan', recipeId: r.id })}>
          <CalendarPlus weight="bold" style={{ fontSize: 20 }} />
          Add to plan
        </button>
      </div>
    </>
  );
}

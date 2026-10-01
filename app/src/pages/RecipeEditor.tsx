import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Check, MagicWand, Minus, Plus, PlusCircle, Trash, X } from '@phosphor-icons/react';
import { useKitchen } from '../data/hooks';
import { blankDraft, deleteRecipe, draftFromRecipe, saveRecipe, type DraftIngredient, type RecipeDraft } from '../data/actions';
import type { Consumes } from '../data/db';
import { LEVEL_NAME, LEVEL_TINT, SLOTS, locOf, nameKey } from '../domain/constants';
import { toast, useUI } from '../state/ui';
import { IconButton, StockDot } from '../ui/kit';
import { chipStyle, LOC_ICON, SLOT_ICON, useBack } from '../ui/helpers';

const USES: [Consumes, string][] = [
  ['none', 'No change'],
  ['one-level', '−1 level'],
  ['depletes', 'Uses all'],
];

export function RecipeEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const back = useBack(id ? `/recipes/${id}` : '/recipes');
  const kitchen = useKitchen();
  const [ed, setEd] = useState<RecipeDraft | null>(() => {
    if (id) return null;
    const d = useUI.getState().draft;
    return d ?? blankDraft();
  });
  const [ingQ, setIngQ] = useState('');
  const [delArm, setDelArm] = useState(false);

  useEffect(() => {
    useUI.getState().set({ draft: null });
    if (!id) return;
    let live = true;
    void draftFromRecipe(id).then((d) => live && setEd(d ?? blankDraft()));
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    if (!delArm) return;
    const t = setTimeout(() => setDelArm(false), 3000);
    return () => clearTimeout(t);
  }, [delArm]);

  if (!ed || !kitchen) return null;
  const up = (patch: Partial<RecipeDraft> | ((e: RecipeDraft) => Partial<RecipeDraft>)) =>
    setEd((e) => (e ? { ...e, ...(typeof patch === 'function' ? patch(e) : patch) } : e));
  const upIng = (key: string, patch: Partial<DraftIngredient>) => up((e) => ({ ings: e.ings.map((g) => (g.key === key ? { ...g, ...patch } : g)) }));
  const valid = !!ed.name.trim() && ed.ings.length > 0;

  const iq = ingQ.trim();
  const used = new Set(ed.ings.map((g) => g.itemId).filter(Boolean));
  const sugItems = iq ? kitchen.items.filter((i) => !used.has(i.id) && i.name.toLowerCase().includes(iq.toLowerCase())).slice(0, 4) : [];
  const exact = iq && kitchen.items.some((i) => i.nameKey === nameKey(iq));
  const pendingNew = iq && ed.ings.some((g) => !g.itemId && nameKey(g.newName ?? '') === nameKey(iq));
  const addIng = (g: Partial<DraftIngredient>) => {
    up((e) => ({ ings: [...e.ings, { key: crypto.randomUUID(), itemId: null, qty: '', consumes: 'one-level', ...g }] }));
    setIngQ('');
  };
  const sugs = sugItems.map((i) => ({ key: i.id, pick: () => addIng({ itemId: i.id }), item: i }));
  const createSug = iq && !exact && !pendingNew ? () => addIng({ newName: iq.charAt(0).toUpperCase() + iq.slice(1) }) : null;

  const save = async () => {
    if (!ed.name.trim()) return toast('Give the recipe a name');
    if (!ed.ings.length) return toast('Add at least one ingredient');
    const { id: rid, created } = await saveRecipe(ed);
    const extra = created ? ` · ${created} new item${created > 1 ? 's' : ''} set to Out` : '';
    toast(`${ed.id ? 'Saved' : 'Added'} ${ed.name.trim()}${extra}`);
    if (ed.id) back();
    else navigate(`/recipes/${rid}`, { replace: true });
  };

  const del = async () => {
    if (!ed.id) return;
    if (!delArm) return setDelArm(true);
    const rec = await deleteRecipe(ed.id);
    toast(`${ed.name} deleted · planned meals keep the name`, rec.undo);
    navigate('/recipes', { replace: true });
  };

  return (
    <>
      <div className="bar">
        <IconButton label="Cancel" icon={X} weight="bold" size={20} onClick={back} />
        <span className="bar__title">{ed.id ? 'Edit recipe' : 'New recipe'}</span>
        <button
          type="button"
          onClick={save}
          style={{
            height: 40,
            padding: '0 16px',
            borderRadius: 12,
            border: 0,
            background: valid ? 'var(--cta-violet)' : 'rgba(255,255,255,.08)',
            color: valid ? '#fff' : '#7F7CA0',
            font: '600 14px var(--ui)',
            cursor: 'pointer',
          }}
        >
          Save
        </button>
      </div>
      <main className="scroll" style={{ gap: 22, paddingTop: 8, paddingBottom: 'calc(120px + var(--safe-b))' }}>
        {ed.source && (
          <div className="note-violet">
            <MagicWand weight="duotone" />
            <span>Imported from {ed.source}. Check the matches below, then save.</span>
          </div>
        )}
        <input className="name-input" aria-label="Recipe name" value={ed.name} onChange={(e) => up({ name: e.target.value })} placeholder="Recipe name" />

        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="section-label" style={{ padding: '0 4px' }}>
            Suited for
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SLOTS.map((sl) => {
              const on = ed.slots.includes(sl.k);
              const I = SLOT_ICON[sl.k];
              return (
                <button
                  key={sl.k}
                  type="button"
                  className="chip chip--sq"
                  aria-pressed={on}
                  style={chipStyle(on, sl.j)}
                  onClick={() => up((e) => ({ slots: on ? e.slots.filter((x) => x !== sl.k) : [...e.slots, sl.k] }))}
                >
                  <I weight="duotone" style={{ fontSize: 16 }} />
                  {sl.n}
                </button>
              );
            })}
          </div>
        </section>

        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'minutes', val: ed.prep, dec: () => up((e) => ({ prep: Math.max(1, e.prep - 5) })), inc: () => up((e) => ({ prep: e.prep + 5 })) },
            { label: ed.serv > 1 ? 'servings' : 'serving', val: ed.serv, dec: () => up((e) => ({ serv: Math.max(1, e.serv - 1) })), inc: () => up((e) => ({ serv: e.serv + 1 })) },
          ].map((s) => (
            <div key={s.label} className="stepper">
              <button type="button" aria-label={`Fewer ${s.label}`} onClick={s.dec}>
                <Minus weight="bold" />
              </button>
              <div className="stepper__val">
                <b>{s.val}</b>
                <span>{s.label}</span>
              </div>
              <button type="button" aria-label={`More ${s.label}`} onClick={s.inc}>
                <Plus weight="bold" />
              </button>
            </div>
          ))}
        </div>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
            <span className="section-label">Ingredients</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ed.ings.length ? `${ed.ings.length} linked to inventory` : 'At least one'}</span>
          </div>
          {ed.ings.map((g) => {
            const it = g.itemId ? kitchen.itemsById.get(g.itemId) : undefined;
            const sub = it
              ? g.matchedFrom
                ? `Matched “${g.matchedFrom}” · ${LEVEL_NAME[it.level]}`
                : `In ${locOf(it.location).n.toLowerCase()} · ${LEVEL_NAME[it.level]}`
              : 'New item · will be added to Pantry as Out';
            const subC = it ? (g.matchedFrom ? '#C9A4F5' : LEVEL_TINT[it.level]) : '#C9A4F5';
            const name = it?.name ?? g.newName ?? '';
            return (
              <div key={g.key} className="ed-ing" style={{ borderColor: it ? 'rgba(255,255,255,.07)' : 'rgba(139,63,217,.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StockDot color={it ? LEVEL_TINT[it.level] : '#C9A4F5'} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span className="ellipsis" style={{ font: '500 16px var(--ui)' }}>
                      {name}
                    </span>
                    <span style={{ fontSize: 12, color: subC }}>{sub}</span>
                  </div>
                  <button type="button" className="small-x" aria-label={`Remove ${name}`} onClick={() => up((e) => ({ ings: e.ings.filter((x) => x.key !== g.key) }))}>
                    <X weight="bold" />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="qty-input" aria-label={`Quantity of ${name}`} value={g.qty} onChange={(e) => upIng(g.key, { qty: e.target.value })} placeholder="Qty" />
                  <div className="uses" role="radiogroup" aria-label="When cooked">
                    {USES.map(([k, n]) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={g.consumes === k}
                        onClick={() => upIng(g.key, { consumes: k })}
                        style={{ background: g.consumes === k ? 'rgba(139,63,217,.45)' : 'transparent', color: g.consumes === k ? '#fff' : '#A9A6C4' }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          <div className="add-ing">
            <label className="add-ing__input">
              <Plus weight="bold" />
              <span className="sr-only">Add ingredient</span>
              <input
                value={ingQ}
                onChange={(e) => setIngQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  if (sugs[0]) sugs[0].pick();
                  else createSug?.();
                }}
                placeholder="Add ingredient"
              />
            </label>
            {sugs.map((s) => {
              const I = LOC_ICON[s.item.location];
              return (
                <button key={s.key} type="button" className="sug" onClick={s.pick}>
                  <I weight="duotone" style={{ fontSize: 17, color: 'var(--text-muted)' }} />
                  <span style={{ flex: 1, font: '500 15px var(--ui)' }}>{s.item.name}</span>
                  <span style={{ fontSize: 12, color: LEVEL_TINT[s.item.level] }}>
                    {LEVEL_NAME[s.item.level]} · {locOf(s.item.location).n}
                  </span>
                </button>
              );
            })}
            {createSug && (
              <button type="button" className="sug" onClick={createSug}>
                <PlusCircle weight="bold" style={{ fontSize: 17, color: 'var(--amethyst-t)' }} />
                <span style={{ flex: 1, font: '500 15px var(--ui)' }}>Create “{iq}”</span>
                <span style={{ fontSize: 12, color: 'var(--amethyst-t)' }}>New item · Pantry, Out</span>
              </button>
            )}
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="section-label" style={{ padding: '0 4px' }}>
            Steps
          </span>
          {ed.steps.map((t, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span className="step-num" style={{ marginTop: 10 }}>
                {idx + 1}
              </span>
              <textarea
                className="step-text"
                aria-label={`Step ${idx + 1}`}
                value={t}
                onChange={(e) => {
                  const v = e.target.value;
                  up((x) => ({ steps: x.steps.map((y, j) => (j === idx ? v : y)) }));
                }}
                placeholder="Describe this step"
              />
              <button
                type="button"
                className="small-x"
                aria-label={`Remove step ${idx + 1}`}
                style={{ marginTop: 6, background: 'none', color: 'var(--text-dim)' }}
                onClick={() => up((x) => ({ steps: x.steps.filter((_, j) => j !== idx) }))}
              >
                <X weight="bold" />
              </button>
            </div>
          ))}
          <button type="button" className="dashed-btn" onClick={() => up((x) => ({ steps: [...x.steps, ''] }))}>
            <Plus weight="bold" />
            Add step
          </button>
        </section>

        {ed.id && (
          <button type="button" className="btn-danger" onClick={del}>
            <Trash weight="duotone" />
            {delArm ? 'Tap again to delete' : 'Delete recipe'}
          </button>
        )}
      </main>
      <div className="float-cta float-cta--low">
        <button
          type="button"
          className="btn-cta"
          onClick={save}
          style={{
            height: 56,
            background: valid ? 'var(--cta-violet)' : 'rgba(255,255,255,.08)',
            color: valid ? '#fff' : '#7F7CA0',
            boxShadow: '0 12px 30px rgba(0,0,0,.35)',
          }}
        >
          <Check weight="bold" style={{ fontSize: 18 }} />
          {ed.id ? 'Save changes' : 'Save recipe'}
        </button>
      </div>
    </>
  );
}

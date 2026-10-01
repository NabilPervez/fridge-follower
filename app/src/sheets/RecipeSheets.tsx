import { useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router';
import { CaretRight, ClipboardText, FileArrowDown, MagicWand, PencilSimpleLine, type Icon } from '@phosphor-icons/react';
import { blankDraft, draftFromParsed, importRecipes, type RecipeDraft } from '../data/actions';
import { db } from '../data/db';
import { parseRecipeJson, parseRecipeText, SAMPLE_RECIPE } from '../domain/parse';
import { toast, useUI } from '../state/ui';

function useOpenEditor() {
  const navigate = useNavigate();
  return (draft: RecipeDraft) => {
    useUI.getState().set({ draft, sheet: null });
    navigate('/recipes/new');
  };
}

function Option({ icon: I, bg, color, title, sub }: { icon: Icon; bg: string; color: string; title: string; sub: string }) {
  return (
    <>
      <span className="tile" style={{ background: bg, color }}>
        <I weight="duotone" />
      </span>
      <span className="big-opt__text">
        <b>{title}</b>
        <span>{sub}</span>
      </span>
      <CaretRight weight="bold" style={{ color: 'var(--text-dim)' }} />
    </>
  );
}

export function NewRecipeSheet() {
  const openEditor = useOpenEditor();
  const openSheet = useUI((s) => s.openSheet);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const txt = await f.text();
    let data: unknown = null;
    try {
      data = JSON.parse(txt);
    } catch {
      /* not JSON, treat as text */
    }
    const items = await db.items.toArray();
    if (data !== null) {
      const list = parseRecipeJson(data);
      if (!list.length) return toast(`No recipes found in ${f.name}`);
      if (list.length === 1) return openEditor(draftFromParsed(list[0], f.name, items));
      useUI.getState().closeSheet();
      const rec = await importRecipes(list);
      toast(`Imported ${list.length} recipes`, rec.undo);
      return;
    }
    const p = parseRecipeText(txt);
    if (!p) return toast('That file looks empty');
    openEditor(draftFromParsed(p, f.name, items));
  };

  return (
    <div className="sheet__body" style={{ gap: 10 }}>
      <span className="sheet__title" style={{ padding: '0 4px 4px' }}>
        Add a recipe
      </span>
      <button type="button" className="big-opt" onClick={() => openEditor(blankDraft())}>
        <Option icon={PencilSimpleLine} bg="rgba(139,63,217,.25)" color="#D8BCFA" title="Write it by hand" sub="Name, slots, ingredients and steps" />
      </button>
      <button type="button" className="big-opt" onClick={() => openSheet({ type: 'paste' })}>
        <Option icon={ClipboardText} bg="rgba(46,91,219,.25)" color="#B8C9FF" title="Paste recipe text" sub="From a note, message or website. Read on-device." />
      </button>
      <label className="big-opt">
        <input type="file" accept=".json,.txt,application/json,text/plain" onChange={onFile} hidden />
        <Option icon={FileArrowDown} bg="rgba(15,157,118,.25)" color="#7FE6C6" title="Import a file" sub=".json from another Fridge Follower, or .txt" />
      </label>
    </div>
  );
}

export function PasteSheet() {
  const openEditor = useOpenEditor();
  const [text, setText] = useState('');
  const read = async () => {
    const p = parseRecipeText(text);
    if (!p) return toast('Paste some recipe text first');
    const draft = draftFromParsed(p, 'pasted text', await db.items.toArray());
    openEditor(draft);
    toast(`Found ${draft.ings.length} ingredients and ${p.steps.length} steps`);
  };
  return (
    <div className="sheet__body" style={{ gap: 12 }}>
      <div className="sheet__head">
        <span className="sheet__title">Paste recipe text</span>
        <button
          type="button"
          onClick={() => setText(SAMPLE_RECIPE)}
          style={{ height: 34, padding: '0 12px', borderRadius: 10, border: 0, background: 'rgba(255,255,255,.07)', color: 'var(--text-soft)', font: '600 12px var(--ui)', cursor: 'pointer' }}
        >
          Try a sample
        </button>
      </div>
      <textarea
        autoFocus
        aria-label="Recipe text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Title on the first line, then ingredients and steps. Headings like Ingredients and Steps help."
        style={{
          width: '100%',
          height: 240,
          borderRadius: 18,
          border: '1px solid rgba(255,255,255,.08)',
          background: 'var(--well)',
          color: 'var(--text)',
          font: '15px/1.5 var(--ui)',
          padding: 14,
          outline: 'none',
          resize: 'none',
        }}
      />
      <button type="button" className="btn-cta btn-cta--violet" disabled={!text.trim()} onClick={read}>
        <MagicWand weight="duotone" style={{ fontSize: 19 }} />
        Read recipe
      </button>
    </div>
  );
}

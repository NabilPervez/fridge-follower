import { useEffect } from 'react';
import { useUI } from '../state/ui';
import { SlotSheet } from './SlotSheet';
import { LevelSheet } from './LevelSheet';
import { AddSheet } from './AddSheet';
import { NewRecipeSheet, PasteSheet } from './RecipeSheets';
import { AddPlanSheet } from './AddPlanSheet';
import { ReasonSheet } from './ReasonSheet';
import { RestoreSheet } from './RestoreSheet';

export function SheetHost() {
  const sheet = useUI((s) => s.sheet);
  const close = useUI((s) => s.closeSheet);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet, close]);

  if (!sheet) return null;
  return (
    <div className="sheet">
      <button type="button" className="sheet__scrim" aria-label="Close" onClick={close} />
      <div className="sheet__panel" role="dialog" aria-modal="true">
        <div className="sheet__grab">
          <span />
        </div>
        {sheet.type === 'slot' && <SlotSheet key={`${sheet.date}|${sheet.slot}`} date={sheet.date} slot={sheet.slot} />}
        {sheet.type === 'level' && <LevelSheet key={sheet.itemId} itemId={sheet.itemId} />}
        {sheet.type === 'add' && <AddSheet mode={sheet.mode} />}
        {sheet.type === 'newRecipe' && <NewRecipeSheet />}
        {sheet.type === 'paste' && <PasteSheet />}
        {sheet.type === 'addPlan' && <AddPlanSheet recipeId={sheet.recipeId} />}
        {sheet.type === 'reason' && <ReasonSheet shopId={sheet.shopId} />}
        {sheet.type === 'restore' && <RestoreSheet preview={sheet.preview} fileName={sheet.fileName} />}
      </div>
    </div>
  );
}

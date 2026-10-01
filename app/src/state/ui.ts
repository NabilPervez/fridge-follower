import { create } from 'zustand';
import type { Location, Slot } from '../data/db';
import type { RecipeDraft } from '../data/actions';
import type { BackupPreview } from '../data/backup';

export type Sheet =
  | { type: 'slot'; date: string; slot: Slot }
  | { type: 'level'; itemId: string }
  | { type: 'add'; mode: 'inv' | 'shop' }
  | { type: 'newRecipe' }
  | { type: 'paste' }
  | { type: 'addPlan'; recipeId: string }
  | { type: 'reason'; shopId: string }
  | { type: 'restore'; preview: BackupPreview; fileName: string };

export interface Toast {
  id: number;
  msg: string;
  undo?: () => void | Promise<void>;
}

interface UIState {
  sheet: Sheet | null;
  toast: Toast | null;
  /** Fridge filters survive tab switches. */
  loc: Location;
  q: string;
  lowOnly: boolean;
  /** Plan: selected day. Null means today. */
  planDay: string | null;
  recQ: string;
  recFilter: string;
  cartOpen: boolean;
  /** Draft carried from an import into the editor. */
  draft: RecipeDraft | null;

  openSheet: (s: Sheet) => void;
  closeSheet: () => void;
  showToast: (msg: string, undo?: Toast['undo']) => void;
  hideToast: () => void;
  set: (p: Partial<UIState>) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
let toastSeq = 0;

export const useUI = create<UIState>((set) => ({
  sheet: null,
  toast: null,
  loc: 'fridge',
  q: '',
  lowOnly: false,
  planDay: null,
  recQ: '',
  recFilter: 'all',
  cartOpen: true,
  draft: null,

  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
  showToast: (msg, undo) => {
    clearTimeout(toastTimer);
    set({ toast: { id: ++toastSeq, msg, undo } });
    // Undo stays available for 5 s (PRD R6).
    toastTimer = setTimeout(() => set({ toast: null }), 5000);
  },
  hideToast: () => {
    clearTimeout(toastTimer);
    set({ toast: null });
  },
  set: (p) => set(p),
}));

export const toast = (msg: string, undo?: Toast['undo']) => useUI.getState().showToast(msg, undo);

export function vibrate() {
  try {
    navigator.vibrate?.(10);
  } catch {
    /* not supported */
  }
}

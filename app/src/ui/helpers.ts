import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { BowlFood, Cookie, Cube, Grains, MoonStars, OrangeSlice, Pepper, Snowflake, SunHorizon, type Icon } from '@phosphor-icons/react';
import type { Location, Slot } from '../data/db';
import { JEWEL, rgba, type Jewel } from '../domain/constants';

export const SLOT_ICON: Record<Slot, Icon> = {
  breakfast: SunHorizon,
  snack1: OrangeSlice,
  lunch: BowlFood,
  snack2: Cookie,
  dinner: MoonStars,
};
export const LOC_ICON: Record<Location, Icon> = { fridge: Snowflake, freezer: Cube, pantry: Grains, spice: Pepper };

/** Selected/unselected chip colours tinted by a jewel. */
export function chipStyle(on: boolean, j: Jewel = 'sapphire'): CSSProperties {
  const [base, tint] = JEWEL[j];
  return {
    background: on ? rgba(base, 0.3) : 'rgba(255,255,255,.04)',
    color: on ? '#fff' : '#C8C5DE',
    borderColor: on ? rgba(tint, 0.55) : 'rgba(255,255,255,.1)',
  };
}

/** Goes back in history, or to `fallback` when the page was opened directly. */
export function useBack(fallback = '/') {
  const navigate = useNavigate();
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };
}

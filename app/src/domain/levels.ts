import type { Item, Level } from '../data/db';
import { LEVEL_BASE, LEVEL_NAME, LEVEL_RANK, LEVEL_TINT, LEVELS, rgba } from './constants';

/** Step a level down (+1) or up (-1). Returns null at the ends of the scale. */
export function stepLevel(level: Level, dir: 1 | -1): Level | null {
  const i = LEVELS.indexOf(level) + dir;
  return i < 0 || i >= LEVELS.length ? null : LEVELS[i];
}

export const isLow = (item: Pick<Item, 'level' | 'lowThreshold'>) =>
  LEVEL_RANK[item.level] <= LEVEL_RANK[item.lowThreshold ?? 'low'];

/** Visual props for the horizontal level meter. */
export function meter(level: Level) {
  const c = LEVEL_BASE[level];
  return {
    width: `${(LEVEL_RANK[level] / 4) * 100}%`,
    fill: `linear-gradient(90deg,${rgba(c, 0.55)},${LEVEL_TINT[level]})`,
    glow: `0 0 10px ${rgba(c, 0.7)}`,
    label: LEVEL_NAME[level].toUpperCase(),
    labelColor: LEVEL_TINT[level],
  };
}

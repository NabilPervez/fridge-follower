import type { Item, Level } from '../data/db';
import { regenerateShopping, setLevel, stepItem } from '../data/actions';
import { LEVEL_NAME } from '../domain/constants';
import { toast, vibrate } from './ui';

/** Actions that report back through the toast, with Undo. */

export async function changeLevel(item: Item, to: Level) {
  if (item.level === to) return;
  vibrate();
  const rec = await setLevel(item.id, to);
  toast(`${item.name} → ${LEVEL_NAME[to]}`, rec.undo);
}

export async function step(item: Item, dir: 1 | -1) {
  vibrate();
  const r = await stepItem(item, dir);
  if (!r) return toast(`${item.name} is already ${LEVEL_NAME[item.level]}`);
  toast(`${item.name} → ${LEVEL_NAME[r.to]}`, r.rec.undo);
}

export async function regenerate(today: string, quiet = false) {
  const { rec, toBuy } = await regenerateShopping(today);
  if (!quiet) toast(`List updated · ${toBuy} to buy`, rec.undo);
}

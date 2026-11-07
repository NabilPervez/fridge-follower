// Family Table household sync (Family Table S5). Fridge Follower stays local-first; this layer
// pushes fridge levels to Family Table's API and pulls the week's grocery list from it.
// Contract: family-table/docs/sync.md. Config lives in the settings table under "household".
import { db, type Item, type Level } from './db';

export const FT_URL = 'https://family-table-2czd.netlify.app';

export interface HouseholdCfg { token: string; householdId: string; cursor: number; lastSync?: number }
export interface FtGrocery { id: string; weekStart: string; key: string; name: string; checked: boolean; manual?: boolean; deleted?: boolean; updatedAt: number; updatedBy?: string }
interface Row<T> { table: string; row: T }

const get = async <T,>(key: string, fallback: T): Promise<T> => ((await db.settings.get(key))?.value as T) ?? fallback;
const put = (key: string, value: unknown) => db.settings.put({ key, value });

/** Same key rule as Family Table's grocery list, so names match across apps. */
export const itemKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function toFridgeRows(items: Pick<Item, 'name' | 'level' | 'updatedAt'>[]): Row<{ id: string; key: string; name: string; level: Level; updatedAt: number }>[] {
  return items.map((i) => {
    const key = itemKey(i.name);
    return { table: 'fridge', row: { id: key, key, name: i.name, level: i.level, updatedAt: Date.parse(i.updatedAt) || Date.now() } };
  });
}

/** Keep the newest copy of each Family Table grocery row. */
export function mergeGroceries(cur: Record<string, FtGrocery>, rows: Row<FtGrocery>[]): Record<string, FtGrocery> {
  const out = { ...cur };
  for (const { table, row } of rows) {
    if (table !== 'groceryItems') continue;
    if (!out[row.id] || row.updatedAt > out[row.id].updatedAt) out[row.id] = row;
  }
  return out;
}

export const getHousehold = () => get<HouseholdCfg | null>('household', null);

export async function joinHousehold(code: string, passphrase: string) {
  const res = await fetch(`${FT_URL}/api/sync/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, passphrase }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Could not join (${res.status})`);
  await put('household', { token: body.token, householdId: body.householdId, cursor: 0 } satisfies HouseholdCfg);
  await syncHousehold(true);
}
export const leaveHousehold = async () => { await put('household', null); await put('ftGroceries', {}); };

let running = false;
let timer: ReturnType<typeof setTimeout> | undefined;
/** Push fridge levels (all items on first run, else changed since last sync), then pull grocery rows. */
export async function syncHousehold(all = false): Promise<string | null> {
  const cfg = await getHousehold();
  if (!cfg?.token || running || !navigator.onLine) return null;
  running = true;
  try {
    const auth = { authorization: `Bearer ${cfg.token}` };
    const since = all || !cfg.lastSync ? '' : new Date(cfg.lastSync - 60_000).toISOString();
    const items = (await db.items.toArray()).filter((i) => !since || i.updatedAt >= since);
    if (items.length) {
      const r = await fetch(`${FT_URL}/api/sync/fridge`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ rows: toFridgeRows(items) }) });
      if (!r.ok) throw new Error(r.status === 401 ? 'Join your household again' : `Sync failed (${r.status})`);
    }
    const res = await fetch(`${FT_URL}/api/sync?since=${cfg.cursor || 0}`, { headers: auth });
    if (!res.ok) throw new Error(res.status === 401 ? 'Join your household again' : `Sync failed (${res.status})`);
    const { rows, now } = (await res.json()) as { rows: Row<FtGrocery>[]; now: number };
    await put('ftGroceries', mergeGroceries(await get('ftGroceries', {}), rows));
    await put('household', { ...cfg, cursor: now, lastSync: Date.now() });
    return null;
  } catch (e) {
    return (e as Error).message;
  } finally {
    running = false;
  }
}

/** Check off a Family Table grocery item; Family Table sees it on its next sync. */
export async function toggleFtGrocery(g: FtGrocery) {
  const cfg = await getHousehold();
  const row: FtGrocery = { ...g, checked: !g.checked, updatedAt: Date.now(), updatedBy: 'Fridge Follower' };
  await put('ftGroceries', { ...(await get<Record<string, FtGrocery>>('ftGroceries', {})), [row.id]: row });
  if (!cfg?.token) return;
  await fetch(`${FT_URL}/api/sync`, { method: 'POST', headers: { authorization: `Bearer ${cfg.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ rows: [{ table: 'groceryItems', row }] }) }).catch(() => undefined);
}

/** Start background sync: on item writes (debounced), when back online, on focus, every 60s. */
export function startHouseholdSync() {
  const soon = () => { clearTimeout(timer); timer = setTimeout(() => void syncHousehold(), 2000); };
  db.items.hook('creating', () => { soon(); });
  db.items.hook('updating', () => { soon(); });
  addEventListener('online', soon);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') soon(); });
  setInterval(() => { if (document.visibilityState === 'visible') void syncHousehold(); }, 60_000);
  soon();
}

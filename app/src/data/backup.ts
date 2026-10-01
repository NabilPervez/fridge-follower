import { db, nowIso, TABLES, type TableName } from './db';
import { todayKey } from '../domain/dates';

export const SCHEMA_VERSION = 1;

/** Everything except the level history by default (PRD §5.6: it can grow large). */
const BACKUP_TABLES = TABLES.filter((t) => t !== 'levelEvents');

export interface Backup {
  app: 'fridge-follower';
  schemaVersion: number;
  exportedAt: string;
  [table: string]: unknown;
}

export async function buildBackup(includeHistory = false): Promise<Backup> {
  const tables = includeHistory ? TABLES : BACKUP_TABLES;
  const out: Backup = { app: 'fridge-follower', schemaVersion: SCHEMA_VERSION, exportedAt: nowIso() };
  for (const t of tables) out[t] = await db.table(t).toArray();
  return out;
}

export const backupFileName = () => `fridge-follower-backup-${todayKey()}.json`;

/** Shares the backup file where supported (Android), otherwise downloads it. */
export async function exportBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const data = await buildBackup();
  const name = backupFileName();
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
      // fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

export interface BackupPreview {
  backup: Backup;
  counts: Partial<Record<TableName, number>>;
}

/** Validates a parsed file. Throws with a readable message when it isn't a usable backup. */
export function validateBackup(data: unknown): BackupPreview {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error("That file isn't a Fridge Follower backup.");
  const b = data as Backup;
  if (typeof b.schemaVersion !== 'number') throw new Error("That file isn't a Fridge Follower backup.");
  if (b.schemaVersion > SCHEMA_VERSION) throw new Error('That backup is from a newer version of the app.');
  const counts: BackupPreview['counts'] = {};
  for (const t of TABLES) {
    if (b[t] === undefined) continue;
    if (!Array.isArray(b[t])) throw new Error(`The backup's ${t} section is damaged.`);
    const rows = b[t] as Record<string, unknown>[];
    const key = t === 'settings' ? 'key' : 'id';
    if (rows.some((r) => !r || typeof r !== 'object' || typeof r[key] !== 'string')) throw new Error(`The backup's ${t} section is damaged.`);
    counts[t] = rows.length;
  }
  if (!('items' in counts) && !('recipes' in counts)) throw new Error("That file isn't a Fridge Follower backup.");
  return { backup: b, counts };
}

/**
 * Replace wipes every table first. Merge keeps existing rows and takes the
 * backup's row only when it is newer (by updatedAt) or missing locally.
 * Runs in one transaction, so a failure leaves the current data untouched.
 */
export async function restoreBackup(backup: Backup, mode: 'replace' | 'merge') {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      const rows = backup[t] as Record<string, unknown>[] | undefined;
      if (mode === 'replace' && (rows || t !== 'levelEvents')) await db.table(t).clear();
      if (!rows) continue;
      if (mode === 'replace') {
        await db.table(t).bulkPut(rows);
        continue;
      }
      for (const row of rows) {
        const key = (t === 'settings' ? row.key : row.id) as string;
        const local = (await db.table(t).get(key)) as Record<string, unknown> | undefined;
        if (!local || String(row.updatedAt ?? '') > String(local.updatedAt ?? '')) await db.table(t).put(row);
      }
    }
  });
}

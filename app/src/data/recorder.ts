import Dexie from 'dexie';
import { db, TABLES, type TableName } from './db';

type Row = { id?: string; key?: string } & Record<string, unknown>;
const pk = (table: TableName, row: Row) => (table === 'settings' ? row.key : row.id) as string;

/**
 * Wraps writes in one transaction and remembers the prior state of every row
 * touched, so the whole action can be undone in one step.
 */
export class Recorder {
  private before = new Map<string, { table: TableName; key: string; row: Row | undefined }>();

  /**
   * Returns a Dexie promise, or nothing when the row is already remembered.
   * Never await a promise that does no IndexedDB work inside a Dexie
   * transaction: the transaction can auto-commit underneath it.
   */
  private remember(table: TableName, key: string) {
    const k = `${table}:${key}`;
    if (this.before.has(k)) return;
    this.before.set(k, { table, key, row: undefined });
    return db
      .table(table)
      .get(key)
      .then((row: Row | undefined) => {
        this.before.get(k)!.row = row;
      });
  }

  /** Remember the rows, then run the write, as one Dexie promise chain. */
  private chain<T>(table: TableName, keys: string[], write: () => PromiseLike<T>) {
    const reads = keys.map((k) => this.remember(table, k)).filter((p) => !!p);
    return reads.length ? Dexie.Promise.all(reads).then(write) : write();
  }

  put<T>(table: TableName, row: T) {
    return this.chain(table, [pk(table, row as Row)], () => db.table(table).put(row));
  }

  bulkPut<T>(table: TableName, rows: T[]) {
    return this.chain(table, rows.map((r) => pk(table, r as Row)), () => db.table(table).bulkPut(rows));
  }

  update(table: TableName, key: string, changes: Record<string, unknown>) {
    return this.chain(table, [key], () => db.table(table).update(key, changes));
  }

  delete(table: TableName, key: string) {
    return this.chain(table, [key], () => db.table(table).delete(key));
  }

  bulkDelete(table: TableName, keys: string[]) {
    return this.chain(table, keys, () => db.table(table).bulkDelete(keys));
  }

  get touched() {
    return this.before.size;
  }

  /** Restores every remembered row. */
  undo = async () => {
    const snapshot = [...this.before.values()];
    await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
      for (const { table, key, row } of snapshot) {
        if (row) await db.table(table).put(row);
        else await db.table(table).delete(key);
      }
    });
  };
}

/** Run `fn` in a read-write transaction over all tables; returns an undo function. */
export async function record(fn: (rec: Recorder) => Promise<void>): Promise<Recorder> {
  const rec = new Recorder();
  await db.transaction('rw', TABLES.map((t) => db.table(t)), () => fn(rec));
  return rec;
}

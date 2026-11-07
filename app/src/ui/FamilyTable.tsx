// Family Table link: household join in Settings, and the shared grocery list on Shop.
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowSquareOut, Check, UsersThree } from '@phosphor-icons/react';
import { db } from '../data/db';
import { FT_URL, joinHousehold, leaveHousehold, syncHousehold, toggleFtGrocery, type FtGrocery, type HouseholdCfg } from '../data/household';
import { toast } from '../state/ui';

const useSetting = <T,>(key: string, fallback: T) => useLiveQuery(async () => ((await db.settings.get(key))?.value as T) ?? fallback, [key], fallback);

export function FamilyTableSettings() {
  const cfg = useSetting<HouseholdCfg | null>('household', null);
  const [code, setCode] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  if (cfg?.token) {
    return (
      <div className="glass list">
        <div className="set-row" style={{ flexWrap: 'wrap' }}>
          <UsersThree weight="duotone" style={{ color: 'var(--emerald-t, #3fd1a6)' }} />
          <span style={{ flex: 1 }}>
            Family Table · <b>{cfg.householdId}</b>
            <span style={{ display: 'block', fontSize: 14, color: 'var(--text-soft)' }}>
              {cfg.lastSync ? `Synced ${new Date(cfg.lastSync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Waiting to sync'}
            </span>
          </span>
          <button type="button" className="btn-soft" onClick={async () => { const e = await syncHousehold(); toast(e ?? 'Synced'); }}>Sync</button>
          <button type="button" className="btn-soft" onClick={async () => { await leaveHousehold(); toast('Left household'); }}>Leave</button>
        </div>
      </div>
    );
  }
  return (
    <div className="glass list" style={{ padding: 14, display: 'grid', gap: 10 }}>
      <span style={{ font: '600 16px var(--ui)' }}>Share with Family Table</span>
      <span style={{ fontSize: 14, color: 'var(--text-soft)', lineHeight: 1.4 }}>Use the same household code and passphrase as Family Table. Your fridge levels go there; its grocery list shows up on Shop.</span>
      <input className="input" placeholder="Household code" autoComplete="username" value={code} onChange={(e) => setCode(e.target.value)} />
      <input className="input" type="password" placeholder="Passphrase" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} />
      <button type="button" className="btn-cta" disabled={busy || !code || !pass} onClick={async () => {
        setBusy(true);
        try { await joinHousehold(code, pass); setPass(''); toast('Joined household'); } catch (e) { toast((e as Error).message); }
        setBusy(false);
      }}>{busy ? 'Joining…' : 'Join household'}</button>
    </div>
  );
}

/** Grocery items planned in Family Table for the current week(s). */
export function FamilyTableShop() {
  const cfg = useSetting<HouseholdCfg | null>('household', null);
  const rows = useSetting<Record<string, FtGrocery>>('ftGroceries', {});
  const [weekAgo] = useState(() => new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10));
  useEffect(() => { if (cfg?.token) void syncHousehold(); }, [cfg?.token]);
  if (!cfg?.token) return null;
  const list = Object.values(rows).filter((r) => !r.deleted && r.weekStart >= weekAgo).sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name));
  return (
    <section className="group">
      <div className="group__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="section-label">From Family Table</span>
        <a href={`${FT_URL}/#/groceries`} target="_blank" rel="noreferrer" className="section-label" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', minHeight: 44 }}>Open <ArrowSquareOut /></a>
      </div>
      <div className="glass list">
        {!list.length && <div className="shop-row" style={{ color: 'var(--text-soft)', paddingLeft: 14 }}>Nothing planned yet.</div>}
        {list.map((r) => (
          <div key={r.id} className="shop-row">
            <button type="button" className="check" aria-label={`${r.checked ? 'Uncheck' : 'Check'} ${r.name}`} onClick={() => void toggleFtGrocery(r)}>
              <span className={r.checked ? 'check__box check__box--on' : 'check__box'}>{r.checked && <Check weight="bold" />}</span>
            </button>
            <span className="ellipsis" style={{ font: '500 16px var(--ui)', flex: 1, textDecoration: r.checked ? 'line-through' : undefined, opacity: r.checked ? 0.6 : 1 }}>{r.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import {
  CalendarBlank,
  CaretRight,
  CloudWarning,
  DownloadSimple,
  Fire,
  Package,
  Palette,
  ShieldCheck,
  ShieldWarning,
  Trash,
  UploadSimple,
} from '@phosphor-icons/react';
import { useKitchen, useSettings, useToday } from '../data/hooks';
import { resetAll, setSetting } from '../data/actions';
import { exportBackup, validateBackup } from '../data/backup';
import { loadStarterPack } from '../data/starter';
import { BACKUP_REMINDER_DAYS, type Settings as S } from '../data/settings';
import { toast, useUI } from '../state/ui';
import { BackButton, Toggle } from '../ui/kit';

const DAY_MS = 86_400_000;

function ago(iso: string | null) {
  if (!iso) return 'Never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
}

function Seg<T extends string>({ opts, value, onPick, label }: { opts: T[]; value: T; onPick: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {opts.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onPick(o)}
          style={{ background: value === o ? 'rgba(255,255,255,.14)' : 'transparent', color: value === o ? '#fff' : '#A9A6C4' }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function Settings() {
  const s = useSettings();
  const today = useToday();
  const kitchen = useKitchen();
  const openSheet = useUI((x) => x.openSheet);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [resetArm, setResetArm] = useState(false);
  const [now] = useState(() => Date.now());
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted);
  }, []);
  useEffect(() => {
    if (!resetArm) return;
    const t = setTimeout(() => setResetArm(false), 3000);
    return () => clearTimeout(t);
  }, [resetArm]);

  const hasData = !!kitchen && (kitchen.items.length > 0 || kitchen.recipes.length > 0);
  const backupDue = hasData && (!s.lastBackup || now - new Date(s.lastBackup).getTime() > BACKUP_REMINDER_DAYS * DAY_MS);

  const backup = async () => {
    try {
      const r = await exportBackup();
      if (r === 'cancelled') return;
      await setSetting('lastBackup', new Date().toISOString());
      toast(r === 'shared' ? 'Backup shared' : 'Backup saved to Downloads');
    } catch {
      toast("Couldn't create the backup");
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const preview = validateBackup(JSON.parse(await f.text()));
      openSheet({ type: 'restore', preview, fileName: f.name });
    } catch (err) {
      toast(err instanceof SyntaxError ? "That file isn't valid JSON." : (err as Error).message);
    }
  };

  const persist = async () => {
    if (persisted || !navigator.storage?.persist) return;
    const ok = await navigator.storage.persist();
    setPersisted(ok);
    toast(ok ? 'Storage is now persistent' : 'The browser declined. Installing the app usually helps.');
  };

  return (
    <>
      <header className="page-head page-head--back" style={{ justifyContent: 'flex-start', gap: 4, paddingRight: 22 }}>
        <BackButton fallback="/" />
        <h1 className="title" style={{ paddingLeft: 6 }}>
          Settings
        </h1>
      </header>
      <main className="scroll" style={{ gap: 16, paddingTop: 12 }}>
        {backupDue && (
          <div className="reminder">
            <div style={{ display: 'flex', gap: 12 }}>
              <CloudWarning weight="duotone" style={{ color: 'var(--topaz-t)', fontSize: 24, flex: '0 0 auto' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ font: '600 16px var(--ui)' }}>{s.lastBackup ? `Last backup ${ago(s.lastBackup).toLowerCase()}` : 'No backup yet'}</span>
                <span style={{ fontSize: 14, color: 'var(--text-soft)', lineHeight: 1.4 }}>
                  Your data lives only on this phone. Clearing browser data erases it.
                </span>
              </div>
            </div>
            <button type="button" onClick={backup}>
              Back up now
            </button>
          </div>
        )}

        <div className="glass list">
          <div className="set-row">
            <Palette weight="duotone" style={{ color: 'var(--amethyst-t)' }} />
            <span style={{ flex: 1 }}>Theme</span>
            <Seg<S['theme']>
              label="Theme"
              opts={['System', 'Dark', 'Light']}
              value="Dark"
              onPick={(v) => v !== 'Dark' && toast('Only the dark theme is available for now')}
            />
          </div>
          <div className="set-row">
            <CalendarBlank weight="duotone" style={{ color: 'var(--sapphire-t)' }} />
            <span style={{ flex: 1 }}>Week starts on</span>
            <Seg<S['weekStart']> label="Week starts on" opts={['Mon', 'Sun']} value={s.weekStart} onPick={(v) => setSetting('weekStart', v)} />
          </div>
          <button
            type="button"
            className="set-row"
            role="switch"
            aria-checked={s.cookDecrements}
            style={{ minHeight: 66, padding: '8px 12px 8px 16px' }}
            onClick={() => setSetting('cookDecrements', !s.cookDecrements)}
          >
            <Fire weight="duotone" style={{ color: 'var(--topaz-t)' }} />
            <span className="set-row__text">
              <span>Cooking lowers inventory</span>
              <span className="set-row__sub">Marking a meal cooked steps its ingredients down</span>
            </span>
            <Toggle on={s.cookDecrements} />
          </button>
        </div>

        <div className="glass list">
          <button type="button" className="set-row" style={{ paddingRight: 16 }} onClick={backup}>
            <DownloadSimple weight="duotone" style={{ color: 'var(--emerald-t)' }} />
            <span style={{ flex: 1 }}>Back up now</span>
            <span className="set-row__aside">{ago(s.lastBackup)}</span>
          </button>
          <button type="button" className="set-row" style={{ paddingRight: 16 }} onClick={() => fileRef.current?.click()}>
            <UploadSimple weight="duotone" style={{ color: 'var(--sapphire-t)' }} />
            <span style={{ flex: 1 }}>Restore from file</span>
            <CaretRight weight="bold" style={{ color: 'var(--text-dim)' }} />
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFile} />
          <button type="button" className="set-row" style={{ paddingRight: 16, cursor: persisted ? 'default' : 'pointer' }} onClick={persist}>
            {persisted ? (
              <ShieldCheck weight="duotone" style={{ color: 'var(--emerald-t)' }} />
            ) : (
              <ShieldWarning weight="duotone" style={{ color: 'var(--topaz-t)' }} />
            )}
            <span style={{ flex: 1 }}>Storage</span>
            <span className="set-row__aside" style={{ color: persisted ? 'var(--emerald-t)' : 'var(--topaz-t)' }}>
              {persisted === null ? 'Checking…' : persisted ? 'Persistent' : 'Best-effort · tap to ask'}
            </span>
          </button>
          <button
            type="button"
            className="set-row"
            style={{ paddingRight: 16 }}
            onClick={async () => {
              const { rec, added } = await loadStarterPack(today);
              const n = added.items + added.recipes + added.meals;
              toast(n ? `Added ${added.items} items, ${added.recipes} recipes and ${added.meals} meals` : 'Starter pack is already loaded', n ? rec.undo : undefined);
            }}
          >
            <Package weight="duotone" style={{ color: 'var(--amethyst-t)' }} />
            <span style={{ flex: 1 }}>Load starter pack</span>
            <CaretRight weight="bold" style={{ color: 'var(--text-dim)' }} />
          </button>
        </div>

        <div className="glass list">
          <button
            type="button"
            className="set-row"
            style={{ color: 'var(--ruby-t)', paddingRight: 16 }}
            onClick={async () => {
              if (!resetArm) return setResetArm(true);
              setResetArm(false);
              await resetAll();
              toast('All data erased');
            }}
          >
            <Trash weight="duotone" />
            <span style={{ flex: 1 }}>{resetArm ? 'Tap again to erase everything' : 'Reset all data'}</span>
          </button>
        </div>
        <span className="hint">Fridge Follower {__APP_VERSION__} · All data stays on this device</span>
      </main>
    </>
  );
}

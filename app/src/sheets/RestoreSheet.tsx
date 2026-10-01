import { useState } from 'react';
import { UploadSimple } from '@phosphor-icons/react';
import { restoreBackup, type BackupPreview } from '../data/backup';
import { toast, useUI } from '../state/ui';

const LABELS: [string, string][] = [
  ['items', 'items'],
  ['recipes', 'recipes'],
  ['plan', 'planned meals'],
  ['shopping', 'shopping rows'],
];

/** Preview a backup's counts, then Replace or Merge (PRD §5.6). */
export function RestoreSheet({ preview, fileName }: { preview: BackupPreview; fileName: string }) {
  const close = useUI((s) => s.closeSheet);
  const [mode, setMode] = useState<'replace' | 'merge'>('merge');
  const [busy, setBusy] = useState(false);
  const when = typeof preview.backup.exportedAt === 'string' ? new Date(preview.backup.exportedAt).toLocaleString() : 'unknown date';

  const run = async () => {
    setBusy(true);
    try {
      await restoreBackup(preview.backup, mode);
      close();
      toast(mode === 'replace' ? 'Backup restored' : 'Backup merged');
    } catch {
      setBusy(false);
      toast('Restore failed. Your current data was not changed.');
    }
  };

  return (
    <div className="sheet__body">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 4px' }}>
        <span className="sheet__title">Restore backup</span>
        <span className="ellipsis" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {fileName} · {when}
        </span>
      </div>
      <div className="list" style={{ background: 'var(--well-2)', borderRadius: 20 }}>
        {LABELS.map(([k, n]) => (
          <div key={k} className="set-row" style={{ minHeight: 48 }}>
            <span style={{ flex: 1 }}>{n}</span>
            <span className="set-row__aside" style={{ color: 'var(--text)' }}>
              {preview.counts[k as keyof BackupPreview['counts']] ?? 0}
            </span>
          </div>
        ))}
      </div>
      <div className="seg" role="radiogroup" aria-label="Restore mode" style={{ padding: 4 }}>
        {(
          [
            ['merge', 'Merge', 'Newer wins'],
            ['replace', 'Replace', 'Erase first'],
          ] as const
        ).map(([k, n, sub]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={mode === k}
            onClick={() => setMode(k)}
            style={{
              flex: '1 1 0',
              height: 52,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              background: mode === k ? 'rgba(255,255,255,.14)' : 'transparent',
              color: mode === k ? '#fff' : '#A9A6C4',
            }}
          >
            {n}
            <span style={{ font: '400 11px var(--ui)', opacity: 0.8 }}>{sub}</span>
          </button>
        ))}
      </div>
      {mode === 'replace' && (
        <span style={{ fontSize: 13, color: 'var(--ruby-t)', padding: '0 4px' }}>Everything on this phone will be replaced by the backup.</span>
      )}
      <button type="button" className="btn-cta" disabled={busy} onClick={run} style={mode === 'replace' ? { background: 'var(--ruby)', color: '#fff' } : undefined}>
        <UploadSimple weight="bold" style={{ fontSize: 19 }} />
        {mode === 'replace' ? 'Replace my data' : 'Merge into my data'}
      </button>
    </div>
  );
}

import { Broom, CaretLeft, CaretRight, ClockCounterClockwise, CopySimple } from '@phosphor-icons/react';
import { useKitchen, usePlan, useSettings, useToday } from '../data/hooks';
import { clearDay, copyDay, copyLastWeek } from '../data/actions';
import { addDays, dayInfo, rangeLabel, weekDays, weekStartOf } from '../domain/dates';
import { SLOTS } from '../domain/constants';
import { toast, useUI } from '../state/ui';
import { IconButton } from '../ui/kit';
import { SlotList } from './SlotList';

export function Plan() {
  const today = useToday();
  const kitchen = useKitchen();
  const plan = usePlan();
  const settings = useSettings();
  const planDay = useUI((s) => s.planDay);
  const set = useUI((s) => s.set);
  const day = planDay ?? today;
  const start = weekStartOf(day, settings.weekStart);
  const days = weekDays(start);
  const count = (d: string) => (plan ? SLOTS.filter((sl) => plan.some((e) => e.date === d && e.slot === sl.k)).length : 0);
  const info = dayInfo(day);
  const pick = (d: string) => set({ planDay: d === today ? null : d });

  const onCopyNext = async () => {
    const next = addDays(day, 1);
    const { rec, n } = await copyDay(day, next);
    if (!n) return toast('Nothing to copy');
    pick(next);
    toast(`Copied ${n} meal${n > 1 ? 's' : ''} to ${dayInfo(next).dow}`, async () => {
      await rec.undo();
      pick(day);
    });
  };
  const onCopyWeek = async () => {
    const { rec, n } = await copyLastWeek(days, today);
    if (!n) return toast(days[6] < today ? 'This week is already over' : 'Nothing to copy from last week, or every slot is filled');
    toast(`Filled ${n} empty slot${n > 1 ? 's' : ''} from last week`, rec.undo);
  };
  const onClear = async () => {
    const { rec, n } = await clearDay(day);
    if (n) toast(`Cleared ${n} meal${n > 1 ? 's' : ''}`, rec.undo);
  };

  return (
    <>
      <header className="page-head">
        <div className="page-head__titles">
          <span className="eyebrow" style={{ color: 'var(--sapphire-t)' }}>
            {rangeLabel(days[0], days[6])}
          </span>
          <h1 className="title">Week plan</h1>
        </div>
        <div className="page-head__actions">
          <IconButton label="Previous week" icon={CaretLeft} weight="bold" size={20} onClick={() => pick(addDays(day, -7))} />
          <IconButton label="Next week" icon={CaretRight} weight="bold" size={20} onClick={() => pick(addDays(day, 7))} />
        </div>
      </header>
      <main className="scroll" style={{ gap: 14, padding: '8px 0 calc(120px + var(--safe-b))' }}>
        <div className="hscroll" style={{ scrollSnapType: 'x mandatory', padding: '4px 16px' }}>
          {days.map((d) => {
            const on = d === day;
            const n = count(d);
            const di = dayInfo(d);
            return (
              <button
                key={d}
                type="button"
                className="day-pill"
                aria-pressed={on}
                aria-label={`${di.label}, ${n} of 5 planned`}
                onClick={() => pick(d)}
                style={{
                  background: on ? 'linear-gradient(160deg,#4A74F0,#2E5BDB)' : 'rgba(255,255,255,.05)',
                  boxShadow: on ? '0 8px 20px rgba(46,91,219,.4)' : 'none',
                  color: on ? '#fff' : '#F3F1FA',
                  borderColor: on ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.06)',
                }}
              >
                <span className="day-pill__dow">{di.dow}</span>
                <span className="day-pill__dom">{di.dom}</span>
                <span className="day-pill__dots">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} style={{ background: i < n ? (on ? '#fff' : '#9DB4FF') : 'rgba(255,255,255,.16)' }} />
                  ))}
                </span>
                {d === today && <span className="today-dot" />}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '0 16px', flexWrap: 'wrap' }}>
          <button type="button" className="btn-soft" onClick={onCopyNext}>
            <CopySimple weight="duotone" />
            Copy to next day
          </button>
          <button type="button" className="btn-soft" onClick={onCopyWeek}>
            <ClockCounterClockwise weight="duotone" />
            Copy last week
          </button>
          <button type="button" className="btn-soft" style={{ color: 'var(--text-muted)' }} onClick={onClear}>
            <Broom weight="duotone" />
            Clear
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '6px 20px 0' }}>
          <span className="section-title">{day === today ? `Today · ${info.label}` : info.label}</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{count(day)} of 5 planned</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px' }}>
          <SlotList date={day} kitchen={kitchen} plan={plan} cookDecrements={settings.cookDecrements} />
        </div>
      </main>
    </>
  );
}

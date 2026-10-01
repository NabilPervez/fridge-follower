/** Local-date helpers. Dates are "YYYY-MM-DD" strings in the device's time zone. */

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => toKey(new Date());

export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export type WeekStart = 'Mon' | 'Sun';

export function weekStartOf(key: string, start: WeekStart): string {
  const d = fromKey(key);
  const dow = d.getDay(); // 0 = Sun
  const back = start === 'Sun' ? dow : (dow + 6) % 7;
  return addDays(key, -back);
}

export const weekDays = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i));

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface DayInfo {
  key: string;
  dow: string;
  dowLong: string;
  dom: number;
  mon: string;
  /** "Wed, Sep 30" */
  label: string;
  /** "Sep 30" */
  short: string;
}

export function dayInfo(key: string): DayInfo {
  const d = fromKey(key);
  const dow = DOW[d.getDay()];
  const mon = MON[d.getMonth()];
  return {
    key,
    dow,
    dowLong: DOW_LONG[d.getDay()],
    dom: d.getDate(),
    mon,
    label: `${dow}, ${mon} ${d.getDate()}`,
    short: `${mon} ${d.getDate()}`,
  };
}

/** "Sep 28 – Oct 4" */
export function rangeLabel(start: string, end: string): string {
  const a = dayInfo(start);
  const b = dayInfo(end);
  return a.mon === b.mon ? `${a.short} – ${b.dom}` : `${a.short} – ${b.short}`;
}

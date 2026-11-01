// All dates are handled as 'YYYY-MM-DD' strings in the configured time zone.
// Arithmetic is done on UTC-noon Date objects so DST and UTC offsets can never shift a day.

export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)!.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    const d = now;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}

export function timeIn(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  } catch {
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

function toUTCNoon(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12));
}

export function fromUTCNoon(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(d: string, n: number): string {
  const x = toUTCNoon(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fromUTCNoon(x);
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUTCNoon(b).getTime() - toUTCNoon(a).getTime()) / 86400000);
}

export function weekday(d: string): number {
  return toUTCNoon(d).getUTCDay();
}

export function isValidDate(d: unknown): d is string {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return fromUTCNoon(toUTCNoon(d)) === d;
}

export function rangeDates(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function formatLong(d: string): string {
  return toUTCNoon(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}
export function formatShort(d: string): string {
  return toUTCNoon(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
export function formatDow(d: string): string {
  return toUTCNoon(d).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}
export const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

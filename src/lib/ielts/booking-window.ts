/** Inclusive rolling two-calendar-month window, using the lesson timezone. */
export function bookingWindow(now = new Date()): { first: string; last: string } {
  const first = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const [year, month, day] = first.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + 2, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return { first, last: target.toISOString().slice(0, 10) };
}

export function isBookableDate(value: unknown, now = new Date()): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const { first, last } = bookingWindow(now);
  return value >= first && value <= last;
}

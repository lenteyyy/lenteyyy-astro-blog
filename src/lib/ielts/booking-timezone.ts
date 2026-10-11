/** Display conversion only: persisted lesson dates and slot keys stay in UTC+8. */
export const bookingTimeZones = [
  { value: 'Asia/Shanghai', label: '东八区（UTC+8）' },
  { value: 'UTC', label: 'UTC（UTC+0）' },
  { value: 'Asia/Singapore', label: '新加坡' },
  { value: 'Asia/Tokyo', label: '日本' },
  { value: 'Europe/London', label: '英国（伦敦）' },
  { value: 'Australia/Sydney', label: '澳大利亚（悉尼）' },
  { value: 'Pacific/Auckland', label: '新西兰（奥克兰）' },
  { value: 'America/New_York', label: '美国（纽约）' },
  { value: 'America/Los_Angeles', label: '美国（洛杉矶）' },
] as const;

export function safeBookingTimeZone(value: unknown): string {
  return bookingTimeZones.some(zone => zone.value === value) ? String(value) : 'Asia/Shanghai';
}

function lessonRange(date: string, time: string): [Date, Date] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const match = time.match(/^(\d{1,2}):(\d{2})–(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, h1, m1, h2, m2] = match.map(Number);
  if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) return null;
  const midnight = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(midnight.getTime()) || midnight.toISOString().slice(0, 10) !== date) return null;
  const start = new Date(midnight.getTime() + (h1 * 60 + m1 - 480) * 60000);
  const end = new Date(midnight.getTime() + (h2 * 60 + m2 - 480 + (h2 * 60 + m2 <= h1 * 60 + m1 ? 1440 : 0)) * 60000);
  return [start, end];
}

function zonedParts(instant: Date, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (name: string) => parts.find(item => item.type === name)?.value || '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}

export function formatBookingRange(date: string, time: string, zone: unknown, compact = false): string {
  const range = lessonRange(date, time);
  if (!range) return `${date} · ${time}`;
  const timeZone = safeBookingTimeZone(zone);
  const [start, end] = range.map(instant => zonedParts(instant, timeZone));
  if (start.date !== end.date) return `${start.date} ${start.time}–${end.date} ${end.time}`;
  return compact && start.date === date ? `${start.time}–${end.time}` : `${start.date} · ${start.time}–${end.time}`;
}

export function bookingTimeComparison(date: string, time: string): string {
  return `UTC：${formatBookingRange(date, time, 'UTC')}\n东八区（UTC+8）：${formatBookingRange(date, time, 'Asia/Shanghai')}`;
}

export function bookingTimeSummary(date: string, time: string, zone: unknown, customTime = ''): string {
  if (time === '其他时间') return `${date} · 其他时间：${customTime}（东八区 UTC+8）`;
  const timeZone = safeBookingTimeZone(zone);
  const comparison = bookingTimeComparison(date, time);
  if (timeZone === 'Asia/Shanghai' || timeZone === 'Asia/Singapore') return comparison.split('\n').reverse().join('\n');
  if (timeZone === 'UTC') return comparison;
  const label = bookingTimeZones.find(item => item.value === timeZone)?.label;
  return `${label}：${formatBookingRange(date, time, timeZone)}\n${comparison}`;
}

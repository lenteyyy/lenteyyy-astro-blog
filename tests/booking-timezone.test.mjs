import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bookingTimeZones, safeBookingTimeZone, formatBookingRange, bookingTimeComparison, bookingTimeSummary } from '../src/lib/ielts/booking-timezone.ts';

test('booking display preserves UTC+8 slot identity while converting to UTC', () => {
  assert.equal(formatBookingRange('2026-10-11', '8:30–10:00', 'UTC'), '2026-10-11 · 00:30–02:00');
  assert.equal(formatBookingRange('2026-10-11', '21:00–22:30', 'UTC'), '2026-10-11 · 13:00–14:30');
  assert.equal(formatBookingRange('2026-10-11', '8:30–10:00', 'Asia/Shanghai', true), '08:30–10:00');
  assert.equal(bookingTimeComparison('2026-10-11', '8:30–10:00'), 'UTC：2026-10-11 · 00:30–02:00\n东八区（UTC+8）：2026-10-11 · 08:30–10:00');
});

test('cross-day and year-boundary conversion retains explicit dates', () => {
  assert.equal(formatBookingRange('2026-01-01', '8:30–10:00', 'America/Los_Angeles', true), '2025-12-31 · 16:30–18:00');
  assert.equal(formatBookingRange('2026-10-11', '21:00–22:30', 'Pacific/Auckland', true), '2026-10-12 · 02:00–03:30');
  assert.equal(formatBookingRange('2026-10-11', '19:00–20:30', 'Pacific/Auckland'), '2026-10-12 · 00:00–01:30');
  assert.equal(formatBookingRange('2026-10-11', '23:30–01:00', 'Asia/Shanghai'), '2026-10-11 23:30–2026-10-12 01:00');
});

test('local offsets follow summer time and transition dates, not fixed country offsets', () => {
  assert.equal(formatBookingRange('2026-07-01', '8:30–10:00', 'Europe/London'), '2026-07-01 · 01:30–03:00');
  assert.equal(formatBookingRange('2026-12-01', '8:30–10:00', 'Europe/London'), '2026-12-01 · 00:30–02:00');
  assert.equal(formatBookingRange('2026-10-25', '8:30–10:00', 'Europe/London'), '2026-10-25 · 01:30–02:00');
  assert.equal(formatBookingRange('2026-07-01', '21:00–22:30', 'Australia/Sydney'), '2026-07-01 23:00–2026-07-02 00:30');
});

test('invalid zone preferences safely fall back and malformed dates do not throw', () => {
  for (const zone of [undefined, '', '<script>', 'Bad/Zone', {}, 'UTC+8']) assert.equal(safeBookingTimeZone(zone), 'Asia/Shanghai');
  for (const zone of bookingTimeZones) assert.equal(safeBookingTimeZone(zone.value), zone.value);
  for (const [date, time] of [['2026-02-30', '8:30–10:00'], ['', '8:30–10:00'], ['2026-10-11', '25:00–26:00'], ['2026-10-11', '8:70–10:00']]) assert.equal(formatBookingRange(date, time, 'UTC'), `${date} · ${time}`);
  assert.equal(bookingTimeSummary('2026-10-11', '其他时间', 'Europe/London', '14:00–15:30'), '2026-10-11 · 其他时间：14:00–15:30（东八区 UTC+8）');
});

test('timezone UI remains display-only, custom requests and mail state their canonical timezone', () => {
  const home = readFileSync(new URL('../src/pages/ielts/index.astro', import.meta.url), 'utf8');
  assert.match(home, /data-booking-timezone/);
  assert.match(home, /UTC／东八区对照/);
  assert.match(home, /日历日期按东八区（UTC\+8）/);
  assert.match(home, /希望的上课时间（东八区 UTC\+8）/);
  assert.match(home, /pendingBookings\.push\(\{ date, time, customTime, subject \}\)/);
  assert.match(home, /const time = page\?\.querySelector<HTMLButtonElement>\('\[data-time\]\.selected'\)\?\.dataset\.time/);
  assert.match(home, /title\.textContent = bookingTimeSummary/);
  assert.match(home, /\.booking-cart :global\(\.booking-cart-row\) \{ display: grid/);
  assert.match(home, /\.booking-list :global\(\.booking-row\) \{ display: grid/);
  const email = readFileSync(new URL('../src/lib/ielts/email.ts', import.meta.url), 'utf8');
  assert.match(email, /日期（东八区 UTC\+8）/);
  assert.match(email, /时间（东八区 UTC\+8）/);
});

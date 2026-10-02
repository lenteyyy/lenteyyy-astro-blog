export type HighlightRange = { start: number; end: number };

/** Store offsets, never saved HTML. Invalid browser storage must not affect rendering. */
export function normalizeHighlights(value: unknown, length: number): HighlightRange[] {
  if (!Array.isArray(value)) return [];
  const ranges = value.slice(0, 500).filter((item): item is HighlightRange =>
    !!item && Number.isInteger(item.start) && Number.isInteger(item.end) &&
    item.start >= 0 && item.end > item.start && item.end <= length,
  ).map(({ start, end }) => ({ start, end })).sort((a, b) => a.start - b.start);
  const merged: HighlightRange[] = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push(range);
  }
  return merged;
}

export function removeHighlight(ranges: HighlightRange[], selection: HighlightRange): HighlightRange[] {
  return ranges.flatMap((range) => {
    if (range.end <= selection.start || range.start >= selection.end) return [range];
    const result: HighlightRange[] = [];
    if (range.start < selection.start) result.push({ start: range.start, end: selection.start });
    if (range.end > selection.end) result.push({ start: selection.end, end: range.end });
    return result;
  });
}

export function splitPercent(value: unknown, available: number, minimum = 280): number {
  const requested = typeof value === 'number' && Number.isFinite(value) ? value : 50;
  if (available < minimum * 2) return 50;
  const limit = minimum / available * 100;
  return Math.min(100 - limit, Math.max(limit, requested));
}

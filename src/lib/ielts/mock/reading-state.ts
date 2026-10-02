export type HighlightColor = 'yellow' | 'blue';
export type HighlightRange = { start: number; end: number; color?: HighlightColor };

export function examFontSize(value: unknown): 16 | 18 | 20 {
  return value === 18 || value === 20 ? value : 16;
}

/** Store offsets, never saved HTML. Invalid browser storage must not affect rendering. */
export function normalizeHighlights(value: unknown, length: number): HighlightRange[] {
  if (!Array.isArray(value)) return [];
  const ranges = value.slice(0, 500).filter((item): item is HighlightRange =>
    !!item && Number.isInteger(item.start) && Number.isInteger(item.end) &&
    item.start >= 0 && item.end > item.start && item.end <= length,
  ).map(({ start, end, color }) => ({ start, end, color: color === 'blue' ? 'blue' as const : 'yellow' as const }));
  // Later selections repaint only their overlap; other colours remain intact.
  let disjoint: HighlightRange[] = [];
  for (const range of ranges) disjoint = [...removeHighlight(disjoint, range), range];
  disjoint.sort((a, b) => a.start - b.start);
  const merged: HighlightRange[] = [];
  for (const range of disjoint) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end && range.color === previous.color) previous.end = Math.max(previous.end, range.end);
    else merged.push(range);
  }
  return merged;
}

export function removeHighlight(ranges: HighlightRange[], selection: HighlightRange): HighlightRange[] {
  return ranges.flatMap((range) => {
    if (range.end <= selection.start || range.start >= selection.end) return [range];
    const result: HighlightRange[] = [];
    if (range.start < selection.start) result.push({ ...range, end: selection.start });
    if (range.end > selection.end) result.push({ ...range, start: selection.end });
    return result;
  });
}

export function splitPercent(value: unknown, available: number, minimum = 280): number {
  const requested = typeof value === 'number' && Number.isFinite(value) ? value : 50;
  if (available < minimum * 2) return 50;
  const limit = minimum / available * 100;
  return Math.min(100 - limit, Math.max(limit, requested));
}

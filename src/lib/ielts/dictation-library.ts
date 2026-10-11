import catalog from './dictation-catalog.json' with { type: 'json' };

export type DictationWord = { id: string; answer: string; category: string; audio: string; acceptedAnswers?: readonly string[] };
export const dictationWords: readonly DictationWord[] = catalog.items;
export const dictationBooks = catalog.books;
export const wordById = new Map(dictationWords.map(word => [word.id, word]));
export const P1_CATEGORIES: Record<string, string> = {
  phone: '电话号码', address: '地址', postcode: '邮编', flight: '航班号', card: '银行卡号',
};
export const DICTATION_RATES = [.75, .9, 1, 1.25, 1.5] as const;
export function defaultDictationRate(bookId: string): number { return bookId === 'p1' ? .9 : 1; }
export function matchAnswer(value: string, word: DictationWord): boolean {
  const normalize = (text: string) => text.slice(0, 128).normalize('NFKC').trim().toLowerCase()
    .replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
  const actual = normalize(value);
  const expected = [word.answer, ...(word.acceptedAnswers ?? [])].map(normalize);
  // Only identifiers allow optional formatting separators; ordinary vocabulary
  // must retain word boundaries ("ice pack" must not match "icepack").
  const compact = (text: string) => text.replace(/[\s-]/g, '');
  return ['phone', 'postcode', 'flight', 'card', 'identifier'].includes(word.category)
    ? expected.some(answer => compact(actual) === compact(answer)) : expected.includes(actual);
}
export function sanitizeWrongIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && wordById.has(id)))].slice(0, dictationWords.length);
}
export function shuffled<T>(items: readonly T[], random: (limit: number) => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = random(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i) throw new RangeError('Invalid shuffle result');
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export class DictationSession {
  private queue: DictationWord[];
  private first = new Set<string>();
  private streaks = new Map<string, number>();
  readonly mistakes = new Set<string>();
  readonly mastered = new Set<string>();
  attempts = 0;
  correctFirst = 0;
  completed = 0;
  readonly total: number;
  readonly loopWrong: boolean;
  constructor(items: readonly DictationWord[], loopWrong: boolean) {
    this.queue = [...items]; this.total = items.length; this.loopWrong = loopWrong;
  }
  get current(): DictationWord | undefined { return this.queue[0]; }
  submit(correct: boolean): void {
    const word = this.queue.shift();
    if (!word) return;
    this.attempts++;
    if (!this.first.has(word.id)) { this.first.add(word.id); if (correct) this.correctFirst++; }
    const streak = correct ? (this.streaks.get(word.id) ?? 0) + 1 : 0;
    this.streaks.set(word.id, streak);
    if (!correct) this.mistakes.add(word.id);
    if (this.loopWrong && this.mistakes.has(word.id) && streak < 2) this.queue.push(word);
    else {
      this.completed++;
      if (correct) this.mastered.add(word.id);
    }
  }
}

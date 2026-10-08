export const DICTATION_KINDS = ['plate', 'flight', 'phone'] as const;
export type DictationKind = typeof DICTATION_KINDS[number];
export const DICTATION_LABELS: Record<DictationKind, string> = { plate: '车牌', flight: '航班号', phone: '电话号码' };

export function randomIndex(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 65536) throw new RangeError('Invalid random range');
  const ceiling = Math.floor(0x100000000 / limit) * limit;
  const buffer = new Uint32Array(1);
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= ceiling);
  return buffer[0] % limit;
}

export function createDictation(kind: DictationKind, random: (limit: number) => number = randomIndex): string {
  if (!DICTATION_KINDS.includes(kind)) throw new TypeError('Invalid dictation category');
  const choose = (alphabet: string) => {
    const index = random(alphabet.length);
    if (!Number.isInteger(index) || index < 0 || index >= alphabet.length) throw new RangeError('Invalid random result');
    return alphabet[index];
  };
  const letters = (length: number) => Array.from({ length }, () => choose('ABCDEFGHJKLMNPRSTUVWXYZ')).join('');
  const digits = (length: number) => Array.from({ length }, () => choose('0123456789')).join('');
  if (kind === 'plate') return `${letters(2)}${digits(2)} ${letters(3)}`;
  if (kind === 'flight') return `${letters(2)} ${choose('123456789')}${digits(3)}`;
  // Ofcom-reserved fictional ranges: never generate a subscriber's phone number.
  const prefixes = ['07700 900', '020 7946 0', '0161 496 0', '0306 999 0'];
  return `${prefixes[Number(choose('0123'))]}${digits(3)}`;
}

export function normalizeDictation(value: string): string {
  return value.slice(0, 64).normalize('NFKC').toUpperCase().replace(/[\s-]/g, '');
}

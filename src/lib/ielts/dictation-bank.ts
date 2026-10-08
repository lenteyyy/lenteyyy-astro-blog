import type { DictationKind } from './dictation';
export type RecordedDictation = { answer: string; audio: string | null };
// Generated practice data. Pair each item with the owner's recording when supplied.
const examples: Record<DictationKind, readonly string[]> = {
  plate: ['FF55 TRP', 'UW81 JME', 'LT56 HGF', 'UN88 PMY', 'DL03 BZJ', 'XV59 EXC', 'WL97 LFA', 'XU84 TKC', 'YX87 GRK', 'EK49 FJF'],
  flight: ['DR 5464', 'WT 3556', 'XJ 6508', 'PT 2850', 'UB 2724', 'YX 6153', 'LW 2490', 'NS 7521', 'WJ 3210', 'JR 6795'],
  phone: ['0161 496 0841', '0161 496 0447', '020 7946 0604', '0306 999 0112', '020 7946 0960', '0161 496 0988', '0161 496 0079', '0306 999 0862', '0306 999 0166', '020 7946 0824'],
};
export const recordedDictations: Record<DictationKind, readonly RecordedDictation[]> = {
  plate: examples.plate.map(answer => ({ answer, audio: null })),
  flight: examples.flight.map(answer => ({ answer, audio: null })),
  phone: examples.phone.map(answer => ({ answer, audio: null })),
};
export function readyDictations(items: readonly RecordedDictation[]): RecordedDictation[] {
  return items.filter(item => typeof item.answer === 'string' && item.answer.length <= 64 && typeof item.audio === 'string' && /^\/ielts\/dictation\/audio\/[a-zA-Z0-9_-]+\.mp3$/.test(item.audio));
}

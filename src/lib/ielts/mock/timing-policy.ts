import type {Subject} from './run-policy';

// Actual decoded durations of the four local MP3 files, in seconds.
export const LISTENING_AUDIO_SECONDS: Readonly<Record<string, readonly number[]>> = Object.freeze({
	'20-1': [501.0024375, 514.377125, 478.87675, 472.4245],
	'20-2': [408.111, 428.721625, 422.269375, 571.3240625],
	'20-3': [439.5363125, 525.2440625, 446.4065625, 512.7836875],
	'20-4': [442.1746875, 508.342875, 472.502875, 482.50775],
	'21-1': [467.3045, 445.518375, 416.5746875, 545.28],
	'21-2': [504.16325, 368.0914375, 446.0146875, 457.8481875],
	'21-3': [432.64, 410.5143125, 391.94125, 561.058],
	'21-4': [426.3445, 432.9535, 390.321625, 444.6301875],
});
// End of "You now have one minute to check your answers to Part 4".
// Offline transcription + waveform verification; 100 ms clearance avoids clipping.
// The following recorded silence and paper-test transfer instruction are not played.
export const LISTENING_CHECK_CUE_SECONDS: Readonly<Record<string, number>> = Object.freeze({
	'20-1': 396.505, '20-2': 471.793, '20-3': 423.173, '20-4': 405.964,
	'21-1': 470.531, '21-2': 383.091, '21-3': 486.298, '21-4': 369.877,
});
const LEGACY_EOF_DURATION: Readonly<Record<string, number>> = Object.freeze({
	'20-1': 2087, '20-2': 1951, '20-3': 2045, '20-4': 2026,
	'21-1': 1994, '21-2': 1897, '21-3': 1917, '21-4': 1815,
});
export const LISTENING_CHECK_SECONDS = 2 * 60;
export const LISTENING_TIMING_VERSION = 3;

export function listeningCheckCueSeconds(book: number, paper: number): number {
	const cue = LISTENING_CHECK_CUE_SECONDS[`${book}-${paper}`];
	if (!cue) throw new RangeError('Unknown listening paper');
	return cue;
}

export function previousListeningDurationSeconds(book: number, paper: number, version: unknown): number {
	return version === 2 ? LEGACY_EOF_DURATION[`${book}-${paper}`] : 35 * 60;
}

export function subjectDurationSeconds(subject: Subject, book: number, paper: number): number {
	if (subject !== 'listening') return 60 * 60;
	const parts = LISTENING_AUDIO_SECONDS[`${book}-${paper}`];
	if (!parts) throw new RangeError('Unknown listening paper');
	return Math.ceil(parts.slice(0, 3).reduce((total, seconds) => total + seconds, 0) + listeningCheckCueSeconds(book, paper)) + LISTENING_CHECK_SECONDS;
}

export function formatExamDuration(seconds: number): string {
	const minutes = Math.floor(seconds / 60), remainder = seconds % 60;
	return remainder ? `${minutes} 分 ${remainder} 秒` : `${minutes} 分钟`;
}

// Keep old answers and playback progress, but do not retain the old ten-minute allowance.
export function migrateListeningDeadline(deadline: number, version: unknown, complete: boolean, finished: boolean, now: number, duration: number, previousDuration = 35 * 60): number {
	if (version === LISTENING_TIMING_VERSION || finished || !Number.isFinite(deadline) || deadline <= 0) return deadline;
	return complete ? Math.min(deadline, now + LISTENING_CHECK_SECONDS * 1000) : deadline - Math.max(0, previousDuration - duration) * 1000;
}

export function listeningCheckDeadline(now: number): number {
	return now + LISTENING_CHECK_SECONDS * 1000;
}

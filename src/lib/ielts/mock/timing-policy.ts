import type {Subject} from './run-policy';

// Actual decoded durations of the four local MP3 files, in seconds.
export const LISTENING_AUDIO_SECONDS: Readonly<Record<string, readonly number[]>> = Object.freeze({
	'16-1': [422.5055625,417.3594375,401.8426875,505.6010625],
	'16-2': [397.9765625,464.197,416.68025,526.2900625],
	'16-3': [493.558625,408.4516875,411.377375,515.0835],
	'16-4': [426.2933125,385.09825,408.3471875,553.95375],
	'17-1': [415.1651875,413.4410625,444.2655625,455.7071875],
	'17-2': [474.567625,445.1015,402.4435,434.39125],
	'17-3': [415.321875,450.37825,452.755375,486.8190625],
	'17-4': [383.1129375,472.6345625,411.6125,515.8933125],
	'18-1': [431.2826875,398.0810625,400.9023125,527.5961875],
	'18-2': [468.7945625,437.2125,428.017375,425.95375],
	'18-3': [470.570875,467.4100625,355.24025,459.7039375],
	'18-4': [442.8810625,436.115375,418.090875,497.42475],
	'19-1': [472.6345625,437.2125,420.2329375,414.7733125],
	'19-2': [481.881875,384.1316875,410.7765625,426.946375],
	'19-3': [396.174125,371.801875,422.139875,410.410875],
	'19-4': [405.134125,389.0949375,429.37575,518.897375],
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
	'16-1': 430.763,
	'16-2': 451.684,
	'16-3': 440.467,
	'16-4': 479.346,
	'17-1': 381.134,
	'17-2': 359.816,
	'17-3': 412.245,
	'17-4': 444.868,
	'18-1':452.124, '18-2':350.484, '18-3':384.243, '18-4':421.958,
	'19-1':377.883, '19-2':418.544, '19-3':392.232, '19-4':512.087,
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
	return version === 2 ? (LEGACY_EOF_DURATION[`${book}-${paper}`] ?? 35 * 60) : 35 * 60;
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

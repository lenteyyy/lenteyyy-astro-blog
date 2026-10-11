export type TypingMode = 'words' | 'passage';
export const TYPING_DURATIONS = [30, 60, 120] as const;

const words = 'research environment education knowledge language community culture opportunity development experience information technology transport population economy communication accommodation university library appointment schedule restaurant equipment certificate available independent successful necessary convenient comfortable responsible efficient reliable sustainable significant'.split(' ');
// Original practice text; no third-party passages or user data.
const sentences = [
	'The university library stays open late during the examination period.',
	'Many students choose public transport because it is affordable and convenient.',
	'A clear research question helps the team decide which information to collect.',
	'The new community centre offers language classes and a quiet study area.',
	'Local businesses can reduce waste by using fewer disposable materials.',
	'Visitors should confirm their booking before travelling to the conference.',
	'The report compares changes in population across several coastal cities.',
	'Good communication makes it easier for people to work together effectively.',
	'The museum provides an interesting introduction to the history of the region.',
	'An appointment can be arranged by contacting the reception desk in advance.',
	'Regular practice can make typing familiar words more accurate and comfortable.',
	'The project examines how technology influences education and daily life.',
];

export function typingDuration(value: unknown): number {
	const seconds = Number(value);
	return TYPING_DURATIONS.some(duration => duration === seconds) ? seconds : 60;
}

export function createTypingText(mode: TypingMode, random: () => number = Math.random): string {
	const pool = mode === 'words' ? words : sentences;
	const parts: string[] = [];
	let length = 0;
	while (length < 2400) {
		const order = [...pool];
		for (let i = order.length - 1; i > 0; i--) {
			const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
			[order[i], order[j]] = [order[j], order[i]];
		}
		parts.push(...order);
		length += order.join(' ').length + 1;
	}
	return parts.join(' ');
}

export function typingStats(target: string, input: string, elapsedMs: number) {
	const typed = input.slice(0, target.length);
	let correct = 0;
	for (let i = 0; i < typed.length; i++) if (typed[i] === target[i]) correct++;
	const minutes = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) / 60000 : 0;
	return {
		typed: typed.length,
		correct,
		errors: typed.length - correct,
		accuracy: typed.length ? Math.round(correct / typed.length * 100) : 100,
		wpm: minutes > 0 ? Math.round(correct / 5 / minutes) : 0,
		cpm: minutes > 0 ? Math.round(correct / minutes) : 0,
		progress: target.length ? Math.round(typed.length / target.length * 100) : 0,
	};
}

export function typingClock(startedAt: number, now: number, duration: number) {
	const limit = typingDuration(duration) * 1000;
	const elapsed = Math.min(limit, Math.max(0, now - startedAt));
	return { elapsed, remaining: Math.ceil((limit - elapsed) / 1000), expired: elapsed >= limit };
}

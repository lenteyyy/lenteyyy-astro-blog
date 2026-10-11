import { createTypingText, typingClock, typingDuration, typingStats } from './typing';

const root = document.querySelector<HTMLElement>('[data-typing]');
if (root) {
	const input = root.querySelector<HTMLTextAreaElement>('[data-typing-input]')!;
	const target = root.querySelector<HTMLElement>('[data-typing-target]')!;
	const mode = root.querySelector<HTMLSelectElement>('[data-typing-mode]')!;
	const duration = root.querySelector<HTMLSelectElement>('[data-typing-duration]')!;
	const status = root.querySelector<HTMLElement>('[data-typing-status]')!;
	const metrics = Object.fromEntries(['wpm', 'accuracy', 'remaining', 'cpm', 'errors'].map(key => [key, root.querySelector<HTMLElement>(`[data-typing-${key}]`)!]));
	let text = '';
	let characters: HTMLSpanElement[] = [];
	let previous = '';
	let startedAt: number | null = null;
	let finished = false;
	let interval: ReturnType<typeof setInterval> | undefined;
	let seconds = 60;
	let elapsed = 0;
	const stop = () => { if (interval !== undefined) clearInterval(interval); interval = undefined; };
	const renderStats = () => {
		const stats = typingStats(text, input.value, elapsed);
		metrics.wpm.textContent = String(stats.wpm);
		metrics.accuracy.textContent = `${stats.accuracy}%`;
		metrics.cpm.textContent = String(stats.cpm);
		metrics.errors.textContent = String(stats.errors);
	};
	const finish = () => {
		if (finished) return;
		finished = true;
		stop();
		input.readOnly = true;
		renderStats();
		status.textContent = '练习结束。可以重新开始，或更换文本。';
	};
	const tick = () => {
		if (startedAt === null || finished) return;
		const clock = typingClock(startedAt, performance.now(), seconds);
		elapsed = clock.elapsed;
		metrics.remaining.textContent = `${clock.remaining}s`;
		renderStats();
		if (clock.expired) finish();
	};
	const paint = () => {
		const value = input.value;
		for (let i = 0; i <= Math.max(previous.length, value.length); i++) {
			if (!characters[i]) break;
			const state = i < value.length ? (value[i] === text[i] ? 'correct' : 'wrong') : i === value.length ? 'current' : '';
			if (characters[i].className !== state) characters[i].className = state;
		}
		previous = value;
		const caret = characters[value.length];
		if (caret) {
			const top = caret.offsetTop;
			if (top < target.scrollTop || top + caret.offsetHeight > target.scrollTop + target.clientHeight) target.scrollTop = Math.max(0, top - target.clientHeight / 2);
		}
	};
	const reset = (newText = false) => {
		stop();
		seconds = typingDuration(duration.value);
		startedAt = null; finished = false; elapsed = 0; previous = '';
		input.value = ''; input.readOnly = false;
		if (newText || !text) text = createTypingText(mode.value === 'words' ? 'words' : 'passage');
		const fragment = document.createDocumentFragment();
		characters = [...text].map(character => { const span = document.createElement('span'); span.textContent = character; fragment.append(span); return span; });
		target.replaceChildren(fragment);
		target.scrollTop = 0;
		input.maxLength = text.length;
		metrics.remaining.textContent = `${seconds}s`;
		status.textContent = '首次输入开始计时。';
		paint(); renderStats();
	};
	input.addEventListener('beforeinput', event => {
		if (['insertFromPaste', 'insertFromDrop', 'insertReplacementText'].includes((event as InputEvent).inputType)) { event.preventDefault(); return; }
		if (finished) { event.preventDefault(); return; }
		if (startedAt !== null && typingClock(startedAt, performance.now(), seconds).expired) { tick(); event.preventDefault(); }
	});
	const handleInput = (event: Event) => {
		if ((event as InputEvent).isComposing || finished) return;
		if (startedAt !== null && typingClock(startedAt, performance.now(), seconds).expired) { input.value = previous; tick(); return; }
		if (startedAt === null && input.value.length) {
			startedAt = performance.now();
			status.textContent = '练习中';
			interval = setInterval(tick, 100);
		}
		input.value = input.value.slice(0, text.length);
		paint(); tick(); renderStats();
		if (input.value.length === text.length) finish();
	};
	input.addEventListener('input', handleInput);
	input.addEventListener('compositionend', handleInput);
	// Do not accept pasted text as typing practice.
	for (const event of ['paste', 'drop']) input.addEventListener(event, e => e.preventDefault());
	root.querySelector('[data-typing-restart]')!.addEventListener('click', () => { reset(); input.focus(); });
	root.querySelector('[data-typing-new]')!.addEventListener('click', () => { reset(true); input.focus(); });
	mode.addEventListener('change', () => reset(true));
	duration.addEventListener('change', () => reset());
	document.addEventListener('visibilitychange', tick);
	window.addEventListener('pagehide', stop);
	window.addEventListener('pageshow', () => { if (startedAt !== null && !finished) { stop(); tick(); if (!finished) interval = setInterval(tick, 100); } });
	reset(true);
}

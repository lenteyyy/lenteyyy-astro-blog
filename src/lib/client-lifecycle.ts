type PageSetup = (signal: AbortSignal) => void;

type PageSetupState = {
	controller?: AbortController;
	body?: HTMLElement;
};

declare global {
	interface Window {
		__lenteyyyPageSetups?: Map<string, PageSetupState>;
	}
}

export function onPageLoad(key: string, setup: PageSetup): void {
	const registry = window.__lenteyyyPageSetups ??= new Map();
	if (registry.has(key)) return;

	const state: PageSetupState = {};
	const run = () => {
		if (state.body === document.body && !state.controller?.signal.aborted) return;
		state.controller?.abort();
		state.controller = new AbortController();
		state.body = document.body;
		setup(state.controller.signal);
	};

	document.addEventListener('astro:before-swap', () => state.controller?.abort());
	document.addEventListener('astro:page-load', run);
	registry.set(key, state);
	run();
}

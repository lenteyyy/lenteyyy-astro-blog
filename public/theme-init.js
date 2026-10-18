try { localStorage.removeItem('theme'); } catch {}
(() => {
	let fallbackTheme = document.documentElement.dataset.theme;
	const applyTheme = () => {
		try {
			const theme = sessionStorage.getItem('theme');
			if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
			else document.documentElement.removeAttribute('data-theme');
		} catch {
			if (fallbackTheme === 'dark' || fallbackTheme === 'light') document.documentElement.dataset.theme = fallbackTheme;
		}
	};
	document.addEventListener('astro:before-swap', () => { fallbackTheme = document.documentElement.dataset.theme; });
	document.addEventListener('astro:after-swap', applyTheme);
	applyTheme();
})();

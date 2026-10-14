try {
				localStorage.removeItem('theme');
				const applyTheme = () => {
					const theme = sessionStorage.getItem('theme');
					if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
					else document.documentElement.removeAttribute('data-theme');
				};
				document.addEventListener('astro:after-swap', applyTheme);
				applyTheme();
			} catch {}

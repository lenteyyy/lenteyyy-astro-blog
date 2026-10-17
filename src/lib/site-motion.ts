import { onPageLoad } from './client-lifecycle';
import { MOTION } from './motion-policy';

// Progressive enhancement: nothing is hidden in CSS or left hidden without JS.
onPageLoad('site-motion', (signal) => {
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
	if (reduced.matches || !('IntersectionObserver' in window)) return;
	const animations = new Set<Animation>();
	const candidates = document.querySelectorAll<HTMLElement>(
		'.intro-copy > *, .intro-note, .page-intro > *, .post-header > *, ' +
		'.about-cover, .about > h1, .about-copy, .tag-page > h1, .category-page > h1, ' +
		'.section-head, .post-card, .category-row > a, .hero-image, .post-nav, .footer-inner',
	);
	const observer = new IntersectionObserver((entries) => {
		let order = 0;
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			observer.unobserve(entry.target);
			if (reduced.matches || signal.aborted) continue;
			const animation = entry.target.animate(
				[{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }],
				{ duration: MOTION.revealDuration, delay: Math.min(order++, 3) * 65, easing: MOTION.easing, fill: 'backwards' },
			);
			animations.add(animation);
			const release = () => animations.delete(animation);
			animation.addEventListener('finish', release, { once: true });
			animation.addEventListener('cancel', release, { once: true });
		}
	}, { threshold: 0, rootMargin: '0px 0px -24px 0px' });
	candidates.forEach((element) => observer.observe(element));
	const stop = () => {
		observer.disconnect();
		for (const animation of animations) animation.cancel();
		animations.clear();
	};
	reduced.addEventListener('change', stop, { signal });
	signal.addEventListener('abort', stop, { once: true });
	// Never conceal a focused control while its reveal is in progress.
	document.addEventListener('focusin', (event) => {
		if (!(event.target instanceof HTMLElement)) return;
		for (const animation of animations) {
			const target = (animation.effect as KeyframeEffect | null)?.target;
			if (target instanceof Element && target.contains(event.target)) animation.finish();
		}
	}, { signal });
});

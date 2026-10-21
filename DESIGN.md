# Lenteyyy editorial design

The blog is a quiet personal publication, not a product landing page. Preserve its identity when adding features; use external component examples only for interaction ideas, never copy their entire styling or dependency stack.

## Visual tokens

Light: paper `#f8f5ef`, ink `#26231f`, muted `#756e63`, line `#e4ddd2`, accent `#9d4a3d`. Dark: paper `#15130f`, ink `#efe9df`, muted `#aaa197`, line `#383229`, accent `#d69386`. Keep the transparent sheep logo intact. Type uses Noto Serif SC/Georgia and DM Mono; root size is 17px, article size 1.1875rem with 2.08 line height, mobile 1.0625rem/1.98. Do not reduce body legibility to fit decorative layouts.

## Motion contract

Interaction easing is `cubic-bezier(.22,1,.36,1)`, controls 220ms, image expansion 320ms, homepage secondary-content reveal 480ms with at most 165ms stagger. Homepage heading and first introduction sentence remain immediately visible. Only homepage secondary content and cards receive an 8px one-time reveal. Article text, headings, images and reading navigation do not move or reveal during scroll. Images expand only after user action using a temporary transform-only overlay; never reflow the reading column. The header remains stable during the short 180ms route fade. Navigation uses a fine sliding underline, not a pill or glow. Every effect must honor reduced-motion preferences; no JavaScript must still show all content and usable links.

## Performance and accessibility

Use CSS and Web Animations already available in the browser. No added animation libraries, canvas shaders, background audio, scroll hijacking, perpetual timers, particles, per-letter effects or animated textures. Do not hide critical first-paint content. Avoid extra image requests for decorative effects. Reserve scrollbar space so dialogs cannot shift the article. Keep keyboard focus, Escape, back/forward navigation, image gestures and lifecycle cleanup working. Verify both themes, both locales, 320px and 200% text, reduced motion and disabled JavaScript. New motion JavaScript must stay within 5 KB gzip of the previous build and add no runtime dependencies.

## Inspiration boundary

21st.dev Blur Fade informed restrained homepage staggering; Motion Primitives Morphing Dialog informed image-to-overlay expansion; Nav Header informed a shared moving indicator. These interactions are implemented natively for the existing Astro site. No third-party component source or brand assets are copied. Refero Styles is a design-system reference, not a runtime dependency.

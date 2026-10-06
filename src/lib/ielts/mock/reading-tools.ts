import { normalizeHighlights, removeHighlight, splitPercent, type HighlightColor, type HighlightRange } from './reading-state';

export function setupReadingTools(root: HTMLElement, hooks: {
  getSplit: () => number;
  setSplit: (value: number) => void;
  getHighlights: () => HighlightRange[];
  setHighlights: (value: HighlightRange[]) => void;
  highlight?: boolean;
}) {
  const workspace = root.querySelector<HTMLElement>('.reading-workspace')!;
  const divider = root.querySelector<HTMLElement>('[data-divider]')!;
  const passage = root.querySelector<HTMLElement>('[data-passage]')!;
  const tools = root.querySelector<HTMLElement>('[data-highlight-tools]')!;
  const adds = tools.querySelectorAll<HTMLButtonElement>('[data-highlight-add]');
  const remove = tools.querySelector<HTMLButtonElement>('[data-highlight-remove]')!;
  const narrow = window.matchMedia('(max-width: 699px)');
  let pointer: number | null = null;
  let pending: HighlightRange | null = null;
  let ratio = hooks.getSplit();
  let frame = 0;
  let clientX = 0;

  const hide = () => { pending = null; tools.hidden = true; };
  const applySplit = () => {
    ratio = splitPercent(ratio, workspace.clientWidth - 20 - divider.offsetWidth);
    workspace.style.setProperty('--passage-share', `${ratio}fr`);
    workspace.style.setProperty('--answer-share', `${100 - ratio}fr`);
    divider.setAttribute('aria-valuenow', String(Math.round(ratio)));
    divider.setAttribute('aria-valuetext', `原文宽度 ${Math.round(ratio)}%`);
    divider.tabIndex = narrow.matches ? -1 : 0;
  };
  const move = () => {
    frame = 0;
    const bounds = workspace.getBoundingClientRect();
    const width = workspace.clientWidth - 20 - divider.offsetWidth;
    ratio = splitPercent((clientX - bounds.left - 10 - divider.offsetWidth / 2) / width * 100, width);
    applySplit();
  };
  const endDrag = () => {
    if (pointer === null) return;
    if (frame) { cancelAnimationFrame(frame); move(); }
    const id = pointer; pointer = null;
    if (divider.hasPointerCapture(id)) divider.releasePointerCapture(id);
    root.classList.remove('resizing'); hooks.setSplit(ratio);
  };
  divider.addEventListener('pointerdown', (event) => {
    if (narrow.matches || event.button !== 0) return;
    event.preventDefault(); hide(); window.getSelection()?.removeAllRanges();
    pointer = event.pointerId; divider.setPointerCapture(pointer); root.classList.add('resizing');
  });
  divider.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointer) return;
    clientX = event.clientX;
    if (!frame) frame = requestAnimationFrame(move);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) divider.addEventListener(name, endDrag);
  window.addEventListener('blur', endDrag);
  divider.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || narrow.matches) return;
    event.preventDefault();
    ratio = event.key === 'Home' ? 0 : event.key === 'End' ? 100 : ratio + (event.key === 'ArrowLeft' ? -2 : 2);
    applySplit(); hooks.setSplit(ratio);
  });
  divider.addEventListener('dblclick', () => { ratio = 50; applySplit(); hooks.setSplit(ratio); });
  new ResizeObserver(() => { endDrag(); hide(); applySplit(); }).observe(workspace);

  if(hooks.highlight===false){applySplit();return{render:()=>{endDrag();hide();applySplit();}};}

  const paint = () => {
    // Unwrap only our marks; paragraph/heading structure and text are untouched.
    for (const mark of passage.querySelectorAll('mark[data-reading-highlight]')) mark.replaceWith(document.createTextNode(mark.textContent || ''));
    passage.normalize();
    const ranges = normalizeHighlights(hooks.getHighlights(), passage.textContent?.length || 0);
    const walker = document.createTreeWalker(passage, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = []; let next: Node | null;
    while ((next = walker.nextNode())) nodes.push(next as Text);
    let offset = 0;
    for (const node of nodes) {
      const text = node.data; const start = offset; offset += text.length;
      const overlaps = ranges.filter((range) => range.start < offset && range.end > start);
      if (!overlaps.length) continue;
      const fragment = document.createDocumentFragment(); let cursor = 0;
      for (const range of overlaps) {
        const from = Math.max(0, range.start - start); const to = Math.min(text.length, range.end - start);
        fragment.append(document.createTextNode(text.slice(cursor, from)));
        const mark = document.createElement('mark'); mark.dataset.readingHighlight = '';
        mark.dataset.color = range.color || 'yellow';
        mark.dataset.start = String(range.start); mark.dataset.end = String(range.end);
        mark.textContent = text.slice(from, to); fragment.append(mark); cursor = to;
      }
      fragment.append(document.createTextNode(text.slice(cursor))); node.replaceWith(fragment);
    }
  };
  const show = (selection: HighlightRange, rect: DOMRect) => {
    pending = selection; tools.hidden = false;
    const width = tools.offsetWidth; const height = tools.offsetHeight;
    tools.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, rect.left))}px`;
    tools.style.top = `${Math.max(8, Math.min(window.innerHeight - height - 8, rect.bottom + 6))}px`;
    remove.disabled = !hooks.getHighlights().some((range) => range.start < selection.end && range.end > selection.start);
  };
  document.addEventListener('selectionchange', () => {
    if (pointer !== null) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) { hide(); return; }
    const range = selection.getRangeAt(0);
    if (!passage.contains(range.startContainer) || !passage.contains(range.endContainer) || !range.toString().trim()) { hide(); return; }
    const before = document.createRange(); before.selectNodeContents(passage); before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    show({ start, end: start + range.toString().length }, range.getBoundingClientRect());
  });
  passage.addEventListener('click', (event) => {
    if (!window.getSelection()?.isCollapsed) return;
    const mark = (event.target as Element).closest<HTMLElement>('mark[data-reading-highlight]');
    if (mark) show({ start: Number(mark.dataset.start), end: Number(mark.dataset.end) }, mark.getBoundingClientRect());
  });
  tools.addEventListener('pointerdown', (event) => event.preventDefault());
  const change = (color?: HighlightColor) => {
    if (!pending) return;
    const current = hooks.getHighlights();
    const ranges = color ? normalizeHighlights([...current, { ...pending, color }], passage.textContent?.length || 0) : removeHighlight(current, pending);
    window.getSelection()?.removeAllRanges(); hooks.setHighlights(ranges); paint(); hide();
  };
  for (const add of adds) add.addEventListener('click', () => change(add.dataset.highlightAdd === 'blue' ? 'blue' : 'yellow'));
  remove.addEventListener('click', () => change());
  document.addEventListener('pointerdown', (event) => { if (!tools.contains(event.target as Node) && !passage.contains(event.target as Node)) hide(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { window.getSelection()?.removeAllRanges(); hide(); } });
  for (const pane of root.querySelectorAll('.question-scroll, .answer-scroll')) pane.addEventListener('scroll', hide);
  applySplit();
  return { render: () => { endDrag(); hide(); paint(); applySplit(); } };
}

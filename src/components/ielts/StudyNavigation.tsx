import { useEffect, useRef, useState } from 'react';

const links = [{ id: 'overview', label: '首页' }, { id: 'booking', label: '课程预约' }, { id: 'materials', label: '学习资料' }, { id: 'mock', label: '模考页面' }, { id: 'notes', label: '其他' }];
const validSection = (id: string) => links.some(link => link.id === id) ? id : 'overview';

export default function StudyNavigation() {
  const [active, setActive] = useState('overview');
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const update = () => setActive(validSection(location.hash.slice(1)));
    const changed = (event: Event) => setActive(validSection((event as CustomEvent<{ section: string }>).detail.section));
    update();
    window.addEventListener('hashchange', update);
    window.addEventListener('ielts:section-change', changed);
    return () => { window.removeEventListener('hashchange', update); window.removeEventListener('ielts:section-change', changed); };
  }, []);
  useEffect(() => {
    const root = nav.current;
    if (!root) return;
    const measure = () => {
      const item = root.querySelector<HTMLAnchorElement>(`a[href="#${active}"]`);
      if (item) setIndicator({ left: item.offsetLeft, width: item.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    for (const item of root.querySelectorAll('a')) observer.observe(item);
    return () => observer.disconnect();
  }, [active]);
  return <nav ref={nav} className="study-navigation side-nav" aria-label="雅思学习中心导航">
    {links.map(link => <a key={link.id} href={`#${link.id}`} aria-current={active === link.id ? 'page' : undefined} onClick={event => {
      event.preventDefault();
      document.querySelector('[data-ielts-page]')?.dispatchEvent(new CustomEvent('ielts:navigate', { detail: { section: link.id } }));
    }}>{link.label}</a>)}
    <span className="navigation-indicator" aria-hidden="true" style={{ width: indicator.width, transform: `translateX(${indicator.left}px)`, opacity: indicator.width ? 1 : 0 }} />
    <style>{`
      .study-navigation { position:relative;display:flex;align-items:center;gap:clamp(16px,2.4vw,36px);margin:0;isolation:isolate; }
      .study-navigation a { position:relative;display:flex;align-items:center;min-height:54px;padding:0 2px;color:var(--ielts-muted);font-size:15px;font-weight:500;white-space:nowrap;transition:color .2s ease,transform .25s ease; }
      .study-navigation a:hover,.study-navigation a[aria-current="page"] { color:var(--ielts-ink); }
      .study-navigation a:hover { transform:translateY(-1px); }
      .study-navigation .navigation-indicator { position:absolute;left:0;bottom:4px;height:2px;background:var(--ielts-ink);pointer-events:none;transition:transform .42s cubic-bezier(.22,1,.36,1),width .42s cubic-bezier(.22,1,.36,1),opacity .2s; }
      @media(max-width:820px) { .study-navigation { grid-column:1/-1;grid-row:2;min-width:0;gap:24px;overflow-x:auto;scrollbar-width:none; }.study-navigation::-webkit-scrollbar{display:none}.study-navigation a{min-height:48px;flex:0 0 auto;font-size:14px} }
      @media(prefers-reduced-motion:reduce) { .study-navigation a,.study-navigation .navigation-indicator{transition:none}.study-navigation a:hover{transform:none} }
    `}</style>
  </nav>;
}

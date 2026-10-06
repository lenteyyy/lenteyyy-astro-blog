import {normalizeHighlights,removeHighlight,type HighlightRange,type HighlightColor} from './reading-state';
// Offsets count eligible text only, never form controls, answer numbers or buttons.
const excluded='input,select,textarea,button,a,audio,.inline-answer,.question-index,.correct-answer,[data-no-highlight]';
export function eligibleText(region:HTMLElement):Text[]{
 const result:Text[]=[];const walker=document.createTreeWalker(region,NodeFilter.SHOW_TEXT);let node:Node|null;
 while((node=walker.nextNode()))if(node.parentElement&&!node.parentElement.closest(excluded))result.push(node as Text);
 return result;
}
export function setupTextHighlights(root:HTMLElement,hooks:{get:(region:string)=>HighlightRange[];set:(region:string,value:HighlightRange[])=>void}){
 const tools=root.querySelector<HTMLElement>('[data-highlight-tools]')!;
 const regions=Array.from(root.querySelectorAll<HTMLElement>('[data-highlight-region]'));
 let pending:{region:HTMLElement;range:HighlightRange}|null=null;
 const hide=()=>{pending=null;tools.hidden=true;};
 const paint=(region:HTMLElement)=>{
  for(const mark of region.querySelectorAll('mark[data-reading-highlight]'))mark.replaceWith(document.createTextNode(mark.textContent||''));region.normalize();
  const nodes=eligibleText(region);const length=nodes.reduce((n,node)=>n+node.length,0);const ranges=normalizeHighlights(hooks.get(region.dataset.highlightRegion!),length);let offset=0;
  for(const node of nodes){const text=node.data;const start=offset;offset+=text.length;const overlaps=ranges.filter(r=>r.start<offset&&r.end>start);if(!overlaps.length)continue;
   const fragment=document.createDocumentFragment();let cursor=0;
   for(const range of overlaps){const from=Math.max(0,range.start-start);const to=Math.min(text.length,range.end-start);fragment.append(document.createTextNode(text.slice(cursor,from)));const mark=document.createElement('mark');mark.dataset.readingHighlight='';mark.dataset.color=range.color||'yellow';mark.dataset.start=String(range.start);mark.dataset.end=String(range.end);mark.textContent=text.slice(from,to);fragment.append(mark);cursor=to;}
   fragment.append(document.createTextNode(text.slice(cursor)));node.replaceWith(fragment);
  }
 };
 const show=(region:HTMLElement,range:HighlightRange,rect:DOMRect)=>{
  pending={region,range};tools.hidden=false;const width=tools.offsetWidth,height=tools.offsetHeight;
  tools.style.left=`${Math.max(8,Math.min(window.innerWidth-width-8,rect.left))}px`;tools.style.top=`${Math.max(8,Math.min(window.innerHeight-height-8,rect.bottom+6))}px`;
  const remove=tools.querySelector<HTMLButtonElement>('[data-highlight-remove]');if(remove)remove.disabled=!hooks.get(region.dataset.highlightRegion!).some(r=>r.start<range.end&&r.end>range.start);
 };
 document.addEventListener('selectionchange',()=>{
  if(root.classList.contains('resizing')){hide();return;}const selection=window.getSelection();if(!selection||selection.isCollapsed||!selection.rangeCount){hide();return;}
  const range=selection.getRangeAt(0);const region=regions.find(r=>r.contains(range.startContainer)&&r.contains(range.endContainer));if(!region||!range.toString().trim()){hide();return;}
  if(Array.from(region.querySelectorAll(excluded)).some(el=>range.intersectsNode(el))){hide();return;}
  const nodes=eligibleText(region);let offset=0,start=-1,end=-1;
  for(const node of nodes){if(node===range.startContainer)start=offset+range.startOffset;if(node===range.endContainer)end=offset+range.endOffset;offset+=node.length;}
  if(start<0||end<=start){hide();return;}show(region,{start,end},range.getBoundingClientRect());
 });
 for(const region of regions)region.addEventListener('click',event=>{
  if(!window.getSelection()?.isCollapsed)return;const target=event.target;if(!(target instanceof Element))return;const mark=target.closest<HTMLElement>('mark[data-reading-highlight]');if(mark&&region.contains(mark))show(region,{start:Number(mark.dataset.start),end:Number(mark.dataset.end)},mark.getBoundingClientRect());
 });
 tools.addEventListener('pointerdown',event=>event.preventDefault());
 const change=(color?:HighlightColor)=>{
  if(!pending)return;const {region,range}=pending;const name=region.dataset.highlightRegion!;const current=hooks.get(name);const length=eligibleText(region).reduce((n,node)=>n+node.length,0);
  hooks.set(name,color?normalizeHighlights([...current,{...range,color}],length):removeHighlight(current,range));window.getSelection()?.removeAllRanges();paint(region);hide();
 };
 for(const button of tools.querySelectorAll<HTMLButtonElement>('[data-highlight-add]'))button.addEventListener('click',()=>change(button.dataset.highlightAdd==='blue'?'blue':'yellow'));
 tools.querySelector('[data-highlight-remove]')?.addEventListener('click',()=>change());
 document.addEventListener('pointerdown',event=>{const node=event.target as Node;if(!tools.contains(node)&&!regions.some(r=>r.contains(node)))hide();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){window.getSelection()?.removeAllRanges();hide();}});
 for(const pane of root.querySelectorAll('.question-scroll,.answer-scroll'))pane.addEventListener('scroll',hide);
 return{render:()=>{hide();for(const region of regions)paint(region);}};
}

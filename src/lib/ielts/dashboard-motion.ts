const motions = new WeakMap<Element, Animation>();
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export function reveal(node: HTMLElement | null, horizontal = 0) {
  if (!node || reduced()) return;
  motions.get(node)?.cancel();
  const animation = node.animate([{opacity:0,transform:`translate(${horizontal}px, ${horizontal ? 0 : 6}px)`},{opacity:1,transform:'translate(0,0)'}],{duration:220,easing:'cubic-bezier(.22,1,.36,1)'});
  motions.set(node,animation);
}
export function resizeContent(node: HTMLElement, before: number) {
  if(reduced() || before<=0)return;
  motions.get(node)?.cancel();
  const after=node.getBoundingClientRect().height;
  if(Math.abs(before-after)<1){reveal(node);return;}
  motions.set(node,node.animate([{height:`${before}px`,opacity:.6},{height:`${after}px`,opacity:1}],{duration:200,easing:'ease-out'}));
}
export function closeDialog(dialog:HTMLDialogElement|null) {
  if(!dialog?.open)return;
  if(reduced()){dialog.close();return;}
  motions.get(dialog)?.cancel();
  const motion=dialog.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(6px)'}],{duration:140,easing:'ease-in'});
  motions.set(dialog,motion);
  void motion.finished.then(()=>{if(motions.get(dialog)===motion)dialog.close();},()=>{});
}
export function openDialog(dialog:HTMLDialogElement|null) {
  if(!dialog)return;
  motions.get(dialog)?.cancel();
  if(!dialog.open)dialog.showModal();
  reveal(dialog);
}
export function installDialogMotion(dialog:HTMLDialogElement|null) {
  dialog?.addEventListener('cancel',event=>{event.preventDefault();closeDialog(dialog);});
}
export function setMenu(node:HTMLElement|null,open:boolean) {
  if(!node)return;
  motions.get(node)?.cancel();
  if(open){node.hidden=false;reveal(node);return;}
  if(reduced()){node.hidden=true;return;}
  const motion=node.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-4px)'}],{duration:120,easing:'ease-in'});
  motions.set(node,motion);
  void motion.finished.then(()=>{if(motions.get(node)===motion)node.hidden=true;},()=>{});
}

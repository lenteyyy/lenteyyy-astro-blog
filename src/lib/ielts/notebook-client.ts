import {addWord,gradeGroup,notebookKey,REASONS,reviewState,type Notebook,type Mistake,type SavedWord,type Reason} from './notebooks';
import {loadNotebook,saveNotebook} from './notebook-store';
import {PrivateRequestScope} from './private-request-scope';
import type {DictationWord} from './dictation-library';
import type {Section} from './mock/papers';
import type {QuestionBlock} from './mock/test1-questions';
import {renderScanPage} from './mock/scan-page';
const root=document.querySelector<HTMLElement>('[data-notebook]');
const payload=document.querySelector('#notebook-payload');
if(root&&payload){
 const data=JSON.parse(payload.textContent||'{}') as {accountId:string;kind:'mistakes'|'words';demo:boolean;books?:{id:string;title:string;items:string[]}[];words?:DictationWord[]};
 const scope=new PrivateRequestScope(),key=notebookKey(data.accountId),words=new Map((data.words||[]).map(w=>[w.id,w]));
 const $=<T extends HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
 const list=$('[data-list]'),status=$('[data-status]'),search=$<HTMLInputElement>('[data-search]'),filter=$<HTMLSelectElement>('[data-state]'),group=$<HTMLSelectElement>('[data-group]');
 const dialog=$<HTMLDialogElement>('[data-review-dialog]'),context=$('[data-context]'),feedback=$('[data-feedback]'),reviewForm=$<HTMLFormElement>('[data-review-form]'),reviewInputs=$('[data-review-inputs]'),next=$<HTMLButtonElement>('[data-review-next]');
 let active=false,queue:(Mistake|SavedWord)[]=[],index=0,expected:string[]=[],numbers:number[]=[],submitted=false;
 const node=<K extends keyof HTMLElementTagNameMap>(tag:K,value='',className='')=>{const el=document.createElement(tag);el.textContent=value;el.className=className;return el;};
 const write=(fn:(book:Notebook)=>Notebook)=>{if(!active)return false;try{saveNotebook(data.accountId,fn(loadNotebook(data.accountId)));status.textContent='已保存到本机。';render();return true;}catch{status.textContent='本机存储不可用或已满，请先导出并清理。';return false;}};
 const items=(book:Notebook)=>(data.kind==='mistakes'?book.mistakes:book.words) as (Mistake|SavedWord)[];
 const selected=()=>{const q=search.value.normalize('NFKC').trim().toLowerCase();return items(loadNotebook(data.accountId)).filter(item=>{
  const content='word'in item?`${item.word} ${item.meaning} ${item.group} ${item.example}`:`剑雅${item.book} Test ${item.test} ${item.subject==='reading'?'阅读':'听力'} ${item.reason} ${item.note} ${item.numbers.join(' ')}`;
  const category='word'in item?item.group:item.reason;
  return content.toLowerCase().includes(q)&&(group.value==='all'||group.value===category)&&(filter.value==='all'||filter.value==='due'&&item.due<=Date.now()||filter.value==='learning'&&item.streak<3||filter.value==='mastered'&&item.streak>=3);
 }).sort((a,b)=>a.due-b.due);};
 const button=(text:string,action:()=>void)=>{const b=node('button',text);b.type='button';b.addEventListener('click',action);return b;};
 const edit=(id:string,changes:Partial<Mistake&SavedWord>)=>write(book=>({ ...book,[data.kind==='mistakes'?'mistakes':'words']:items(book).map(v=>v.id===id?{...v,...changes}:v)}));
 const render=()=>{
  if(!active)return;try{
   const book=loadNotebook(data.accountId),all=items(book),previous=group.value;
   const categories=data.kind==='mistakes'?[...REASONS]:[...new Set(book.words.map(v=>v.group))].sort();
   group.replaceChildren(new Option('全部','all'),...categories.map(v=>new Option(v,v)));group.value=categories.includes(previous as Reason)?previous:'all';
   const shown=selected();$('[data-count]').textContent=`共 ${all.length} 项 · 到期 ${all.filter(v=>v.due<=Date.now()).length} · 当前显示 ${shown.length}`;
   list.replaceChildren();if(!shown.length){list.append(node('p',all.length?'没有符合筛选条件的内容。':data.kind==='mistakes'?'完成听力或阅读模考后，错题会自动收录。':'添加单词，或从已有词书收藏。'));return;}
   for(const item of shown){
    const entry=node('article','','entry');entry.dataset.entry=item.id;
    entry.append(node('h2','word'in item?item.word:`剑雅${item.book} · Test ${item.test} · ${item.subject==='listening'?'听力':'阅读'} · ${item.numbers.join('、')}`));
    if('word'in item){entry.append(node('p',item.meaning||'尚未添加释义'));if(item.example)entry.append(node('p',item.example));entry.append(node('p',item.group,'muted'));}
    else{
     entry.append(node('p',`原答案：${item.answers.join(' / ')||'未作答'}`),node('p',`参考答案：${item.expected.map(v=>v.replaceAll('|',' / ')).join('；')}`));
     const label=node('label','错因'),reason=node('select');reason.setAttribute('aria-label',`题号 ${item.numbers.join('、')} 错因`);reason.append(...REASONS.map(v=>new Option(v,v)));reason.value=item.reason;reason.addEventListener('change',()=>edit(item.id,{reason:reason.value as Reason}));label.append(reason);entry.append(label);
     const note=node('textarea');note.maxLength=800;note.rows=2;note.value=item.note;note.placeholder='记录定位句、同义替换或错误原因';note.setAttribute('aria-label','错题笔记');note.addEventListener('change',()=>edit(item.id,{note:note.value}));entry.append(note);
    }
    entry.append(node('p',`${item.streak>=3?'已掌握':'复习中'} · 下次复习 ${new Date(item.due).toLocaleDateString('zh-CN')}`,'muted'));
    const actions=node('div','','entry-actions');actions.append(button('word'in item?'复习':'重做',()=>startReview([item])));
    if('word'in item){
     const audio=words.get(item.audioId);if(audio)actions.append(button('发音',()=>{context.replaceChildren();playWord(audio);dialog.showModal();$('[data-review-title]').textContent=item.word;reviewForm.hidden=true;$('[data-word-rating]').hidden=true;next.hidden=true;}));
     actions.append(button('编辑',()=>{const form=$<HTMLFormElement>('[data-word-form]');(root.querySelector('details') as HTMLDetailsElement).open=true;for(const k of ['word','meaning','group','example']){const input=form.elements.namedItem(k) as HTMLInputElement;input.value=String(item[k as keyof SavedWord]);}form.scrollIntoView({block:'center'});}));
    }
    actions.append(button('删除',()=>{if(confirm('删除这一项本机记录？'))write(book=>({...book,[data.kind==='mistakes'?'mistakes':'words']:items(book).filter(v=>v.id!==item.id)}));}));entry.append(actions);list.append(entry);
   }
  }catch{status.textContent='本机存档无法读取，请检查浏览器存储权限。';}
 };
 const playWord=(word:DictationWord)=>{if(!/^\/ielts\/dictation\/audio\/[a-z0-9-]+\.mp3$/.test(word.audio))return;const audio=node('audio');audio.controls=true;audio.src=word.audio;audio.preload='metadata';context.append(audio);void audio.play().catch(()=>{});};
 const pauseAudio=()=>context.querySelectorAll('audio').forEach(a=>{a.pause();a.removeAttribute('src');a.load();});
 const sourceContext=(section:Section,blocks:QuestionBlock[])=>{
  for(const scan of section.scans||[])context.append(renderScanPage(scan));
  for(const paragraph of section.paragraphs)context.append(node('p',paragraph));
  if(/^\/ielts\/mock\/(?:c(?:16|17|18|19|20)-)?test-[1234]\//.test(section.audioUrl)){const audio=node('audio');audio.controls=true;audio.preload='metadata';audio.src=section.audioUrl;context.append(audio);}
  for(const block of blocks){
   if(block.type==='scan')context.append(renderScanPage(block.page));
   else if(block.type==='image'){if(/^\/ielts\/mock\//.test(block.url)){const img=node('img');img.src=block.url;img.alt=block.alt;context.append(img);}}
   else if('text'in block)context.append(node('p',block.text));
   else if(block.type==='choice'||block.type==='pair')context.append(node('p',`${block.type==='choice'?block.number:block.numbers.join('、')} ${block.prompt}\n${block.options.map(o=>`${o.letter} ${o.text}`).join('\n')}`));
   else if(block.type==='statements')context.append(node('p',block.rows.map(r=>`${r.number} ${r.text}`).join('\n')));
   else if(block.type==='match')context.append(node('p',`${block.options.map(o=>`${o.letter} ${o.text}`).join('\n')}\n${block.rows.map(r=>`${r.number} ${r.text}`).join('\n')}`));
   else if(block.type==='table')context.append(node('p',`${block.title}\n${block.columns.join(' / ')}\n${block.rows.map(r=>r.join(' / ')).join('\n')}`));
   else if(block.type==='notes')context.append(node('p',`${block.title}\n${block.groups.map(g=>[g.heading,...g.intro||[],...g.items].filter(Boolean).join('\n')).join('\n')}`));
   else if(block.type==='summary')context.append(node('p',`${block.title}\n${block.paragraphs.join('\n')}`));
   else if(block.type==='flow')context.append(node('p',`${block.title}\n${block.steps.join('\n')}`));
   else if(block.type==='bank')context.append(node('p',`${block.title}\n${block.options.map(o=>`${o.letter} ${o.text}`).join('\n')}`));
  }
 };
 const showReview=async()=>{
  reviewForm.querySelector('button')!.disabled=false;
  scope.invalidate();const token=scope.capture();pauseAudio();context.replaceChildren();reviewInputs.replaceChildren();feedback.textContent='';next.hidden=true;reviewForm.hidden=true;$('[data-word-rating]').hidden=true;submitted=false;
  const item=queue[index];if(!item){dialog.close();return;}$('[data-review-progress]').textContent=`${index+1} / ${queue.length}`;
  if('word'in item){
   $('[data-review-title]').textContent='单词复习';context.append(node('p',item.word));const audio=words.get(item.audioId);if(audio)playWord(audio);
   const reveal=button('显示释义',()=>{reveal.remove();context.append(node('p',item.meaning||'尚未添加释义'),node('p',item.example));$('[data-word-rating]').hidden=false;});context.append(reveal);return;
  }
  $('[data-review-title]').textContent=`C${item.book} T${item.test} · ${item.subject==='reading'?'阅读':'听力'} · ${item.numbers.join('、')}`;feedback.textContent='正在加载原题…';
  try{
   const params=new URLSearchParams({book:String(item.book),test:String(item.test),subject:item.subject,question:String(item.numbers[0])});
   const response=await fetch(`/api/ielts/review?${params}`,{signal:token.signal,cache:'no-store'});const body=await response.json();if(!scope.current(token)||!active)return;
   if(response.status===401){lock();return;}if(!response.ok)throw Error('Unavailable');
   if(!Array.isArray(body.numbers)||!Array.isArray(body.expected)||body.numbers.join('-')!==item.numbers.join('-'))throw Error('Question mismatch');
   numbers=body.numbers;expected=body.expected;sourceContext(body.section,body.blocks);
   for(const n of numbers){const label=node('label',`Question ${n}`),input=node('input');input.name=String(n);input.maxLength=128;input.autocomplete='off';input.spellcheck=false;label.append(input);reviewInputs.append(label);}
   reviewForm.hidden=false;feedback.textContent='';reviewInputs.querySelector('input')?.focus();
  }catch{if(scope.current(token))feedback.textContent='原题暂时无法加载，请关闭后重试。';}
 };
 const startReview=(entries:(Mistake|SavedWord)[])=>{if(!active)return;if(!entries.length){status.textContent='当前没有到期内容。';return;}queue=entries;index=0;if(!dialog.open)dialog.showModal();void showReview();};
 const recordReview=(correct:boolean)=>{if(submitted||!active)return false;const item=queue[index];if(!item)return false;const changes=reviewState(item,correct);if(!edit(item.id,changes))return false;submitted=true;next.hidden=false;return true;};
 reviewForm.addEventListener('submit',event=>{event.preventDefault();if(submitted||!active)return;const answers=numbers.map(n=>(reviewForm.elements.namedItem(String(n)) as HTMLInputElement).value);const correct=gradeGroup(answers,expected);if(!recordReview(correct)){feedback.textContent='保存失败，请检查本机存储后重试。';return;}feedback.textContent=correct?'正确。':`参考答案：${expected.map(v=>v.replaceAll('|',' / ')).join('；')}`;reviewForm.querySelector('button')!.disabled=true;});
 for(const rating of document.querySelectorAll<HTMLButtonElement>('[data-rating]'))rating.addEventListener('click',()=>{if(recordReview(rating.dataset.rating==='correct')){$('[data-word-rating]').hidden=true;feedback.textContent='已更新复习时间。';}else feedback.textContent='保存失败，请检查本机存储后重试。';});
 next.addEventListener('click',()=>{index++;reviewForm.querySelector('button')!.disabled=false;void showReview();});
 $('[data-close-review]').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{scope.invalidate();pauseAudio();context.replaceChildren();reviewInputs.replaceChildren();queue=[];});
 for(const el of [search,filter,group])el.addEventListener(el===search?'input':'change',render);
 $('[data-review-due]').addEventListener('click',()=>{try{startReview(selected().filter(v=>v.due<=Date.now()));}catch{status.textContent='无法读取存档。';}});
 $('[data-export]').addEventListener('click',()=>{if(!active)return;try{const book=loadNotebook(data.accountId),url=URL.createObjectURL(new Blob([JSON.stringify({version:1,[data.kind]:items(book)},null,2)],{type:'application/json;charset=utf-8'}));const link=node('a');link.href=url;link.download=data.kind==='mistakes'?'IELTS-错题本.json':'IELTS-单词本.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{status.textContent='导出失败，无法读取存档。';}});
 const form=document.querySelector<HTMLFormElement>('[data-word-form]');form?.addEventListener('submit',event=>{event.preventDefault();const fields=new FormData(form);if(write(book=>addWord(book,String(fields.get('word')||''),{meaning:String(fields.get('meaning')||''),example:String(fields.get('example')||''),group:String(fields.get('group')||'我的单词')})))form.reset();});
 const catalogBook=document.querySelector<HTMLSelectElement>('[data-catalog-book]'),catalogSearch=document.querySelector<HTMLInputElement>('[data-catalog-search]');
 const renderCatalog=()=>{if(!active||!catalogBook||!catalogSearch)return;const ids=new Set(data.books?.find(b=>b.id===catalogBook.value)?.items||[]),q=catalogSearch.value.trim().toLowerCase(),target=$('[data-catalog-list]');target.replaceChildren();for(const word of [...words.values()].filter(v=>ids.has(v.id)&&v.answer.toLowerCase().includes(q)).slice(0,20))target.append(button(`＋ ${word.answer}`,()=>write(book=>addWord(book,word.answer,{audioId:word.id,group:data.books?.find(b=>b.id===catalogBook.value)?.title||'我的单词'}))));};
 catalogBook?.addEventListener('change',renderCatalog);catalogSearch?.addEventListener('input',renderCatalog);
 const wipe=()=>{active=false;scope.invalidate();pauseAudio();if(dialog.open)dialog.close();list.replaceChildren();context.replaceChildren();reviewInputs.replaceChildren();form?.reset();search.value='';group.replaceChildren(new Option('全部','all'));filter.value='all';status.textContent='';feedback.textContent='';$('[data-count]').textContent='';$('[data-review-title]').textContent='';$('[data-review-progress]').textContent='';$('[data-word-rating]').hidden=true;reviewForm.hidden=true;next.hidden=true;queue=[];expected=[];numbers=[];submitted=false;catalogSearch&&(catalogSearch.value='');$('[data-catalog-list]')?.replaceChildren();};
 const lock=()=>{wipe();location.replace(`/ielts?login=1&next=${encodeURIComponent(location.pathname)}`);};
 const recheck=async()=>{if(data.demo&&import.meta.env.DEV){active=true;render();renderCatalog();return;}const token=scope.capture();try{const r=await fetch('/api/ielts/auth/me',{signal:token.signal,cache:'no-store'}),v=await r.json();if(!scope.current(token))return;if(!r.ok||!v.authenticated||v.userId!==data.accountId){lock();return;}active=true;render();renderCatalog();}catch{if(scope.current(token)){wipe();status.textContent='身份验证暂时不可用，请刷新。';}}};
 const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('ielts-auth-events'):undefined;channel?.addEventListener('message',lock);
 window.addEventListener('pagehide',wipe);window.addEventListener('pageshow',event=>{if(event.persisted)void recheck();});window.addEventListener('focus',()=>void recheck());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void recheck();});window.addEventListener('storage',event=>{if(event.key===key&&active)render();});void recheck();
}

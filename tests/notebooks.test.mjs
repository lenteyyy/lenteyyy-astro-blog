import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {json} from '../src/lib/ielts/http.ts';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const evaluate=(path,context={})=>{
 const exports={};const code=ts.transpileModule(source(path).replace(/^import .*;\n/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,Response,Request,URL,Date,...context});return exports;
};
const scoring=evaluate('src/lib/ielts/mock/scoring.ts');
const model=evaluate('src/lib/ielts/notebooks.ts',scoring);
const plain=v=>JSON.parse(JSON.stringify(v));
const account='11111111-1111-4111-8111-111111111111';
const paper={subject:'reading',bookNumber:16,testNumber:1,accountId:account,answerKey:['A','B','deck','mature|ripe'],blocks:[[{type:'pair',numbers:[1,2]}]],sections:[{first:1,last:4,paragraphs:['Original passage']} ]};
test('mistakes archive wrong and blank answers without penalizing unordered pairs or accepted variants',()=>{
 assert.equal(model.examMistakes(paper,{1:'B',2:'A',3:'DECK',4:'ripe'},100).length,0);
 const wrong=model.examMistakes(paper,{1:'A',2:'A',3:'wrong'},100);
 assert.equal(wrong.length,3);assert.deepEqual(plain(wrong[0].numbers),[1,2]);assert.equal(wrong[2].reason,'漏答');
 assert.equal(model.examMistakes({...paper,subject:'writing'},{},100).length,0);
 assert.equal(model.gradeGroup(['A','A'],['A','B']),false);
});
test('all 24 Cambridge papers archive every incorrect group and accept all-correct answers',()=>{
 for(const book of [16,17,18,19,20,21])for(let n=1;n<=4;n++){
  const data=JSON.parse(source(`src/lib/ielts/mock/${book===21?'':`c${book}-`}test${n}-content.json`));
  for(const subject of ['listening','reading']){
   // C21 question definitions are TS, already fully covered by mock-workflow tests.
   const blocks=data.questions?.[subject]||[];
   const payload={subject,bookNumber:book,testNumber:n,blocks,answerKey:data.answerKeys[subject]};
   const answers=Object.fromEntries(payload.answerKey.map((key,i)=>[i+1,key.split('|')[0]]));
   assert.equal(model.examMistakes(payload,answers).length,0,`C${book}T${n}${subject}`);
   const wrong=model.examMistakes(payload,{});assert.equal(wrong.flatMap(v=>v.numbers).length,40);
   assert.equal(new Set(wrong.flatMap(v=>v.numbers)).size,40);
  }
 }
});
test('same-question reattempt preserves notes and reason, updates answers, and resets review status',()=>{
 const first=model.examMistakes(paper,{},100)[0];first.note='定位句';first.reason='同义替换';first.streak=3;
 const incoming=model.examMistakes(paper,{1:'wrong',2:'wrong'},200);
 const merged=model.mergeMistakes({version:1,mistakes:[first],words:[]},incoming);
 const item=merged.mistakes.find(v=>v.id===first.id);assert.equal(item.note,'定位句');assert.equal(item.reason,'同义替换');assert.equal(item.added,100);assert.equal(item.streak,0);assert.equal(item.due,200);
 assert.equal(merged.mistakes.length,3);
});
test('review spacing progresses 1/3/7/14/30 days and a miss resets the streak',()=>{
 let state={streak:0,due:0,reviewed:0};for(const day of [1,3,7,14,30,30]){state=model.reviewState(state,true,1000);assert.equal(state.due,1000+day*86400000);}
 assert.deepEqual(plain(model.reviewState(state,false,2000)),{streak:0,due:2000+86400000,reviewed:2000});
});
test('word deduplication preserves pronunciation and annotations; capacity and empty input fail safely',()=>{
 let value=model.addWord(model.emptyNotebook(),'Deck',{audioId:'word-deck',meaning:'甲板',group:'易错词'},100);
 value=model.addWord(value,'deck',{example:'on deck'},200);assert.equal(value.words.length,1);assert.equal(value.words[0].audioId,'word-deck');assert.equal(value.words[0].meaning,'甲板');assert.equal(value.words[0].added,100);
 assert.throws(()=>model.addWord(value,'  '));
 for(let i=1;i<1000;i++)value=model.addWord(value,'word '+i);
 assert.throws(()=>model.addWord(value,'overflow'));assert.equal(model.addWord(value,'deck').words.length,1000);
});
test('account keys reject untrusted identities and local storage keeps accounts isolated',()=>{
 const values=new Map(),localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 const store=evaluate('src/lib/ielts/notebook-store.ts',{...model,localStorage});
 for(const id of ['', '../admin','student','__proto__'])assert.throws(()=>model.notebookKey(id));
 store.saveNotebook(account,model.addWord(model.emptyNotebook(),'private'));
 assert.equal(store.loadNotebook('22222222-2222-4222-8222-222222222222').words.length,0);
 assert.equal(store.loadNotebook(account).words[0].word,'private');
 values.set(model.notebookKey(account),'{broken');assert.throws(()=>store.loadNotebook(account));assert.equal(values.get(model.notebookKey(account)),'{broken');
});
test('untrusted storage is bounded and whitelisted, with no role/token/HTML interpretation',()=>{
 const input={version:1,token:'secret',words:[{word:'deck',audioId:'https://attacker.test',group:'g'.repeat(200),meaning:'<script>x</script>',token:'secret'}, {word:'DECK'},null],mistakes:[{book:99,test:1,subject:'reading',numbers:[1]}, {...model.examMistakes(paper,{},100)[0],numbers:[1,1]}]};
 const cleaned=model.cleanNotebook(input);assert.equal(cleaned.words.length,1);assert.equal(cleaned.words[0].audioId,'');assert.equal(cleaned.words[0].group.length,40);assert.equal(cleaned.words[0].meaning,'<script>x</script>');assert.equal(cleaned.mistakes.length,0);assert.equal(cleaned.token,undefined);assert.equal(cleaned.words[0].token,undefined);
 const client=source('src/lib/ielts/notebook-client.ts');assert.doesNotMatch(client,/innerHTML|outerHTML|insertAdjacentHTML|eval\(|sendBeacon|method:\s*['"]POST/);assert.match(client,/textContent=value/);assert.match(client,/BroadcastChannel\('ielts-auth-events'\)/);assert.match(client,/group\.replaceChildren\(new Option\('全部','all'\)\)/);
});
test('review endpoint authenticates before loading paper data, rejects invalid selectors and has no mutations',async()=>{
 let reads=0;const handler=evaluate('src/pages/api/ielts/review.ts',{json,getAuthContext:async()=>undefined,paperPayload:()=>{reads++;throw Error('unexpected read');}});
 const r=await handler.GET({cookies:{},request:new Request('https://www.lenteyyy.com/api/ielts/review?book=16&test=1&subject=reading&question=1')});assert.equal(r.status,401);assert.equal(reads,0);
 const authorized=evaluate('src/pages/api/ielts/review.ts',{json,getAuthContext:async()=>({user:{id:account}}),paperPayload:()=>{reads++;return paper;}});
 for(const query of ['book=99&test=1&subject=reading&question=1','book=16&test=1&subject=writing&question=1','book=16&test=1&subject=reading&question=41','book=16&book=17&test=1&subject=reading&question=1','book=16&test=1&subject=reading'])assert.equal((await authorized.GET({cookies:{},request:new Request('https://www.lenteyyy.com/api/ielts/review?'+query)})).status,400);
 const valid=await authorized.GET({cookies:{},request:new Request('https://www.lenteyyy.com/api/ielts/review?book=16&test=1&subject=reading&question=2')});assert.equal(valid.status,200);assert.deepEqual((await valid.json()).numbers,[1,2]);assert.match(valid.headers.get('cache-control'),/no-store/);assert.doesNotMatch(source('src/pages/api/ielts/review.ts'),/createServiceClient|\.insert\(|\.update\(|\.delete\(/);
});
test('both notebook pages are authenticated, private, noindex and disable demo outside development',()=>{
 for(const path of ['mistakes','wordbook']){const page=source(`src/pages/ielts/${path}.astro`);assert.match(page,/import\.meta\.env\.DEV&&/);assert.match(page,/getAuthContext\(Astro\.cookies,Astro\.request\)/);assert.match(page,/if\(!auth&&!demo\).*new Response\(null,\{status:302,headers:Astro\.response\.headers\}/);assert.match(page,/private, no-store/);assert.match(page,/noindex, nofollow/);}
 assert.match(source('src/components/ielts/Notebook.astro'),/telemetry=\{false\}/);
 assert.match(source('src/components/ielts/MockExam.astro'),/examMistakes\(data,state\.answers\)/);
 assert.match(source('src/lib/ielts/dictation-client.ts'),/saveNotebook\(identity\.userId,addWord/);
});

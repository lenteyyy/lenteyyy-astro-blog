import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {readWorkflow,workflowUrl,cleanRun,completeStage,subjectOrder} from '../src/lib/ielts/mock/run-policy.ts';
import {safeIeltsNext} from '../src/lib/ielts/oauth-policy.ts';
import {scoreAnswers} from '../src/lib/ielts/mock/scoring.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('all subject combinations produce safe round-tripping URLs for both books',()=>{
 for(let bits=1;bits<8;bits++)for(const book of [20,21])for(let paper=1;paper<=4;paper++){
  const selected=subjectOrder.filter((_,i)=>bits&(1<<i));
  for(const subject of selected){const url=workflowUrl(book,paper,'custom',selected,subject);assert.equal(safeIeltsNext(url),url);assert.deepEqual(readWorkflow(new URL(url,'https://local.test').searchParams),{mode:'custom',subjects:selected,subject});}
 }
 for(const query of ['mode=custom&subjects=','mode=custom&subjects=reading,reading','mode=custom&subjects=reading,admin','mode=simulation&subjects=reading','mode=unknown','mode=custom&subjects=reading&subject=writing','subject=reading&subject=writing'])assert.equal(readWorkflow(new URLSearchParams(query)),undefined);
 for(const url of ['/ielts/mock/c20-test-5','/ielts/mock/c20-test-1?subject=reading&next=evil','/ielts/mock/test-1?subject=reading&subject=writing'])assert.equal(safeIeltsNext(url),'/ielts');
});
test('simulation completes listening, reading and writing exactly in order and survives reload',()=>{
 let run=cleanRun(null,subjectOrder);run.started=true;
 run=completeStage(run,subjectOrder,'listening',31);assert.equal(run.current,'reading');assert.equal(run.finished,false);
 run=cleanRun(JSON.parse(JSON.stringify(run)),subjectOrder);assert.deepEqual(run.completed,['listening']);
 run=completeStage(run,subjectOrder,'reading',35);assert.equal(run.current,'writing');assert.equal(run.finished,false);
 run=completeStage(run,subjectOrder,'writing');assert.equal(run.finished,true);assert.deepEqual(run.scores,{listening:31,reading:35});
 assert.equal(cleanRun({version:1,finished:true,completed:[],current:'admin',scores:{reading:Infinity}},subjectOrder).finished,false);
 assert.throws(()=>completeStage(cleanRun(null,subjectOrder),subjectOrder,'reading',40));
});
test('custom exams finish one to three chosen subjects without visiting unselected subjects',()=>{
 for(let bits=1;bits<8;bits++){
  const selected=subjectOrder.filter((_,i)=>bits&(1<<i));let run=cleanRun(null,selected);run.started=true;
  selected.forEach((subject,i)=>{run=completeStage(run,selected,subject,20+i);assert.equal(run.finished,i===selected.length-1);assert.ok(selected.includes(run.current));});
 }
});
test('C20 all four tests have complete source passages, 40 unique questions, scoring and local media',()=>{
 for(let t=1;t<=4;t++){
  const c=JSON.parse(read(`src/lib/ielts/mock/c20-test${t}-content.json`));
  assert.equal(c.sections.listening.length,4);assert.equal(c.sections.reading.length,3);assert.equal(c.sections.writing.length,2);
  for(const subject of ['listening','reading']){
   const numbers=[];
   for(const b of c.questions[subject].flat()){
    if(b.type==='choice')numbers.push(b.number);if(b.type==='pair')numbers.push(...b.numbers);if(b.type==='match'||b.type==='statements')numbers.push(...b.rows.map(r=>r.number));
    numbers.push(...[...JSON.stringify(b).matchAll(/\{\{(\d+)\}\}/g)].map(m=>Number(m[1])));
    if(b.options)assert.equal(new Set(b.options.map(o=>typeof o==='string'?o:o.letter)).size,b.options.length);
   }
   assert.deepEqual(numbers.sort((a,b)=>a-b),Array.from({length:40},(_,i)=>i+1));assert.equal(c.answerKeys[subject].length,40);
   const answers=Object.fromEntries(c.answerKeys[subject].map((v,i)=>[i+1,v.split('|')[0]]));assert.equal(scoreAnswers(answers,c.answerKeys[subject],c.questions[subject]),40);
   for(const pair of c.questions[subject].flat().filter(b=>b.type==='pair')){const[a,b]=pair.numbers;[answers[a],answers[b]]=[answers[b],answers[a]];}
   assert.equal(scoreAnswers(answers,c.answerKeys[subject],c.questions[subject]),40);
  }
  for(const s of c.sections.reading){assert.ok(s.paragraphs.join(' ').length>3000);assert.doesNotMatch(s.paragraphs.join(' '),/Choose ONE WORD|Questions \d|Answer:|Candidate Essay|ielts-thudang/);}
  for(const s of Object.values(c.sections).flat())for(const url of [...s.questionImages,...(s.audioUrl?[s.audioUrl]:[])])assert.ok(existsSync(new URL('../public'+url,import.meta.url)),url);
  for(const b of c.questions.listening.flat())if(b.type==='image')assert.ok(existsSync(new URL('../public'+b.url,import.meta.url)));
 }
});
test('dashboard motion remains isolated from the exam and honors reduced motion',()=>{
 const motion=read('src/lib/ielts/dashboard-motion.ts');assert.match(motion,/prefers-reduced-motion/);assert.match(motion,/\.cancel\(\)/);
 const exam=read('src/components/ielts/MockExam.astro');assert.doesNotMatch(exam,/dashboard-motion|\.animate\(/);assert.match(exam,/data-exit/);assert.match(exam,/finishStage/);
 assert.match(exam,/data\.subject!==run\.current\)\{navigateStage\(run\.started\?run\.current:data\.subjects\[0\]\);\}else\{/);
 assert.match(exam,/:global\(body\.ielts-site:has\(\.exam\)\)[^}]*animation:none/);assert.match(exam,/:global\(html:has\(\.exam\)\)[^}]*scroll-behavior: auto/);assert.match(exam,/legalLinks=\{false\}/);
});

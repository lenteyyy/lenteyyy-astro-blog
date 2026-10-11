import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {scoreAnswers} from '../src/lib/ielts/mock/scoring.ts';
import {workflowUrl} from '../src/lib/ielts/mock/run-policy.ts';
import {safeIeltsNext} from '../src/lib/ielts/oauth-policy.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
for(const book of [16,17,18,19])for(let t=1;t<=4;t++)test(`C${book} T${t} has 80 unique answers, both writing tasks and all original pages/media`,()=>{
 const c=JSON.parse(read(`src/lib/ielts/mock/c${book}-test${t}-content.json`));
 assert.equal(c.sections.listening.length,4);assert.equal(c.sections.reading.length,3);assert.equal(c.sections.writing.length,2);
 const pageURLs=new Set();
 const verifyPage=page=>{
  assert.match(page.url,new RegExp(`^/ielts/mock/c${book}-test-${t}/page-\\d+\\.webp$`));
  assert.ok(existsSync(new URL('../public'+page.url,import.meta.url)));assert.ok(page.width>1000 && page.height>1000);assert.ok(page.lines.length>5);
  for(const l of page.lines){assert.equal(typeof l.text,'string');assert.ok(l.text.length<500);for(const x of ['x','y','w','h'])assert.ok(Number.isFinite(l[x]));assert.ok(l.x>=0&&l.x<=1&&l.y>=0&&l.y<=1);}
  assert.doesNotMatch(page.lines.map(l=>l.text).join(' '),/Listening Script|Audioscripts|Answer keys|Sample answers|Candidate answers/i);pageURLs.add(page.url);
 };
 for(const subject of ['listening','reading']){
  const numbers=[];
  for(const b of c.questions[subject].flat()){
   if(b.type==='scan'){verifyPage(b.page);continue;}
   if(b.type==='pair')numbers.push(...b.numbers);
   if(b.type==='statements')for(const r of b.rows){numbers.push(r.number);assert.ok(b.options.includes(c.answerKeys[subject][r.number-1]));}
   if(b.type==='paragraph')numbers.push(...[...b.text.matchAll(/\{\{(\d+)\}\}/g)].map(m=>+m[1]));
  }
  assert.deepEqual(numbers.sort((a,b)=>a-b),Array.from({length:40},(_,i)=>i+1));assert.equal(c.answerKeys[subject].length,40);
  const answers=Object.fromEntries(c.answerKeys[subject].map((a,i)=>[i+1,a.split('|')[0]]));assert.equal(scoreAnswers(answers,c.answerKeys[subject],c.questions[subject]),40);
  for(const b of c.questions[subject].flat())if(b.type==='pair'){const[a,d]=b.numbers;[answers[a],answers[d]]=[answers[d],answers[a]];assert.ok(b.options.some(o=>o.letter===answers[a]));}
  assert.equal(scoreAnswers(answers,c.answerKeys[subject],c.questions[subject]),40);
 }
 for(const s of c.sections.listening){assert.match(s.audioUrl,new RegExp(`^/ielts/mock/c${book}-test-${t}/part-[1234]\\.mp3$`));assert.ok(existsSync(new URL('../public'+s.audioUrl,import.meta.url)));}
 for(const s of [...c.sections.reading,...c.sections.writing])for(const page of s.scans)verifyPage(page);
 const maps=c.source.questionPages;const expected=new Set([...maps.l.flat(),...maps.r.flat(),...maps.q.flat(),...maps.w].map(n=>`/ielts/mock/c${book}-test-${t}/page-${n}.webp`));assert.deepEqual(pageURLs,expected);
 for(const subject of ['listening','reading','writing']){const url=workflowUrl(book,t,'single',[subject],subject);assert.equal(safeIeltsNext(url),url);}
});

test('source-page annotation uses DOM text, not HTML or a remote document viewer',()=>{
 const renderer=read('src/lib/ielts/mock/scan-page.ts');assert.doesNotMatch(renderer,/innerHTML|outerHTML|insertAdjacentHTML|\bfetch\(|iframe|\beval\(/);assert.match(renderer,/span\.textContent=line\.text/);
 const exam=read('src/components/ielts/MockExam.astro');assert.match(exam,/block\.type==='scan'/);assert.match(exam,/section\.scans\|\|\[\]/);assert.match(exam,/scan-text-line mark\[data-reading-highlight\]/);
});

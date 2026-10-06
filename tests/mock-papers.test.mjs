import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {bookingWindow,isBookableDate} from '../src/lib/ielts/booking-window.ts';
import {cleanPlayback,setupListeningPlayer} from '../src/lib/ielts/mock/listening-player.ts';
import {scoreAnswers} from '../src/lib/ielts/mock/scoring.ts';
import {questionSets as q1} from '../src/lib/ielts/mock/test1-questions.ts';
import {questionSets as q2} from '../src/lib/ielts/mock/test2-questions.ts';
import {questionSets as q3} from '../src/lib/ielts/mock/test3-questions.ts';
import {questionSets as q4} from '../src/lib/ielts/mock/test4-questions.ts';
import {safeIeltsNext} from '../src/lib/ielts/oauth-policy.ts';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('two calendar months clamp at month ends and use Shanghai dates',()=>{
 for(const [now,first,last] of [['2026-10-05T00:00:00Z','2026-10-05','2026-12-05'],['2026-12-31T00:00:00Z','2026-12-31','2027-02-28'],['2027-12-31T00:00:00Z','2027-12-31','2028-02-29'],['2026-10-05T16:01:00Z','2026-10-06','2026-12-06']])assert.deepEqual(bookingWindow(new Date(now)),{first,last});
 const now=new Date('2026-10-05T00:00:00Z');for(const day of ['2026-10-05','2026-12-05'])assert.equal(isBookableDate(day,now),true);for(const day of ['2026-10-04','2026-12-06','2026-11-31','2026-02-30','2026-12-05<script>',null])assert.equal(isBookableDate(day,now),false);
 assert.match(source('src/pages/api/ielts/bookings.ts'),/isBookableDate\(date\)/);
});
test('all four papers include each question exactly once and valid local media',()=>{
 [q1,q2,q3,q4].forEach((questions,i)=>{
  const content=JSON.parse(source(`src/lib/ielts/mock/test${i+1}-content.json`));
  for(const subject of ['listening','reading']){
   const numbers=[];for(const block of questions[subject].flat()){
    if(block.type==='choice')numbers.push(block.number);if(block.type==='pair')numbers.push(...block.numbers);if(block.type==='match'||block.type==='statements')numbers.push(...block.rows.map(r=>r.number));
    for(const match of JSON.stringify(block).matchAll(/\{\{(\d+)\}\}/g))numbers.push(Number(match[1]));
   }
   assert.deepEqual(numbers.sort((a,b)=>a-b),Array.from({length:40},(_,i)=>i+1));assert.equal(content.answerKeys[subject].length,40);
   const answers=Object.fromEntries(content.answerKeys[subject].map((v,i)=>[i+1,v.split('|')[0]]));assert.equal(scoreAnswers(answers,content.answerKeys[subject],questions[subject]),40);
   for(const pair of questions[subject].flat().filter(b=>b.type==='pair')){const[a,b]=pair.numbers;[answers[a],answers[b]]=[answers[b],answers[a]];}
   assert.equal(scoreAnswers(answers,content.answerKeys[subject],questions[subject]),40);
  }
  for(const section of Object.values(content.sections).flat())for(const url of [...section.questionImages,...(section.audioUrl?[section.audioUrl]:[])]){assert.match(url,/^\/ielts\/mock\/test-[1234]\/[a-z0-9-]+\.(mp3|webp)$/);assert.ok(existsSync(new URL('../public'+url,import.meta.url)));}
  assert.equal(content.sections.writing.length,2);
 });
});
test('unordered pairs never award duplicate answers twice',()=>assert.equal(scoreAnswers({'11':'C','12':'C'},Array.from({length:40},(_,i)=>i===10?'C':i===11?'D':'X'),[[{type:'pair',numbers:[11,12],prompt:'',options:[]}]]),1));
test('new paper redirects remain exact allowlisted paths',()=>{for(const n of [1,2,3,4])for(const subject of ['listening','reading','writing']){const p=`/ielts/mock/test-${n}?subject=${subject}`;assert.equal(safeIeltsNext(p),p);}for(const p of ['/ielts/mock/test-5','/ielts/mock/test-2?subject=reading&next=https://evil.test','/ielts/mock/test-2?subject=admin'])assert.equal(safeIeltsNext(p),'/ielts');});
test('stored playback rejects invalid values and untrusted attributes',()=>{assert.deepEqual(cleanPlayback({part:4,time:Infinity,rate:10,complete:'yes',url:'https://evil.test'}),{part:0,time:0,rate:1,complete:false});assert.deepEqual(cleanPlayback({part:2,time:12,rate:1.5,complete:true}),{part:2,time:12,rate:1.5,complete:true});});
test('listening starts synchronously, resumes pause, prevents seeking and sequences all parts',async()=>{
 const events=new Map();let plays=0,saved=cleanPlayback(null),finished=0;
 const audio={controls:true,src:'',playbackRate:1,currentTime:0,duration:10,seeking:false,ended:false,addEventListener:(n,f)=>events.set(n,f),play:()=>{plays++;return Promise.resolve();}};
 const player=setupListeningPlayer(audio,['/1.mp3','/2.mp3','/3.mp3','/4.mp3'],{get:()=>saved,set:v=>saved=v,status:()=>{},complete:()=>finished++});
 player.start(true);assert.equal(plays,1);assert.equal(audio.src,'/1.mp3');assert.equal(audio.controls,false);assert.equal(player.running(),true);
 events.get('pause')();assert.equal(plays,2);audio.currentTime=2;events.get('timeupdate')();audio.currentTime=8;events.get('seeking')();assert.equal(audio.currentTime,2);
 player.rate(1.5);assert.equal(saved.rate,1.5);player.rate(99);assert.equal(audio.playbackRate,1.5);
 for(let i=1;i<=4;i++){audio.ended=true;events.get('ended')();audio.ended=false;if(i<4)assert.equal(audio.src,`/${i+1}.mp3`);}
 assert.equal(player.running(),false);assert.equal(saved.complete,true);assert.equal(finished,1);
 await Promise.resolve();
});
test('playback restores only after metadata and reports autoplay errors',async()=>{
 const events=new Map();let saved={part:1,time:12,rate:1.25,complete:false},blocked=false;
 const audio={controls:true,src:'',playbackRate:1,currentTime:0,duration:20,seeking:false,ended:false,addEventListener:(n,f)=>events.set(n,f),play:()=>Promise.reject(new Error('Blocked'))};
 const player=setupListeningPlayer(audio,['/1','/2','/3','/4'],{get:()=>saved,set:v=>saved=v,status:(_,b)=>blocked=b,complete:()=>{}});player.start(false);assert.equal(audio.src,'/2');events.get('loadedmetadata')();assert.equal(audio.currentTime,12);assert.equal(audio.playbackRate,1.25);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(blocked,true);
});
test('custom exit stops playback without triggering automatic resume and preserves position',()=>{
 const events=new Map();let saved=cleanPlayback(null),plays=0,pauses=0;
 const audio={controls:true,src:'',playbackRate:1,currentTime:0,duration:20,seeking:false,ended:false,addEventListener:(n,f)=>events.set(n,f),play:()=>{plays++;return Promise.resolve();},pause:()=>{pauses++;events.get('pause')();}};
 const player=setupListeningPlayer(audio,['/1','/2','/3','/4'],{get:()=>saved,set:v=>saved=v,status:()=>{},complete:()=>{}});
 player.start(true);audio.currentTime=7;events.get('timeupdate')();player.stop();assert.equal(player.running(),false);assert.equal(pauses,1);assert.equal(plays,1);assert.equal(saved.time,7);player.start(false);events.get('loadedmetadata')();assert.equal(audio.currentTime,7);assert.equal(plays,2);
});
test('question highlights exclude interactive UI and never render saved HTML',()=>{
 const highlights=source('src/lib/ielts/mock/text-highlights.ts');assert.doesNotMatch(highlights,/innerHTML|outerHTML|insertAdjacentHTML|\bfetch\(|\beval\(/);assert.match(highlights,/input,select,textarea,button,a,audio/);assert.match(highlights,/r\.contains\(range\.startContainer\)&&r\.contains\(range\.endContainer\)/);
 const exam=source('src/components/ielts/MockExam.astro');assert.match(exam,/data-highlight-region="questions"/);assert.match(exam,/data-highlight-region="passage"/);assert.doesNotMatch(exam,/<audio controls/);assert.doesNotMatch(exam,/audio\.src\s*=/);assert.match(exam,/t\$\{data\.testNumber\}/);
});

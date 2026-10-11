import { accepts } from './mock/scoring';
import type { ExamPayload } from './mock/papers';
export const REASONS = ['未分类','拼写','定位','同义替换','判断题','理解','漏答','其他'] as const;
export type Reason = typeof REASONS[number];
export type ReviewState = { streak:number; due:number; reviewed:number };
export type Mistake = ReviewState & { id:string; book:number; test:number; subject:'listening'|'reading'; numbers:number[]; answers:string[]; expected:string[]; reason:Reason; note:string; added:number };
export type SavedWord = ReviewState & { id:string; word:string; meaning:string; example:string; group:string; source:string; audioId:string; added:number };
export type Notebook = { version:1; mistakes:Mistake[]; words:SavedWord[] };
export const emptyNotebook = ():Notebook => ({version:1,mistakes:[],words:[]});
const text=(v:unknown,n:number)=>typeof v==='string'?v.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n):'';
const integer=(v:unknown,max:number)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max?v:0;
const time=(v:unknown)=>integer(v,8_640_000_000_000_000);
const state=(v:Record<string,unknown>):ReviewState=>({streak:integer(v.streak,100),due:time(v.due),reviewed:time(v.reviewed)});
export const wordId=(word:string)=>`word:${text(word,80).toLowerCase()}`;
export const mistakeId=(book:number,test:number,subject:string,numbers:number[])=>`c${book}-t${test}-${subject}-${numbers.join('-')}`;
export function notebookKey(account:string):string {
 if(!/^(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|demo)$/i.test(account))throw new TypeError('Invalid account');
 return `ielts-notebook-v1:${account}`;
}
export function cleanNotebook(raw:unknown):Notebook {
 const out=emptyNotebook();if(!raw||typeof raw!=='object'||Array.isArray(raw)||(raw as Notebook).version!==1)return out;
 const value=raw as Notebook,seen=new Set<string>();
 for(const item of Array.isArray(value.mistakes)?value.mistakes.slice(0,2000):[]){
  if(!item||typeof item!=='object'||Array.isArray(item))continue;
  const v=item as unknown as Record<string,unknown>;
  if(![16,17,18,19,20,21].includes(v.book as number)||![1,2,3,4].includes(v.test as number)||!['listening','reading'].includes(v.subject as string))continue;
  const numbers=Array.isArray(v.numbers)?v.numbers.filter(n=>Number.isInteger(n)&&n>=1&&n<=40):[];
  if(!numbers.length||numbers.length>2||new Set(numbers).size!==numbers.length)continue;
  const id=mistakeId(v.book as number,v.test as number,v.subject as string,numbers);if(seen.has(id))continue;seen.add(id);
  out.mistakes.push({id,book:v.book as number,test:v.test as number,subject:v.subject as Mistake['subject'],numbers,answers:numbers.map((_,i)=>text(Array.isArray(v.answers)?v.answers[i]:'',128)),expected:numbers.map((_,i)=>text(Array.isArray(v.expected)?v.expected[i]:'',150)),reason:REASONS.includes(v.reason as Reason)?v.reason as Reason:'未分类',note:text(v.note,800),added:time(v.added),...state(v)});
 }
 seen.clear();for(const item of Array.isArray(value.words)?value.words.slice(0,1000):[]){
  if(!item||typeof item!=='object'||Array.isArray(item))continue;const v=item as unknown as Record<string,unknown>,word=text(v.word,80),id=wordId(word);if(!word||seen.has(id))continue;seen.add(id);
  out.words.push({id,word,meaning:text(v.meaning,200),example:text(v.example,400),group:text(v.group,40)||'我的单词',source:text(v.source,160),audioId:/^[a-z0-9-]{1,100}$/.test(String(v.audioId))?String(v.audioId):'',added:time(v.added),...state(v)});
 }return out;
}
export function gradeGroup(given:string[],expected:string[]):boolean {
 if(given.length!==expected.length)return false;const remaining=[...expected];for(const answer of given){const i=remaining.findIndex(key=>accepts(answer,key));if(i<0)return false;remaining.splice(i,1);}return !remaining.length;
}
export function reviewState(current:ReviewState,correct:boolean,now=Date.now()):ReviewState {
 const streak=correct?Math.min(current.streak+1,100):0;
 const days=correct?[1,3,7,14,30][Math.min(streak-1,4)]:1;
 return {streak,reviewed:now,due:now+days*86400000};
}
export function examMistakes(payload:ExamPayload,answers:Record<string,string>,now=Date.now()):Mistake[] {
 if(payload.subject==='writing')return [];const pairs=payload.blocks.flat().filter(b=>b.type==='pair');
 const paired=new Set(pairs.flatMap(p=>p.numbers));const groups=[...pairs.map(p=>[...p.numbers]),...payload.answerKey.map((_,i)=>[i+1]).filter(([n])=>!paired.has(n))];
 return groups.filter(numbers=>!gradeGroup(numbers.map(n=>answers[n]||''),numbers.map(n=>payload.answerKey[n-1]))).map(numbers=>({id:mistakeId(payload.bookNumber,payload.testNumber,payload.subject,numbers),book:payload.bookNumber,test:payload.testNumber,subject:payload.subject as Mistake['subject'],numbers,answers:numbers.map(n=>text(answers[n],128)),expected:numbers.map(n=>payload.answerKey[n-1]),reason:numbers.every(n=>!answers[n]?.trim())?'漏答':'未分类',note:'',added:now,streak:0,reviewed:0,due:now}));
}
export function mergeMistakes(notebook:Notebook,incoming:Mistake[]):Notebook {
 const map=new Map(notebook.mistakes.map(v=>[v.id,v]));for(const item of incoming){const old=map.get(item.id);map.set(item.id,{...item,reason:old?.reason||item.reason,note:old?.note||'',added:old?.added||item.added});}return cleanNotebook({...notebook,mistakes:[...map.values()]});
}
export function addWord(notebook:Notebook,word:string,details:Partial<SavedWord>={},now=Date.now()):Notebook {
 const id=wordId(word),old=notebook.words.find(v=>v.id===id);
 if(!text(word,80))throw new TypeError('Empty word');
 if(!old&&notebook.words.length>=1000)throw new RangeError('Wordbook full');
 return cleanNotebook({...notebook,words:[{...{id,word,meaning:'',example:'',group:'我的单词',source:'',audioId:'',added:now,streak:0,due:now,reviewed:0},...old,...details,id,word},...notebook.words.filter(v=>v.id!==id)]});
}

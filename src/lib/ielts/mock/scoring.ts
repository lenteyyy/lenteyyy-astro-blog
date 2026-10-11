import type {QuestionBlock} from './test1-questions';
const normal=(s:string)=>s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
export const accepts=(given:string,expected:string)=>!!given&&expected.split('|').some(x=>normal(given)===normal(x));
export function scoreAnswers(answers:Record<string,string>,keys:string[],blocks:QuestionBlock[][]){
 const pairs=blocks.flat().filter((b):b is Extract<QuestionBlock,{type:'pair'}>=>b.type==='pair');
 const paired=new Set(pairs.flatMap(b=>b.numbers));let score=0;
 for(let n=1;n<=keys.length;n++)if(!paired.has(n)&&accepts(answers[n]||'',keys[n-1]))score++;
 for(const {numbers} of pairs){const remaining=numbers.map(n=>keys[n-1]);for(const n of numbers){const i=remaining.findIndex(x=>accepts(answers[n]||'',x));if(i>=0){score++;remaining.splice(i,1);}}}
 return score;
}

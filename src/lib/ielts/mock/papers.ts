import test1 from './test1-content.json';
import test2 from './test2-content.json';
import test3 from './test3-content.json';
import test4 from './test4-content.json';
import c20test1 from './c20-test1-content.json';
import c20test2 from './c20-test2-content.json';
import c20test3 from './c20-test3-content.json';
import c20test4 from './c20-test4-content.json';
import { questionSets as questions1, type QuestionBlock } from './test1-questions';
import { questionSets as questions2 } from './test2-questions';
import { questionSets as questions3 } from './test3-questions';
import { questionSets as questions4 } from './test4-questions';
export type { Subject } from './run-policy';
import type { Subject, ExamMode } from './run-policy';
export type Section={label:string;first:number;last:number;title:string;instructions:string;paragraphs:string[];questionImages:string[];audioUrl:string};
export type ExamPayload={subject:Subject;bookNumber:number;testNumber:number;mode:ExamMode;subjects:Subject[];sections:Section[];answerKey:string[];blocks:QuestionBlock[][];accountId:string;completionOptions:Record<string,string[]>};
export const papers=[{test:test1,questions:questions1},{test:test2,questions:questions2},{test:test3,questions:questions3},{test:test4,questions:questions4}];
export const c20papers=[c20test1,c20test2,c20test3,c20test4].map(test=>({test,questions:test.questions as {listening:QuestionBlock[][];reading:QuestionBlock[][]}}));
export function paperPayload(testNumber:number,subject:Subject,accountId:string,bookNumber=21,mode:ExamMode='single',subjects:Subject[]=[subject]):ExamPayload {
 const paper=(bookNumber===20?c20papers:bookNumber===21?papers:[])[testNumber-1];if(!paper)throw new RangeError('Unknown paper');
 const completionOptions:Record<string,string[]>={};
 if(bookNumber===20&&subject==='reading')Object.assign(completionOptions,c20papers[testNumber-1].test.completionOptions);
 if(bookNumber===21&&subject==='reading'&&testNumber<3)for(let n=testNumber===1?31:30;n<=(testNumber===1?36:35);n++)completionOptions[String(n)]='ABCDEFGHI'.split('');
 if(bookNumber===21&&subject==='reading'&&testNumber===4)for(const [first,last]of [[14,19],[27,32]])for(let n=first;n<=last;n++)completionOptions[String(n)]='ABCDEFGHIJ'.split('');
 return{subject,bookNumber,testNumber,mode,subjects,sections:paper.test.sections[subject],answerKey:subject==='writing'?[]:paper.test.answerKeys[subject],blocks:subject==='writing'?[]:paper.questions[subject],accountId,completionOptions};
}

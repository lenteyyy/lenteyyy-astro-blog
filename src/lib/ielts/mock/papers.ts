import test1 from './test1-content.json';
import test2 from './test2-content.json';
import test3 from './test3-content.json';
import test4 from './test4-content.json';
import { questionSets as questions1, type QuestionBlock } from './test1-questions';
import { questionSets as questions2 } from './test2-questions';
import { questionSets as questions3 } from './test3-questions';
import { questionSets as questions4 } from './test4-questions';
export type Subject='listening'|'reading'|'writing';
export type Section={label:string;first:number;last:number;title:string;instructions:string;paragraphs:string[];questionImages:string[];audioUrl:string};
export type ExamPayload={subject:Subject;testNumber:number;sections:Section[];answerKey:string[];blocks:QuestionBlock[][];accountId:string;completionOptions:Record<string,string[]>};
export const papers=[{test:test1,questions:questions1},{test:test2,questions:questions2},{test:test3,questions:questions3},{test:test4,questions:questions4}];
export function paperPayload(testNumber:number,subject:Subject,accountId:string):ExamPayload {
 const paper=papers[testNumber-1];if(!paper)throw new RangeError('Unknown paper');
 const completionOptions:Record<string,string[]>={};
 if(subject==='reading'&&testNumber<3)for(let n=testNumber===1?31:30;n<=(testNumber===1?36:35);n++)completionOptions[String(n)]='ABCDEFGHI'.split('');
 if(subject==='reading'&&testNumber===4)for(const [first,last]of [[14,19],[27,32]])for(let n=first;n<=last;n++)completionOptions[String(n)]='ABCDEFGHIJ'.split('');
 return{subject,testNumber,sections:paper.test.sections[subject],answerKey:subject==='writing'?[]:paper.test.answerKeys[subject],blocks:subject==='writing'?[]:paper.questions[subject],accountId,completionOptions};
}

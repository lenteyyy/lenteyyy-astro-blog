import type { APIRoute } from 'astro';
import {getAuthContext} from '../../../lib/ielts/auth';
import {json} from '../../../lib/ielts/http';
import {paperPayload} from '../../../lib/ielts/mock/papers';
export const prerender=false;
export const GET:APIRoute=async({request,cookies})=>{
 try{
  const auth=await getAuthContext(cookies,request);if(!auth)return json({error:'unauthorized'},401);
  const params=new URL(request.url).searchParams;
  if(['book','test','subject','question'].some(k=>params.getAll(k).length!==1))return json({error:'invalid_question'},400);
  const book=Number(params.get('book')),test=Number(params.get('test')),subject=params.get('subject'),number=Number(params.get('question'));
  if(![16,17,18,19,20,21].includes(book)||![1,2,3,4].includes(test)||!['listening','reading'].includes(subject||'')||!Number.isInteger(number)||number<1||number>40)return json({error:'invalid_question'},400);
  const data=paperPayload(test,subject as 'listening'|'reading',auth.user.id,book);
  const sectionIndex=data.sections.findIndex(s=>number>=s.first&&number<=s.last);
  const pair=data.blocks.flat().find(b=>b.type==='pair'&&b.numbers.includes(number));
  const numbers=pair?.type==='pair'?[...pair.numbers]:[number];
  return json({section:data.sections[sectionIndex],blocks:data.blocks[sectionIndex],numbers,expected:numbers.map(n=>data.answerKey[n-1])});
 }catch{return json({error:'review_unavailable'},503);}
};

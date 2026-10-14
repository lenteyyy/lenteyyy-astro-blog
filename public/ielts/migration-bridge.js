import {NEW_ORIGIN,MIGRATION_TYPE,validAccount,allowedMigrationKey,validateMigrationEntries} from './local-migration-policy.js';
const status=document.querySelector('[data-status]');
let activeNonce;
addEventListener('message',event=>{
 if(!window.opener||event.source!==window.opener||event.origin!==NEW_ORIGIN||event.data?.type!==MIGRATION_TYPE)return;
 const {action,nonce,account}=event.data;
 if(typeof nonce!=='string'||!/^[a-f0-9-]{36}$/i.test(nonce))return;
 if(action==='done'&&nonce===activeNonce){status.textContent='已导入新站。旧站记录仍保留，可以关闭窗口。';return;}
 if(action!=='read'||!validAccount(account))return;
 activeNonce=nonce;
 try{
  const entries=[];
  for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&allowedMigrationKey(key,account)){const value=localStorage.getItem(key);if(value!==null)entries.push([key,value]);}}
  const checked=validateMigrationEntries(entries,account);
  event.source.postMessage({type:MIGRATION_TYPE,account,nonce,entries:checked},NEW_ORIGIN);
  status.textContent=`已读取 ${checked.length} 项同账号记录，等待新站导入。`;
 }catch{event.source.postMessage({type:MIGRATION_TYPE,account,nonce,error:'invalid_migration'},NEW_ORIGIN);status.textContent='未能读取记录；原数据仍保留。';}
});
if(!window.opener)status.textContent='请登录新站后，通过“迁移旧站学习记录”打开此窗口。';

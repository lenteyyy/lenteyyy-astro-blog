import {cleanNotebook,emptyNotebook,notebookKey,type Notebook} from './notebooks';
export function loadNotebook(account:string):Notebook {
 const key=notebookKey(account);const raw=localStorage.getItem(key);if(!raw)return emptyNotebook();if(raw.length>2_000_000)throw new Error('存档过大，未读取。');
 try{return cleanNotebook(JSON.parse(raw));}catch{throw new Error('存档损坏，未覆盖原数据。');}
}
export function saveNotebook(account:string,value:Notebook):void {
 const clean=cleanNotebook(value),raw=JSON.stringify(clean);if(raw.length>2_000_000)throw new Error('存档空间不足，请先导出并清理。');localStorage.setItem(notebookKey(account),raw);
}

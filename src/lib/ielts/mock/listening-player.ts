export type Playback={part:number;time:number;rate:number;complete:boolean};
const rates=[.75,1,1.25,1.5,2];
export function cleanPlayback(value:unknown):Playback {
 const v=value&&typeof value==='object'?value as Partial<Playback>:{};
 return{part:Number.isInteger(v.part)&&v.part!>=0&&v.part!<4?v.part!:0,time:typeof v.time==='number'&&Number.isFinite(v.time)&&v.time>=0&&v.time<3600?v.time:0,rate:typeof v.rate==='number'&&rates.includes(v.rate)?v.rate:1,complete:v.complete===true};
}
export function setupListeningPlayer(audio:HTMLAudioElement,urls:string[],hooks:{get:()=>Playback;set:(state:Playback)=>void;status:(message:string,blocked:boolean)=>void;complete:()=>void}){
 let active=false,part=0,trustedTime=0,restore:number|null=null,lastSave=0;
 const write=()=>hooks.set({part,time:trustedTime,rate:audio.playbackRate,complete:hooks.get().complete});
 const play=()=>{
  if(!active)return;
  const attempt=audio.play();
  attempt?.then(()=>hooks.status(`录音 ${part+1} / ${urls.length}`,false)).catch(()=>hooks.status('播放被浏览器或系统中断，请恢复播放',true));
 };
 const load=(index:number,time=0)=>{part=index;trustedTime=time;restore=time>0?time:null;audio.src=urls[index];audio.playbackRate=hooks.get().rate;write();play();};
 audio.controls=false;
 audio.addEventListener('loadedmetadata',()=>{if(restore!==null){const value=Number.isFinite(audio.duration)?Math.min(restore,Math.max(0,audio.duration-.1)):restore;trustedTime=value;restore=null;audio.currentTime=value;}});
 audio.addEventListener('pause',()=>{if(active&&!audio.ended)play();});
 audio.addEventListener('error',()=>{if(active)hooks.status('录音载入失败，请恢复播放',true);});
 audio.addEventListener('seeking',()=>{if(active&&Math.abs(audio.currentTime-trustedTime)>.6)audio.currentTime=trustedTime;});
 audio.addEventListener('timeupdate',()=>{if(!active||audio.seeking)return;trustedTime=audio.currentTime;if(Date.now()-lastSave>1000){lastSave=Date.now();write();}});
 audio.addEventListener('ended',()=>{if(!active)return;if(part+1<urls.length){load(part+1);return;}active=false;hooks.set({...hooks.get(),part,time:audio.duration,complete:true});hooks.status('录音播放完毕',false);hooks.complete();});
 const mediaSession=typeof navigator!=='undefined'?navigator.mediaSession:undefined;
 for(const action of ['pause','stop','seekbackward','seekforward','seekto','previoustrack','nexttrack'] as MediaSessionAction[])try{mediaSession?.setActionHandler(action,()=>{if(active)play();});}catch{/* Unsupported system action: no in-page control is exposed. */}
 return{
  start:(fresh:boolean)=>{const saved=fresh?cleanPlayback(null):cleanPlayback(hooks.get());if(saved.complete)return;hooks.set(saved);active=true;load(saved.part,saved.time);},
  running:()=>active,
  retry:()=>{if(audio.error)load(part,trustedTime);else play();},
  rate:(value:number)=>{if(!rates.includes(value))return;audio.playbackRate=value;write();},
 };
}

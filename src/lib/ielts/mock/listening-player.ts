export type Playback={part:number;time:number;rate:number;complete:boolean};
export const LISTENING_RATES=Object.freeze([0.7,0.8,0.9,1,1.1,1.2,1.3]);
export function cleanPlayback(value:unknown):Playback {
 const v=value&&typeof value==='object'?value as Partial<Playback>:{};
 return{part:Number.isInteger(v.part)&&v.part!>=0&&v.part!<4?v.part!:0,time:typeof v.time==='number'&&Number.isFinite(v.time)&&v.time>=0&&v.time<3600?v.time:0,rate:typeof v.rate==='number'&&LISTENING_RATES.includes(v.rate)?v.rate:1,complete:v.complete===true};
}
export function setupListeningPlayer(audio:HTMLAudioElement,urls:string[],hooks:{get:()=>Playback;set:(state:Playback)=>void;status:(message:string,blocked:boolean)=>void;complete:(elapsedSeconds:number)=>void},timing?:{checkCueSeconds:number;partDurations:readonly number[]}){
 if(timing&&(!Number.isFinite(timing.checkCueSeconds)||timing.checkCueSeconds<=0||timing.partDurations.length!==urls.length||timing.partDurations.some(t=>!Number.isFinite(t)||t<=0)))throw new RangeError('Invalid listening timing');
 let active=false,part=0,trustedTime=0,restore:number|null=null,lastSave=0;
 const complete=(position:number)=>{
  if(!active)return;
  const cue=timing?.checkCueSeconds;
  const elapsed=cue===undefined?0:Math.max(0,position-cue)/audio.playbackRate;
  active=false;restore=null;trustedTime=cue??position;
  hooks.set({...hooks.get(),part,time:trustedTime,complete:true});
  if(timing)audio.pause();
  hooks.status('录音播放完毕',false);hooks.complete(elapsed);
 };
 const checkCue=()=>{
  if(active&&timing&&part===urls.length-1&&!audio.seeking&&audio.currentTime>=timing.checkCueSeconds){complete(audio.currentTime);return true;}
  return false;
 };
 const write=()=>hooks.set({part,time:trustedTime,rate:audio.playbackRate,complete:hooks.get().complete});
 const play=()=>{
  if(!active)return;
  const attempt=audio.play();
  attempt?.then(()=>{if(active)hooks.status(`录音 ${part+1} / ${urls.length}`,false);}).catch(()=>{if(active)hooks.status('播放被浏览器或系统中断，请恢复播放',true);});
 };
 const load=(index:number,time=0)=>{part=index;trustedTime=time;restore=time>0?time:null;audio.src=urls[index];audio.playbackRate=hooks.get().rate;write();play();};
 audio.controls=false;
 audio.addEventListener('loadedmetadata',()=>{if(restore!==null){const value=Number.isFinite(audio.duration)?Math.min(restore,Math.max(0,audio.duration-.1)):restore;trustedTime=value;restore=null;audio.currentTime=value;}});
 audio.addEventListener('pause',()=>{if(active&&!audio.ended)play();});
 audio.addEventListener('error',()=>{if(active)hooks.status('录音载入失败，请恢复播放',true);});
 audio.addEventListener('seeking',()=>{if(active&&Math.abs(audio.currentTime-trustedTime)>.6)audio.currentTime=trustedTime;});
 audio.addEventListener('timeupdate',()=>{if(!active||audio.seeking||checkCue())return;trustedTime=audio.currentTime;if(Date.now()-lastSave>1000){lastSave=Date.now();write();}});
 audio.addEventListener('ended',()=>{if(!active)return;if(part+1<urls.length){load(part+1);return;}complete(audio.duration);});
 const mediaSession=typeof navigator!=='undefined'?navigator.mediaSession:undefined;
 for(const action of ['pause','stop','seekbackward','seekforward','seekto','previoustrack','nexttrack'] as MediaSessionAction[])try{mediaSession?.setActionHandler(action,()=>{if(active)play();});}catch{/* Unsupported system action: no in-page control is exposed. */}
 return{
  start:(fresh:boolean)=>{const saved=fresh?cleanPlayback(null):cleanPlayback(hooks.get());if(saved.complete)return;hooks.set(saved);active=true;part=saved.part;audio.playbackRate=saved.rate;if(timing&&part===urls.length-1&&saved.time>=timing.checkCueSeconds){complete(saved.time);return;}load(saved.part,saved.time);},
  running:()=>active,
  remainingSeconds:()=>{const saved=hooks.get();if(!timing||saved.complete)return undefined;const lengths=timing.partDurations,last=lengths.length-1,index=active?part:saved.part,position=active?audio.currentTime:saved.time,rate=active?audio.playbackRate:saved.rate;return(Math.max(0,(index===last?timing.checkCueSeconds:lengths[index])-position)+lengths.slice(index+1,last).reduce((sum,t)=>sum+t,0)+(index<last?timing.checkCueSeconds:0))/rate;},
  checkProgress:checkCue,
  stop:()=>{write();active=false;audio.pause();},
  retry:()=>{if(!active)return;if(audio.error)load(part,trustedTime);else play();},
  rate:(value:number)=>{if(!LISTENING_RATES.includes(value))return;checkCue();audio.playbackRate=value;write();},
 };
}

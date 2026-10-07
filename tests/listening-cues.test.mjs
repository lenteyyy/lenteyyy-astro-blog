import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {LISTENING_AUDIO_SECONDS,listeningCheckCueSeconds} from '../src/lib/ielts/mock/timing-policy.ts';
import {cleanPlayback,setupListeningPlayer,LISTENING_RATES} from '../src/lib/ielts/mock/listening-player.ts';

const fixtures=JSON.parse(readFileSync(new URL('./fixtures/listening-cues.json',import.meta.url),'utf8'));
const mock=()=>{
 const events=new Map();let plays=0,pauses=0;
 const audio={controls:true,src:'',playbackRate:1,currentTime:0,duration:60,seeking:false,ended:false,
  addEventListener:(name,fn)=>events.set(name,fn),play:()=>{plays++;return Promise.resolve();},pause:()=>{pauses++;events.get('pause')?.();}};
 return{audio,events,plays:()=>plays,pauses:()=>pauses};
};

test('cue timestamps are bound to all eight audited recordings and their spoken instructions',()=>{
 for(const book of [20,21])for(let paper=1;paper<=4;paper++){
  const key=`${book}-${paper}`,fixture=fixtures[key],cue=listeningCheckCueSeconds(book,paper);
  const bytes=readFileSync(new URL(`../public/ielts/mock/${book===20?'c20-':''}test-${paper}/part-4.mp3`,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),fixture.sha256,'changed recordings need new cue timestamps');
  assert.equal(cue,fixture.seconds);assert.match(fixture.text,/You now have one minute to check your answers to part 4/);
  assert.ok(cue<LISTENING_AUDIO_SECONDS[key][3]-60);assert.ok(cue>LISTENING_AUDIO_SECONDS[key][3]-110);
 }
});

test('late events, fallback EOF and resumed playback subtract time already spent checking at all rates',()=>{
 for(const rate of LISTENING_RATES)for(const event of ['timeupdate','ended','resume']){
  const fake=mock();let saved=cleanPlayback({part:3,time:event==='resume'?10+3*rate:9,rate}),elapsed=-1,checks=0;
  const player=setupListeningPlayer(fake.audio,['/1','/2','/3','/4'],{get:()=>saved,set:v=>saved=v,status:()=>{},complete:e=>{elapsed=e;checks++;}},{checkCueSeconds:10,partDurations:[20,20,20,90]});
  player.start(false);
  if(event!=='resume'){
   fake.events.get('loadedmetadata')();fake.audio.currentTime=10+3*rate;fake.audio.duration=fake.audio.currentTime;
   if(event==='ended')fake.audio.ended=true;fake.events.get(event)();
  }
  assert.ok(Math.abs(elapsed-3)<1e-9);assert.equal(checks,1);assert.equal(player.running(),false);assert.equal(saved.complete,true);assert.equal(saved.time,10);
  const plays=fake.plays();fake.events.get('pause')();player.retry();player.start(false);fake.events.get('ended')();fake.events.get('timeupdate')();
  assert.equal(fake.plays(),plays);assert.equal(checks,1);assert.equal(fake.pauses(),1);
 }
});

test('remaining listening time follows playback position and rate, without changing the checking allowance',()=>{
 const fake=mock();let saved=cleanPlayback(null);
 const player=setupListeningPlayer(fake.audio,['/1','/2','/3','/4'],{get:()=>saved,set:v=>saved=v,status:()=>{},complete:()=>{}},{checkCueSeconds:10,partDurations:[20,20,20,90]});
 player.start(false);assert.equal(player.remainingSeconds(),70);
 fake.audio.currentTime=5;fake.events.get('timeupdate')();assert.equal(player.remainingSeconds(),65);
 player.rate(1.3);assert.equal(player.remainingSeconds(),50);
 fake.audio.currentTime=19;fake.events.get('timeupdate')();fake.audio.currentTime=80;fake.events.get('seeking')();assert.equal(fake.audio.currentTime,19);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {LISTENING_AUDIO_SECONDS,subjectDurationSeconds,formatExamDuration,LISTENING_CHECK_SECONDS,LISTENING_TIMING_VERSION,migrateListeningDeadline,listeningCheckDeadline,listeningCheckCueSeconds,previousListeningDurationSeconds} from '../src/lib/ielts/mock/timing-policy.ts';
import {cleanPlayback,setupListeningPlayer,LISTENING_RATES} from '../src/lib/ielts/mock/listening-player.ts';
import {cleanRun,completeStage} from '../src/lib/ielts/mock/run-policy.ts';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('each listening clock ends two minutes after the spoken checking cue, not after EOF',()=>{
	assert.equal(subjectDurationSeconds('reading',21,1),3600);
	assert.equal(subjectDurationSeconds('writing',20,4),3600);
	assert.equal(LISTENING_CHECK_SECONDS,120);
	for(const book of [16,17,18,19,20,21])for(let paper=1;paper<=4;paper++){
		const audio=LISTENING_AUDIO_SECONDS[`${book}-${paper}`];assert.equal(audio.length,4);
		const seconds=subjectDurationSeconds('listening',book,paper);
		assert.equal(seconds,Math.ceil(audio.slice(0,3).reduce((total,part)=>total+part,0)+listeningCheckCueSeconds(book,paper))+120);
		assert.ok(seconds<35*60);
		assert.equal(subjectDurationSeconds('reading',book,paper)+subjectDurationSeconds('writing',book,paper)+seconds,7200+seconds);
	}
	assert.equal(formatExamDuration(120),'2 分钟');assert.equal(formatExamDuration(121),'2 分 1 秒');
	assert.throws(()=>subjectDurationSeconds('listening',22,1));assert.throws(()=>subjectDurationSeconds('listening',21,5));
	const exam=read('src/components/ielts/MockExam.astro');
	const home=read('src/pages/ielts/index.astro');
	assert.match(exam,/const duration = subjectDurationSeconds\(data\.subject, data\.bookNumber, data\.testNumber\)/);
	assert.match(home,/total\+subjectDurationSeconds\(s,book,test\)/);
	assert.match(home,/data-mock-simulation-duration/);
	assert.doesNotMatch(exam,/35:00|35 \* 60|35 分钟/);
	assert.doesNotMatch(home,/155 分钟|listening'\?35:60/);
	assert.match(exam,/state\.deadline=listeningCheckDeadline\(Date\.now\(\)-elapsedSeconds\*1000\);save\(\)/);
});

test('all twenty-four papers start exactly two minutes of checking only after Part 4, at every playback rate',async()=>{
	for(const book of [16,17,18,19,20,21])for(let paper=1;paper<=4;paper++)for(const rate of LISTENING_RATES){
		const content=JSON.parse(read(`src/lib/ielts/mock/${book===21?'':`c${book}-`}test${paper}-content.json`));
		const urls=content.sections.listening.map(section=>section.audioUrl);
		assert.equal(urls.length,4);
		const events=new Map();let playback=cleanPlayback({rate}),deadline=0,checks=0,now=1000000;
		const cue=listeningCheckCueSeconds(book,paper);
		const audio={controls:true,src:'',playbackRate:rate,currentTime:0,duration:60,seeking:false,ended:false,addEventListener:(name,handler)=>events.set(name,handler),play:()=>Promise.resolve(),pause:()=>events.get('pause')()};
		const player=setupListeningPlayer(audio,urls,{get:()=>playback,set:value=>playback=value,status:()=>{},complete:elapsed=>{checks++;deadline=listeningCheckDeadline(now-elapsed*1000);}},{checkCueSeconds:cue,partDurations:LISTENING_AUDIO_SECONDS[`${book}-${paper}`]});
		player.start(false);
		for(let part=0;part<4;part++){
			now+=60000/rate;
			if(part<3){audio.ended=true;events.get('ended')();audio.ended=false;audio.currentTime=0;}
			else{audio.currentTime=cue-.01;events.get('timeupdate')();assert.equal(checks,0);audio.currentTime=cue;events.get('timeupdate')();}
			assert.equal(checks,part===3?1:0);
			if(part<3){assert.equal(deadline,0);assert.equal(player.running(),true);}
		}
		assert.equal(deadline-now,120000);
		assert.equal(player.running(),false);
		const restored=JSON.parse(JSON.stringify({deadline,playback,timingVersion:LISTENING_TIMING_VERSION}));
		assert.equal(migrateListeningDeadline(restored.deadline,restored.timingVersion,true,false,now+30000,subjectDurationSeconds('listening',book,paper)),deadline);
		assert.equal(restored.deadline-(now+30000),90000);
		player.start(false);events.get('ended')();assert.equal(checks,1);
		await Promise.resolve();
	}
});

test('old sessions shorten once without deleting answers, reviving finished exams or extending expired checks',()=>{
	const now=1000000,oldDeadline=now+35*60000,duration=subjectDurationSeconds('listening',21,1);
	assert.equal(migrateListeningDeadline(oldDeadline,undefined,false,false,now,duration),now+duration*1000);
	assert.equal(migrateListeningDeadline(oldDeadline,undefined,true,false,now,duration),now+120000);
	assert.equal(migrateListeningDeadline(now+60000,undefined,true,false,now,duration),now+60000);
	assert.equal(migrateListeningDeadline(now-1000,undefined,true,false,now,duration),now-1000);
	assert.equal(migrateListeningDeadline(oldDeadline,undefined,true,true,now,duration),oldDeadline);
	assert.equal(migrateListeningDeadline(oldDeadline,LISTENING_TIMING_VERSION,false,false,now,duration),oldDeadline);
	const exam=read('src/components/ielts/MockExam.astro');
	const previous=previousListeningDurationSeconds(21,1,2);
	assert.equal(migrateListeningDeadline(now+previous*1000,2,false,false,now,duration,previous),now+duration*1000);
	assert.match(exam,/migrateListeningDeadline\(clean\.deadline, value\.timingVersion, clean\.playback\.complete, clean\.finished, Date\.now\(\), duration, previousListeningDurationSeconds/);
	assert.match(exam,/left === 0 && state\.started && !state\.finished && !player\?\.running\(\) && \(data\.subject !== 'listening' \|\| state\.playback\.complete\)\) finishStage\(\)/);
});

test('real exam callbacks count down 02:00, survive refresh, then submit or advance exactly once',async()=>{
	const page=read('src/components/ielts/MockExam.astro');
	const start=page.indexOf('const player=audio?');
	const end=page.indexOf('const element =',start);
	assert.ok(start>0&&end>start);
	const code=ts.transpileModule(page.slice(start,end)+'\nexports.exam={player,updateClock,syncAudioControls,getState:()=>state};',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
	for(const mode of ['single','custom','simulation'])for(const book of [16,17,18,19,20,21])for(let paper=1;paper<=4;paper++){
		let now=1000000,navigations=0;
		const subjects=mode==='single'?['listening']:['listening','reading','writing'];
		const mount=saved=>{
			const exports={},events=new Map(),nodes=new Map();
			for(const selector of ['[data-audio-status]','[data-audio-retry]','[data-audio-rate]','[data-clear]','[data-submit]','[data-clock]'])nodes.set(selector,{textContent:'',value:'',disabled:false,hidden:false,addEventListener(){}});
			const state=saved||{started:true,finished:false,deadline:now-1,playback:cleanPlayback(null),answers:{'1':'sample answer'}};
			const audio={controls:true,src:'',playbackRate:1,currentTime:0,duration:60,seeking:false,ended:false,addEventListener:(name,handler)=>events.set(name,handler),play:()=>Promise.resolve(),pause:()=>events.get('pause')()};
			const run=cleanRun(null,subjects);run.started=true;
			vm.runInNewContext(code,{
				exports,state,audio,run,setupListeningPlayer,listeningCheckDeadline,listeningCheckCueSeconds,LISTENING_AUDIO_SECONDS,LISTENING_CHECK_SECONDS,completeStage,
				Date:class extends Date{static now(){return now;}},
				data:{subject:'listening',mode,subjects,bookNumber:book,testNumber:paper,sections:[1,2,3,4].map(n=>({audioUrl:`/${n}.mp3`})),answerKey:[],blocks:[]},
				duration:subjectDurationSeconds('listening',book,paper),
				$:selector=>nodes.get(selector),root:{querySelectorAll:()=>[]},
				document:{querySelector:()=>undefined},examMistakes:()=>[],loadNotebook:()=>({version:1,mistakes:[],words:[]}),mergeMistakes:(book)=>book,saveNotebook:()=>{},
				save:()=>{},saveRun:()=>{},render:()=>{},
				scoreAnswers:answers=>{assert.equal(answers['1'],'sample answer');return 30;},
				navigateStage:subject=>{assert.equal(subject,'reading');navigations++;},
				dialogBody:{textContent:''},dialog:{open:false,showModal(){this.open=true;}},
			});
			return{...exports.exam,events,audio,nodes};
		};
		let exam=mount();exam.updateClock();assert.equal(exam.getState().finished,false,'refresh must not skip unfinished audio when its old estimate has expired');exam.player.start(false);exam.updateClock();
		assert.equal(exam.getState().finished,false,'never submit while audio is running');
		for(let part=0;part<3;part++){exam.audio.ended=true;exam.events.get('ended')();exam.audio.ended=false;exam.audio.currentTime=0;}
		exam.audio.currentTime=listeningCheckCueSeconds(book,paper);exam.events.get('timeupdate')();
		assert.equal(exam.nodes.get('[data-clock]').textContent,'02:00');
		const saved=JSON.parse(JSON.stringify(exam.getState()));
		now+=30000;exam=mount(saved);exam.player.start(false);exam.syncAudioControls();exam.updateClock();
		assert.equal(exam.nodes.get('[data-clock]').textContent,'01:30');
		assert.equal(exam.nodes.get('[data-audio-status]').textContent,'检查答案：2 分钟');
		now+=89000;exam.updateClock();assert.equal(exam.nodes.get('[data-clock]').textContent,'00:01');assert.equal(exam.getState().finished,false);
		now+=1000;exam.updateClock();assert.equal(exam.getState().finished,true);
		assert.equal(navigations,mode==='single'?0:1);
		exam.updateClock();assert.equal(navigations,mode==='single'?0:1);
		await Promise.resolve();
	}
});

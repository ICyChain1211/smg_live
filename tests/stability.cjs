const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let count=0;
const check=(f)=>{f();count++};
const source=fs.readFileSync(require('node:path').join(__dirname, '..', 'smg_fivestar.user.js'),'utf8');
function setup(){
 let now=1789226200000,id=0,fetchImpl=async()=>new Response('{}'),timers=new Map(),ls=new Map(),fetchCalls=[];
 class XHR {
  constructor(){this.listeners=[];this._text='';this._response='';this.responseType='';}
  open(method,url){this._text='';this._response='';this.readyState=1;}
  get responseText(){return this._text;}
  get response(){return this._response;}
  addEventListener(type,fn){this.listeners.push(fn)}
  finish(url,status,body){this.status=status;this._text=JSON.stringify(body);this._response=this.responseType==='json'?body:this._text;this.readyState=4;this.listeners.forEach(f=>f.call(this));}
 }
 const doc={head:{appendChild(){}},documentElement:{},body:{classList:{toggle(){}}},readyState:'loading',getElementById:()=>true,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},removeEventListener(){}};
 const rawFetch=(...args)=>{fetchCalls.push(args);return fetchImpl(...args)};
 const context=vm.createContext({URL,URLSearchParams,atob,Response,Request,AbortController,console:{log(){},warn(){},error(){}},XMLHttpRequest:XHR,
 window:{fetch:rawFetch,removeEventListener(){}},document:doc,location:{href:'https://live.kankanews.com/huikan'},
 Date:class extends Date{static now(){return now}},
 localStorage:{getItem:k=>ls.get(k)||null,setItem:(k,v)=>ls.set(k,v),removeItem:k=>ls.delete(k)},
 setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms,type:'timeout'});return id},clearTimeout:k=>timers.delete(k),
 setInterval:(fn,ms)=>{timers.set(++id,{fn,ms,type:'interval'});return id},clearInterval:k=>timers.delete(k),
 MutationObserver:class{observe(){}disconnect(){}}});
 const exposed=source.replace(/\}\)\(\);\s*$/,`globalThis.api={parseJwtExp,loadPersistedShiftBase,forceOpenProgram,serverAllowsReview,findDonorIdFromList,findTodayDonorId,getCachedBase,invalidateChannelCache,smgApiGet,maybeAutoCaptureShift,observeStreamResponse,scheduleLoadingSync,cleanupComponent,installReplayUrlPatch,activeComponents,channelShiftBaseCache,channelLiveBaseCache,pendingAcquisitions,watchedVideos,wrapComponentMethod,startLoadingMonitor,setAcquire:fn=>acquireShiftBase=fn};})();`);
 vm.runInContext(exposed,context);
 return {c:context,a:context.api,ls,timers,fetchCalls,setFetch:f=>fetchImpl=f,setNow:n=>now=n,now:()=>now};
}
const token=(exp,cdn)=>'https://example.com/live/test.m3u8?token=x.'+Buffer.from(JSON.stringify({exp})).toString('base64url')+'.x'+(cdn===undefined?'':'&volcTime='+cdn);
const tick=async()=>{for(let i=0;i<8;i++) await Promise.resolve()};
(async()=>{
 const e=setup(),a=e.a;
 check(()=>assert.equal(a.parseJwtExp(token(1789266170,1789223570)),1789223540000));
 check(()=>assert.equal(a.parseJwtExp(token(1789223300,1789223570)),1789223270000));
 check(()=>assert.equal(a.parseJwtExp(token(1789266170)),1789266140000));
 check(()=>assert.equal(a.parseJwtExp(token(1789266170,'bad')),null));
 e.ls.set('smgtv_shift_base_10',JSON.stringify({url:token(1789266170,1789223570),exp:1789266170000}));
 check(()=>assert.equal(a.loadPersistedShiftBase(10),null));
 check(()=>assert.equal(e.ls.has('smgtv_shift_base_10'),false));
 const unavailable={id:1,name:'不可回看',can_review:0,is_review:0},available={id:2,name:'体育新闻',can_review:1,is_review:1};
 a.forceOpenProgram(unavailable);a.forceOpenProgram(available);a.forceOpenProgram(unavailable);
 check(()=>assert.equal(unavailable.is_review,1));
 check(()=>assert.equal(a.serverAllowsReview(unavailable),false));
 check(()=>assert.equal(a.findDonorIdFromList([unavailable,available]),2));
 check(()=>assert.equal(a.serverAllowsReview(JSON.parse(JSON.stringify(unavailable))),false));
 // Internal API reads bypass the installed response-rewrite wrapper.
 e.setFetch(async()=>new Response(JSON.stringify({result:{programs:[{id:3,can_review:0,is_review:0}]}})));
 const raw=await a.smgApiGet('/content/pc/tv/programs',{channel_id:10});
 check(()=>assert.equal(raw.result.programs[0].is_review,0));
 const external=await e.c.window.fetch('https://kapi.kankanews.com/content/pc/tv/programs');
 const externalBody=await external.json();check(()=>assert.equal(externalBody.result.programs[0].is_review,1));
 // Timeout includes body consumption; finally removes the timer.
 let aborted=false;
 e.setFetch((url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new Error('timeout'))})));
 const hung=a.smgApiGet('/content/pc/tv/programs',{});
 const timeout=[...e.timers.values()].find(t=>t.ms===10000);timeout.fn();
 const hungResult=await hung;check(()=>assert.equal(hungResult,null));
 check(()=>assert.equal(aborted,true));
 check(()=>assert.equal([...e.timers.values()].some(t=>t.ms===10000),false));
 // Deduplication and no stale completion after switching channels.
 const f=setup();let resolve,calls=0,starts=0;
 f.a.setAcquire(()=>{calls++;return new Promise(r=>resolve=r)});
 const comp={__smgPatched:true,__smgNeedShiftBase:true,currChannel:{id:10},initPlayer(){starts++}};
 const one=f.a.maybeAutoCaptureShift(comp),two=f.a.maybeAutoCaptureShift(comp);await tick();
 check(()=>assert.equal(calls,1));
 comp.currChannel={id:1};comp.__smgGeneration=1;resolve('source');await one;await two;
 check(()=>assert.equal(starts,0));check(()=>assert.equal(comp.__smgAcquiring,false));
 // Synchronous acquisition exception never leaves the lock set.
 const g=setup();g.a.setAcquire(()=>{throw new Error('fail')});
 const bad={__smgPatched:true,__smgNeedShiftBase:true,currChannel:{id:10}};
 await g.a.maybeAutoCaptureShift(bad);
 check(()=>assert.equal(bad.__smgAcquiring,false));
 check(()=>assert.equal(bad.__smgAcquireAttempts,1));
 g.setNow(g.now()+61000);await g.a.maybeAutoCaptureShift(bad);g.setNow(g.now()+61000);await g.a.maybeAutoCaptureShift(bad);
 check(()=>assert.equal(bad.__smgRetryStopped,true));
 await g.a.maybeAutoCaptureShift(bad);check(()=>assert.equal(bad.__smgAcquireAttempts,3));
 // An already populated cache must still restart a failed player once.
 const h=setup();let restarts=0;
 h.a.channelShiftBaseCache['10']={url:'https://example.com/fresh.m3u8',exp:h.now()+60000};
 const cached={__smgPatched:true,__smgNeedShiftBase:true,currChannel:{id:10},initPlayer(){restarts++}};
 await h.a.maybeAutoCaptureShift(cached);check(()=>assert.equal(restarts,1));
 // Only failures for this component's current manifest invalidate its cache.
 h.a.activeComponents.add(cached);cached.__smgStreamUrl='https://example.com/current.m3u8';
 h.a.observeStreamResponse('https://example.com/old.m3u8',403);
 check(()=>assert.equal(cached.__smgNeedShiftBase,false));
 h.a.observeStreamResponse(cached.__smgStreamUrl,403);
 check(()=>assert.equal(cached.__smgNeedShiftBase,true));check(()=>assert.equal(h.a.getCachedBase(10),''));
 // Event bursts coalesce into one callback, and cleanup cancels it.
 for(let i=0;i<100;i++)h.a.scheduleLoadingSync(cached);
 check(()=>assert.equal([...h.timers.values()].filter(t=>t.ms===100).length,1));
 h.a.cleanupComponent(cached);
 check(()=>assert.equal([...h.timers.values()].filter(t=>t.ms===100).length,0));
 check(()=>assert.equal(h.a.activeComponents.has(cached),false));
 // XHR reuse cannot return the previous rewritten response; unrelated APIs stay untouched.
 const x=new e.c.XMLHttpRequest();x.open('GET','https://kapi.kankanews.com/content/pc/tv/programs');
 x.finish('',200,{result:{programs:[{id:1,is_review:0}]}});
 check(()=>assert.equal(JSON.parse(x.responseText).result.programs[0].is_review,1));
 x.open('GET','https://example.com/other');x.finish('',200,{fresh:true});
 check(()=>assert.equal(JSON.parse(x.responseText).fresh,true));check(()=>assert.equal(x.listeners.length,1));
 const q=new e.c.XMLHttpRequest();q.responseType='json';q.open('GET','https://kapi.kankanews.com/content/pc/tv/programs');q.finish('',200,{result:{programs:[{is_review:0}]}});
 check(()=>assert.equal(q.response.result.programs[0].is_review,1));
 // Healthy playback does not get restarted just because a cached deadline passes.
 const j=setup();let healthyRestarts=0;
 const healthy={__smgPatched:true,__smgNeedShiftBase:false,currChannel:{id:10},initPlayer(){healthyRestarts++}};
 await j.a.maybeAutoCaptureShift(healthy);check(()=>assert.equal(healthyRestarts,0));
 // Player creation should replace known-expired addresses using a valid cache.
 let config;
 const playerComp={currChannel:{id:10},programObj:{},$xgplayer:class{constructor(c){config=c}}};
 j.a.channelShiftBaseCache['10']={url:token(1789266170,1789228000),exp:1789227970000};
 j.a.installReplayUrlPatch(playerComp);new playerComp.$xgplayer({url:token(1789266170,1789223570),isLive:true});
 check(()=>assert.equal(config.url,token(1789266170,1789228000)));
 // Disposing during an acquisition must not restart detached components.
 const disposed=setup();let finish,disposeStarts=0;
 disposed.a.setAcquire(()=>new Promise(r=>finish=r));
 const dc={__smgPatched:true,__smgNeedShiftBase:true,currChannel:{id:10},initPlayer(){disposeStarts++}};
 const dp=disposed.a.maybeAutoCaptureShift(dc);await tick();disposed.a.cleanupComponent(dc);finish('source');await dp;
 check(()=>assert.equal(disposeStarts,0));
 // initPlayer throwing keeps recovery enabled and counts only one attempt.
 const throwing=setup();throwing.a.setAcquire(async()=> 'source');
 const tc={__smgPatched:true,__smgNeedShiftBase:true,currChannel:{id:10},initPlayer(){throw new Error('player failed')}};
 await throwing.a.maybeAutoCaptureShift(tc);
 check(()=>assert.equal(tc.__smgNeedShiftBase,true));
 check(()=>assert.equal(tc.__smgAcquireAttempts,1));
 check(()=>assert.equal(tc.__smgAcquiring,false));
 console.log(`${count} behavioral checks passed. No live network or installed userscript changes.`);
})().catch(e=>{console.error(e);process.exitCode=1});

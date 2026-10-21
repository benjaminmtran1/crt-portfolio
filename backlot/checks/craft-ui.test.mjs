// Real DOM/event checks, matching the construction UI harness. Rendering is
// stubbed here; the truck's native Canvas appearance is checked separately.
// ADMIN_DOM_MODULE=/absolute/path/to/linkedom when not installed locally.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {World,stages,WIDTH,HEIGHT,distance,blocked,craftTruck,craftHit,craftStop} from '../world.mjs';
import {LotLife} from '../life.mjs';
import {BuildSequence,buildSteps,lightingLooks} from '../departments.mjs';
import * as contentAPI from '../content.mjs';
import * as encounterAPI from '../encounters.mjs';
const require=createRequire(import.meta.url),{parseHTML}=require(process.env.ADMIN_DOM_MODULE||'linkedom');
const root=new URL('../../',import.meta.url);
async function boot(reduced=false,saved={}){
 const html=fs.readFileSync(new URL('index.html',root),'utf8'),raw=JSON.parse(fs.readFileSync(new URL('content.json',root),'utf8'));
 const source=fs.readFileSync(new URL('backlot/app.mjs',root),'utf8').replace(/^import .*;\n/gm,'');
 const {document,Event}=parseHTML(html),get=s=>document.querySelector(s),storage=new Map(Object.entries(saved)),writes=[],listeners=new Map();let now=0,portraits=0;
 document.fonts={ready:Promise.resolve()};document.hidden=false;document.hasFocus=()=>true;
 get('#panel').open=false;get('#panel').showModal=function(){this.open=true;};get('#panel').close=function(){this.open=false;this.dispatchEvent(new Event('close'));};
 for(const el of document.querySelectorAll('*')){el.getBoundingClientRect=()=>({left:0,top:0,right:900,bottom:720,width:900,height:720});el.focus=function(){document.activeElement=this;};}
 document.activeElement=document.body;
 const renderer=new Proxy({camera:{},drawCrewPortrait(){portraits++;},screenToWorld:(x,y)=>({x,y})},{get:(o,k)=>k in o?o[k]:()=>{}});
 const env={document,window:{addEventListener:(k,fn)=>listeners.set(k,fn)},getComputedStyle:()=>({flexDirection:'column',gap:'0'}),matchMedia:q=>({matches:q.includes('reduced-motion')?reduced:false}),localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{storage.set(k,v);writes.push({key:k,value:v});}},location:{hash:'',pathname:'/',search:''},history:{replaceState(){}},ResizeObserver:class{observe(){}},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},fetch:async()=>({ok:true,json:async()=>structuredClone(raw)}),console,URLSearchParams,World,stages,WIDTH,HEIGHT,distance,LotLife,BuildSequence,buildSteps,lightingLooks,...contentAPI,...encounterAPI,Renderer:class{constructor(){return renderer;}},TitleScene:class{resize(){}render(){}}};
 const app=await vm.runInNewContext('(async()=>{'+source+'\nreturn {dismissIntro,closePanel,openIndex,handleLifeEvents,settings,life,world,frame};})()',env);app.dismissIntro();
 return{app,get,document,storage,writes,portraits:()=>portraits,
  frame(hz=60){app.frame(now+=1000/hz);},
  advance(seconds,hz=60){for(let i=0;i<seconds*hz;i++)this.frame(hz);},
  click(s){const node=get(s);assert.ok(node,s);node.dispatchEvent(new Event('click',{bubbles:true}));},
  key(key){listeners.get('keydown')({key,repeat:false,target:get('#world'),preventDefault(){}});listeners.get('keyup')({key});},
  pointer(point,pointerType='mouse'){for(const type of ['pointerdown','pointerup'])get('#world').dispatchEvent(Object.assign(new Event(type,{bubbles:true}),{pointerId:1,pointerType,clientX:point.x,clientY:point.y}));}
 };
}
const craftOpen=t=>{assert.equal(t.get('#panel').open,true);assert.equal(t.get('#panel').dataset.kind,'craft');assert.equal(t.app.world.paused,true);assert.equal(t.get('#panel-title').textContent,'Coffee’s on.');assert.equal(t.get('#crew-reply').getAttribute('role'),'status');assert.equal(t.get('#crew-portrait').getAttribute('aria-hidden'),'true');assert.deepEqual([...t.get('.crew-choices').querySelectorAll('button')].map(b=>b.dataset.chat),['day','rumour','coffee']);};
const arrive=(t,hz)=>{for(let i=0;i<hz*40&&!t.get('#panel').open;i++){t.frame(hz);assert.ok(!blocked(t.app.world.player.x,t.app.world.player.y),'Craft approach never clips scenery');}craftOpen(t);assert.ok(distance(t.app.world.player,craftStop)<10);assert.equal(t.app.world.path.length,0);assert.equal(t.app.world.destination,null);};
const body={x:craftTruck.body.x+50,y:craftTruck.body.y+20},sign={x:craftTruck.body.x+50,y:craftHit.sign.y+10};

// The roof sign must not steal clicks on the adjacent Narrative doorway.
for(const pointerType of ['mouse','touch']){
 const t=await boot(),door=stages.find(s=>s.id==='narrative').door;t.pointer(door,pointerType);
 assert.equal(t.app.world.destination,'narrative','Stage 01 keeps its own door target beside the truck sign');
}

// Use actual canvas pointer listeners: both mouse and touch on the raised sign
// and body must walk to the serving apron and open the existing conversation.
for(const hz of [30,60,120])for(const point of [body,sign])for(const pointerType of ['mouse','touch']){
 const t=await boot();t.pointer(point,pointerType);assert.equal(t.get('#panel').open,false);assert.equal(t.app.world.destination,'egg:craft');assert.ok(t.app.world.path.length);assert.ok(distance(t.app.world.path.at(-1),craftStop)<8);arrive(t,hz);
 assert.equal(t.app.life.found.has('craft'),false,'Opening the panel alone does not award a conversation stamp');assert.equal(t.app.life.hasCoffee,false,'Walking up and opening the truck does not equip coffee');
 const before={...t.app.world.player},time=t.app.world.t;t.advance(1,hz);assert.deepEqual(t.app.world.player,before);assert.equal(t.app.world.t,time,'The craft conversation pauses the lot');
 t.click('.department-return');assert.equal(t.get('#panel').open,false);assert.equal(t.app.world.paused,false);assert.equal(t.document.activeElement,t.get('#world'));t.frame(hz);assert.ok(t.app.world.t>time);
}

{
 const t=await boot(),{app,get}=t;Object.assign(app.world.player,craftStop);t.frame();assert.equal(get('#interact-label').textContent,'Take a break');assert.equal(get('#interaction-caption').textContent,'CRAFT SERVICES');
 t.key('e');craftOpen(t);assert.equal(t.portraits(),1);
 t.click('[data-chat="coffee"]');assert.match(get('#crew-reply').textContent,/One coffee\. No quest attached\./);assert.equal(app.life.hasCoffee,true,'The real coffee button equips the takeaway cup');assert.ok(app.life.found.has('craft'));assert.deepEqual(JSON.parse(t.storage.get('backlot-crew-v1')),['craft']);
 const gossip=[];for(let i=0;i<5;i++){t.click('[data-chat="day"]');gossip.push(get('#crew-reply').textContent);}
 assert.equal(new Set(gossip.slice(0,4)).size,4,'Crew chatter rotates through four replies');assert.equal(gossip[4],gossip[0],'Crew chatter loops safely');assert.equal(app.life.chatCount,5);
 t.click('[data-chat="rumour"]');assert.match(get('#crew-reply').textContent,/shop cat/);assert.equal(app.life.chatCount,5,'Coffee and hints do not consume gossip');
 assert.equal(t.writes.filter(w=>w.key==='backlot-crew-v1').length,1,'Repeated conversations do not rewrite or duplicate the craft award');
 for(const [earned,hint] of [['cat',/service lane/],['backstage',/lighting desk/],['lighting',/drafting table/],['build',/clapperboard/],['take',/every corner/]]){
  app.life.discover(earned);app.handleLifeEvents();t.click('[data-chat="rumour"]');assert.match(get('#crew-reply').textContent,hint,'Rumours advance with existing discoveries');
 }
 const saved=Object.fromEntries(t.storage),stamps=JSON.parse(t.storage.get('backlot-crew-v1'));assert.equal(stamps.length,6);
 for(const open of [()=>t.key('Enter'),()=>t.click('#touch-action'),()=>t.pointer(body,'touch')]){
  t.click('[data-close]');assert.equal(get('#panel').open,false);open();craftOpen(t);assert.match(get('#crew-reply').textContent,/Grab a cup/,'Reopening starts a fresh conversation without losing discoveries');t.click('[data-chat="coffee"]');assert.deepEqual(JSON.parse(t.storage.get('backlot-crew-v1')),stamps);
 }
 app.openIndex();assert.notEqual(get('#panel').dataset.kind,'craft');assert.equal(get('#crew-reply'),null,'Opening the work index removes the craft conversation');app.closePanel();t.click('#touch-action');craftOpen(t);
 const restored=await boot(true,saved);assert.equal(restored.app.settings.reduced,true);assert.equal(restored.app.life.reduced,true);assert.deepEqual([...restored.app.life.found],stamps);restored.pointer(sign,'touch');arrive(restored,60);restored.click('[data-chat="rumour"]');assert.match(restored.get('#crew-reply').textContent,/every corner/);restored.click('[data-chat="coffee"]');assert.deepEqual(JSON.parse(restored.storage.get('backlot-crew-v1')),stamps);
}

for(const reduced of [false,true]){
 const t=await boot(reduced),{app,get}=t;Object.assign(app.world.player,craftStop);app.life.interact('slate',app.world);app.handleLifeEvents();assert.ok(app.life.take);
 t.pointer(body);t.pointer(sign,'touch');t.key('e');t.key('Enter');t.click('#touch-action');assert.equal(get('#panel').open,false);assert.equal(app.world.path.length,0);assert.equal(app.life.found.has('craft'),false,'A take suppresses every craft entry method');
 t.key('Escape');assert.equal(app.life.take,null);assert.equal(app.life.found.has('take'),false,'Skipping does not give a take stamp');t.click('#touch-action');craftOpen(t);t.click('[data-chat="coffee"]');t.click('[data-close]');
 app.life.interact('slate',app.world);app.handleLifeEvents();t.advance(10.7);assert.equal(app.life.take,null);assert.ok(app.life.found.has('take'));t.key('e');craftOpen(t);assert.ok(app.life.found.has('craft'),'Completed takes preserve craft discoveries');
}

// Coffee is carried for this session, not inferred from an earned craft stamp.
// Exercise the actual controls across interruption/navigation and calmer motion.
for(const reduced of [false,true]){
 const t=await boot(reduced,{'backlot-crew-v1':'["craft"]'}),{app,get}=t;
 assert.equal(app.life.hasCoffee,false,'Reloading a saved craft stamp starts empty-handed');
 Object.assign(app.world.player,craftStop);t.key('e');craftOpen(t);
 for(const topic of ['day','rumour']){t.click(`[data-chat="${topic}"]`);assert.equal(app.life.hasCoffee,false,'Gossip and hints do not silently order a drink');}
 const savedBefore=Object.fromEntries(t.storage),writesBefore=t.writes.length;
 t.click('[data-chat="coffee"]');assert.equal(app.life.hasCoffee,true);
 t.click('[data-chat="coffee"]');assert.equal(app.life.hasCoffee,true);
 assert.equal(t.writes.length,writesBefore,'An already-earned stamp needs no write when ordering coffee');
 assert.deepEqual(Object.fromEntries(t.storage),savedBefore,'Coffee is not written to persistent storage');
 t.click('[data-close]');assert.equal(app.life.hasCoffee,true);
 t.pointer({x:376,y:376});t.advance(2);assert.ok(distance(app.world.player,craftStop)>60);assert.equal(app.life.hasCoffee,true,'Walking away keeps the cup');
 app.openIndex();assert.equal(app.life.hasCoffee,true);app.closePanel();assert.equal(app.life.hasCoffee,true,'Index navigation retains coffee');
 app.life.interact('lighting',app.world);app.handleLifeEvents();assert.equal(get('#panel').dataset.kind,'lighting');
 t.click('[data-light="night"]');assert.equal(app.life.lighting,'night');assert.equal(app.life.hasCoffee,true);t.click('[data-close]');
 for(const skipped of [true,false]){
  app.life.interact('slate',app.world);app.handleLifeEvents();assert.ok(app.life.take);assert.equal(app.life.hasCoffee,true);
  if(skipped)t.key('Escape');else t.advance(10.7);
  assert.equal(app.life.take,null);assert.equal(app.life.hasCoffee,true,'Skipped and completed takes both keep the cup');
 }
 t.click('#settings-button');t.click('[data-title]');assert.equal(get('#title-screen').hidden,false);assert.equal(app.life.hasCoffee,true,'Returning to the title is not a new session');
 t.click('#title-work');assert.equal(get('#title-screen').hidden,true);assert.equal(app.life.hasCoffee,true,'Reentering through Work index retains coffee');app.closePanel();
 const reloaded=await boot(reduced,Object.fromEntries(t.storage));assert.equal(reloaded.app.life.hasCoffee,false,'A real app reload drops the carried drink, not saved stamps');assert.ok(reloaded.app.life.found.has('craft'));
}
console.log('Craft DOM passed: mouse/touch body/sign auto-approach at 30/60/120 Hz, keyboard/Enter/touch nearby entry, explicit session-only coffee, looping gossip, progressive hints, unique saved stamps and reload, repeated close/reopen, index/title navigation, walking, lighting, pause/resume, take isolation/skip/completion and reduced motion.');

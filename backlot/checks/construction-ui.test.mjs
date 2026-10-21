// Real DOM/event checks with linkedom, also used by admin-editor.test.mjs.
// Run with ADMIN_DOM_MODULE=/absolute/path/to/linkedom when not installed locally.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {World,stages,WIDTH,HEIGHT,distance} from '../world.mjs';
import {LotLife} from '../life.mjs';
import {BuildSequence,buildSteps,lightingLooks} from '../departments.mjs';
import * as contentAPI from '../content.mjs';
const require=createRequire(import.meta.url),{parseHTML}=require(process.env.ADMIN_DOM_MODULE||'linkedom');
const root=new URL('../../',import.meta.url),html=fs.readFileSync(new URL('index.html',root),'utf8'),raw=JSON.parse(fs.readFileSync(new URL('content.json',root),'utf8'));
const source=fs.readFileSync(new URL('backlot/app.mjs',root),'utf8').replace(/^import .*;\n/gm,'');
async function boot(reduced=false,saved={}){
 const {document,Event}=parseHTML(html),get=s=>document.querySelector(s),storage=new Map(Object.entries(saved)),listeners=new Map(),drawn=[];
 document.fonts={ready:Promise.resolve()};document.hidden=false;let focused=true,now=0;
 document.hasFocus=()=>focused;get('#panel').open=false;get('#panel').showModal=function(){this.open=true;};get('#panel').close=function(){this.open=false;this.dispatchEvent(new Event('close'));};
 for(const el of document.querySelectorAll('*')){el.getBoundingClientRect=()=>({left:0,top:0,right:900,bottom:720,width:900,height:720});el.focus=function(){document.activeElement=this;};}
 document.activeElement=document.body;
 const renderer=new Proxy({camera:{},drawConstruction(_c,s){drawn.push({elapsed:s.elapsed,step:s.step});},screenToWorld:(x,y)=>({x,y})},{get:(o,k)=>k in o?o[k]:()=>{}});
 const env={document,window:{addEventListener:(k,fn)=>listeners.set(k,fn)},getComputedStyle:()=>({flexDirection:'column',gap:'0'}),matchMedia:q=>({matches:q.includes('reduced-motion')?reduced:false}),localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{hash:'',pathname:'/',search:''},history:{replaceState(){}},ResizeObserver:class{observe(){}},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},fetch:async()=>({ok:true,json:async()=>structuredClone(raw)}),console,URLSearchParams,World,stages,WIDTH,HEIGHT,distance,LotLife,BuildSequence,buildSteps,lightingLooks,...contentAPI,Renderer:class{constructor(){return renderer;}},TitleScene:class{resize(){}render(){}}};
 const app=await vm.runInNewContext('(async()=>{'+source+'\nreturn {dismissIntro,openBuild,closePanel,openIndex,settings,life,world,frame,seq:()=>buildSequence};})()',env);
 app.dismissIntro();
 return{app,get,document,Event,storage,drawn,focus:v=>{focused=v;},advance(seconds){for(let i=0;i<seconds*60;i++)app.frame(now+=1000/60);},click(s){const b=get(s);assert.ok(b,s);b.dispatchEvent(new Event('click',{bubbles:true}));}};
}
{
 const t=await boot(),{app,get}=t;const item=app.life.hotspot('build');Object.assign(app.world.player,item.point);
 t.click('#touch-action');assert.ok(app.seq(),'The touch action opens the nearby drafting table');
 assert.equal(get('#panel').open,true);assert.equal(app.world.paused,true);assert.equal(app.life.found.has('build'),false);
 const buttons=[...get('.build-steps').querySelectorAll('button')];assert.deepEqual(buttons.map(b=>b.textContent.slice(2)),['Design','Mark out','Build','Shoot']);
 assert.equal(get('[data-build-step="0"]').getAttribute('aria-pressed'),'true');assert.match(get('#build-preview').getAttribute('aria-label'),/Design/);
 assert.equal(get('#build-play').textContent,'PAUSE BUILD');t.advance(1);const before=app.seq().elapsed;
 t.click('[data-build-play]');t.advance(1);assert.equal(app.seq().elapsed,before);assert.equal(get('#build-play').textContent,'PLAY BUILD');
 t.click('[data-build-play]');t.advance(.5);assert.ok(app.seq().elapsed>before);
 for(const step of [2,0,1,2]){
  t.click(`[data-build-step="${step}"]`);assert.equal(app.seq().step,step);assert.equal(app.seq().playing,false);assert.equal(app.life.found.has('build'),false,'Selecting an earlier step is not a completed discovery');
  assert.equal(get(`[data-build-step="${step}"]`).getAttribute('aria-pressed'),'true');assert.equal(buttons.filter(b=>b.getAttribute('aria-pressed')==='true').length,1);assert.match(get('#build-preview').getAttribute('aria-label'),new RegExp(buildSteps[step].title));
 }
 t.click('[data-build-step="3"]');assert.ok(app.seq().complete);assert.ok(app.life.found.has('build'));assert.ok(JSON.parse(t.storage.get('backlot-crew-v1')).includes('build'));assert.equal(get('#build-play').textContent,'REPLAY BUILD');
 t.click('[data-build-play]');assert.equal(app.seq().elapsed,0);assert.equal(app.seq().step,0);assert.equal(get('#build-play').textContent,'PAUSE BUILD');
 t.advance(1);const paused=app.seq().elapsed;t.document.hidden=true;t.advance(1);assert.equal(app.seq().elapsed,paused);t.document.hidden=false;t.focus(false);t.advance(1);assert.equal(app.seq().elapsed,paused);t.focus(true);t.advance(.1);assert.ok(app.seq().elapsed>paused);
 t.click('[data-close]');assert.equal(app.seq(),null);assert.equal(get('#panel').open,false);const renders=t.drawn.length;t.advance(1);assert.equal(t.drawn.length,renders,'Closing stops rendering and progression');
 app.openBuild();assert.equal(app.seq().step,0);app.openIndex();assert.equal(app.seq(),null,'Navigating to other content cancels the miniature');assert.ok(app.life.found.has('build'));
 app.closePanel();app.openBuild();t.advance(12.1);assert.ok(app.seq().complete);assert.equal(app.seq().playing,false);assert.equal(get('[data-build-step="3"]').getAttribute('aria-pressed'),'true');assert.equal(get('#build-play').textContent,'REPLAY BUILD');
}
{
 const t=await boot(true,{'backlot-crew-v1':'["cat","take"]'}),{app,get}=t;app.openBuild();
 assert.equal(app.seq().playing,false);assert.equal(app.seq().step,0);assert.ok(get('#build-play').hasAttribute('hidden'));
 const before=app.seq().elapsed;t.advance(10);assert.equal(app.seq().elapsed,before);
 for(const i of [0,1,2,3]){t.click(`[data-build-step="${i}"]`);assert.equal(app.seq().step,i);assert.equal(app.seq().playing,false);}
 assert.ok(app.life.found.has('build'));assert.ok(app.life.found.has('cat'));assert.ok(app.life.found.has('take'));
 app.closePanel();app.openBuild();assert.equal(app.seq().step,0);assert.equal(app.seq().playing,false);assert.ok(app.life.found.has('build'));
}
console.log('Drafting-table DOM passed: exact four controls, active/accessible labels, touch entry, pause/resume/replay, repeated/manual selection, complete-only discovery persistence, hidden/unfocused/closed pauses, navigation interruption, reopen, and reduced motion with existing discoveries.');

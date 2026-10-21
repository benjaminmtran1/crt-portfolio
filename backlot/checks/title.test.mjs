// Title lifecycle tests use a minimal DOM, not a substitute for browser layout QA.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {World,stages,WIDTH,HEIGHT,distance} from '../world.mjs';
import {LotLife,catHome} from '../life.mjs';
import {BuildSequence,buildSteps,lightingLooks} from '../departments.mjs';
import * as contentAPI from '../content.mjs';
const root=new URL('../../',import.meta.url),html=fs.readFileSync(new URL('index.html',root),'utf8');
const source=fs.readFileSync(new URL('backlot/app.mjs',root),'utf8').replace(/^import .*;\n/gm,'');
const raw=JSON.parse(fs.readFileSync(new URL('content.json',root),'utf8'));
async function boot({reduced=false,hash='',failure=false,saved={}}={}){
 let document,now=0,serial=0;const timers=new Map(),raf=[],nodes=new Map(),listeners=new Map(),storage=new Map(Object.entries(saved));
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.dataset={};this.events=new Map();this.disabled=false;this.hidden=false;this.open=false;this.inert=false;this.isConnected=true;this.clientWidth=900;this.clientHeight=720;this.innerHTML='';this._text='';this.style={setProperty(){},removeProperty(){}};const classes=new Set();this.classList={add:(...a)=>a.forEach(x=>classes.add(x)),remove:(...a)=>a.forEach(x=>classes.delete(x)),contains:x=>classes.has(x),toggle:(x,v)=>{if(v??!classes.has(x))classes.add(x);else classes.delete(x);}};}
  set textContent(s){this._text=String(s);this.children=[];}get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  get scrollWidth(){return this.textContent.length*15;}
  append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this._text='';this.children=nodes;}
  setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}
  addEventListener(k,fn){this.events.set(k,fn);}focus(){document.activeElement=this;}
  getBoundingClientRect(){return {x:0,y:0,left:0,top:0,width:900,height:720,right:900,bottom:720};}
  closest(){return null;}querySelectorAll(){return [];}
  showModal(){this.open=true;}close(){if(this.open){this.open=false;this.events.get('close')?.();}}
  click(){if(!this.disabled)this.onclick?.();}
 }
 const get=selector=>{if(!nodes.has(selector))nodes.set(selector,new Element(selector.includes('button')?'button':'div'));return nodes.get(selector);};
 document={body:new Element('body'),hidden:false,activeElement:null,fonts:{ready:Promise.resolve()},createElement:t=>new Element(t),querySelector:get,hasFocus:()=>true,addEventListener:(k,fn)=>listeners.set('document:'+k,fn)};
 document.activeElement=document.body;
 get('#title-name').replaceChildren(new Element('span'),new Element('span'));get('.app').inert=true;
 const renderer=new Proxy({camera:{},screenToWorld:(x,y)=>({x,y})},{get:(o,k)=>k in o?o[k]:()=>{}});
 const env={document,window:{addEventListener:(k,fn)=>listeners.set('window:'+k,fn)},getComputedStyle:()=>({flexDirection:'column',gap:'0'}),matchMedia:q=>({matches:q.includes('reduced-motion')?reduced:false}),localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{hash,pathname:'/',search:''},history:{replaceState(_a,_b,url){env.location.hash=url.includes('#')?'#'+url.split('#')[1]:'';}},ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>{if(fn.name!=='frame')raf.push(fn);},setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),fetch:async()=>{if(failure)throw Error('Simulated offline');return{ok:true,json:async()=>structuredClone(raw)};},console:{error(){}},URLSearchParams,Set,Map,Math,JSON,Promise,Number,String,Object,Array,Date,World,stages,WIDTH,HEIGHT,distance,LotLife,BuildSequence,buildSteps,lightingLooks,...contentAPI,Renderer:class{constructor(){return renderer;}},TitleScene:class{resize(){}render(){}}};
 const app=await vm.runInNewContext('(async()=>{'+source+'\nreturn {enterBacklot,dismissIntro,showTitle,openIndex,openProject,closePanel,settings,world,life,applySettings,resize,frame,state:()=>({welcomed,entering})};})()',env);
 function tick(ms){for(const fn of raf.splice(0))fn(now);const end=now+ms;while(true){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();for(const fn of raf.splice(0))fn(now);}now=end;}
 return{app,get,document,tick,listeners,env,storage};
}
{
 const {app,get,document,tick}=await boot();
 assert.equal(app.state().welcomed,false);assert.equal(app.world.paused,true);assert.equal(get('.app').inert,true);assert.equal(get('#start-button').disabled,false);assert.equal(app.settings.sound,false);assert.equal(get('#title-name').getAttribute('aria-label'),'BENJAMIN TRAN');
 app.enterBacklot();app.enterBacklot();assert.equal(app.state().entering,true);assert.equal(get('#start-button').disabled,true);assert.equal(get('.app').inert,true);
 tick(279);assert.equal(get('#title-screen').hidden,false);assert.equal(app.world.paused,true);
 tick(1);assert.equal(get('#title-screen').hidden,true);assert.equal(get('.app').inert,true);assert.equal(get('.app').classList.contains('revealing'),true);
 tick(300);assert.equal(app.state().welcomed,true);assert.equal(app.state().entering,false);assert.equal(get('.app').inert,false);assert.equal(app.world.paused,false);assert.equal(document.activeElement,get('#world'));assert.equal(get('#scene-transition').hidden,true);
 app.showTitle();assert.equal(app.state().welcomed,false);assert.equal(app.world.paused,true);assert.equal(get('.app').inert,true);assert.equal(get('#title-screen').hidden,false);assert.equal(document.activeElement,get('#start-button'));
 app.enterBacklot();tick(100);app.showTitle();tick(1000);assert.equal(app.state().welcomed,false,'Returning to title cancels pending entry');assert.equal(get('#title-screen').hidden,false);
 get('#title-work').click();assert.equal(app.state().welcomed,true);assert.equal(get('#panel').open,true);assert.equal(app.world.paused,true);app.closePanel();assert.equal(get('#panel').open,false);assert.equal(app.world.paused,false);
}
{
 const {app,get}=await boot({reduced:true,saved:{'backlot-crew-v1':'["cat","lighting","craft","build"]','backlot-light-v1':'night'}});
 app.enterBacklot();assert.equal(app.state().welcomed,true,'Reduced motion skips the curtain timer');assert.equal(app.state().entering,false);assert.equal(get('#title-screen').hidden,true);assert.equal(app.life.found.has('cat'),true);assert.equal(app.life.found.has('build'),true);assert.equal(app.life.lighting,'night');assert.equal(app.life.reduced,true,'The reduced-motion preference reaches cat behavior');assert.ok(distance(app.life.cat,catHome)<.001,'Saved trust must not leave the cat living at the truck');assert.equal(get('#crew-seal').hidden,false,'The saved Crew Approved stamp remains visible while the cat returns to the workshop');
}
{
 const {app,get,listeners,document}=await boot({reduced:true,saved:{'backlot-crew-v1':'["cat"]'}});
 app.enterBacklot();let now=0;
 const frame=()=>app.frame(now+=1000/60);
 const tapCat=()=>{const e={pointerId:1,clientX:app.life.cat.x,clientY:app.life.cat.y};get('#world').events.get('pointerdown')(e);get('#world').events.get('pointerup')(e);};
 tapCat();assert.equal(app.world.destination,'egg:cat','Tapping a distant cat starts the approach');
 for(let i=0;i<600&&app.life.cat.mode==='idle';i++)frame();
 assert.equal(app.life.cat.mode,'leading','Arrival at the cat automatically pets it and starts the guide');
 for(let i=0;i<600&&!app.life.cat.waiting;i++)frame();
 assert.ok(app.life.cat.waiting);assert.ok(distance(app.life.cat,catHome)>80);
 tapCat();assert.equal(app.world.destination,'egg:cat');
 assert.ok(distance(app.world.path.at(-1),app.life.cat)<10,'A later click targets the cat’s current location, not its saved or home position');
 for(let i=0;i<600&&(distance(app.world.player,app.life.cat)>=38||app.life.cat.heart<1.75);i++)frame();
 assert.ok(distance(app.world.player,app.life.cat)<38,'Click-to-walk can catch the moving guide');
 assert.equal(app.life.cat.mode,'leading');
 listeners.get('window:keydown')({key:'e',repeat:false,target:get('#world'),preventDefault(){}});
 assert.equal(app.life.cat.heart,2,'The keyboard interaction can still pet the guide');
 get('#touch-action').click();assert.equal(app.life.cat.mode,'leading','The touch action does not reset the guide state');
 app.openIndex();const pausedCat=JSON.stringify(app.life.cat);for(let i=0;i<120;i++)frame();
 assert.equal(JSON.stringify(app.life.cat),pausedCat,'A work-index dialog freezes the live guide');app.closePanel();
 document.hidden=true;listeners.get('document:visibilitychange')();for(let i=0;i<120;i++)frame();
 assert.equal(JSON.stringify(app.life.cat),pausedCat,'Backgrounding freezes the live guide');document.hidden=false;listeners.get('document:visibilitychange')();
 app.showTitle();for(let i=0;i<120;i++)frame();assert.equal(JSON.stringify(app.life.cat),pausedCat,'Returning to the title pauses rather than resets the cat');
 app.enterBacklot();for(let i=0;i<60;i++)frame();assert.equal(app.life.cat.mode,'leading');assert.ok(app.life.found.has('cat'));assert.equal(get('#crew-seal').hidden,false);
}
{
 const {app,get}=await boot({hash:'#project=narrative-01'});assert.equal(app.state().welcomed,true,'Shared projects bypass title');assert.equal(get('#panel').open,true);assert.equal(get('#title-screen').hidden,true);assert.equal(app.world.paused,true);
}
{
 const {app,get}=await boot({failure:true});app.enterBacklot();assert.equal(app.state().welcomed,false);assert.equal(app.world.paused,true);assert.ok(get('#loading').innerHTML.includes('Try again'));assert.ok(get('#loading').innerHTML.includes('Contact Ben'));
}
assert.ok(html.includes('backlot/title.css'));assert.ok(html.includes('id="scene-transition"'));assert.ok(!html.includes('class="title-shade"'));
console.log('Title lifecycle passed: gated/repeated entry, curtain timing, cancellation, title return, direct Work index, shared project links, muted start, reduced motion, saved discoveries/lighting, live cat click/keyboard/touch interactions, interrupted guide resumes and failed-load recovery. Browser layout remains a separate check.');

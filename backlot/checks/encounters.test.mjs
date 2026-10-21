import {drawCrewPortrait} from '../crew-art.mjs';
import {FieldNotebook} from '../notebook.mjs';
import {createWrapCast} from '../wrap-motion.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {crew,cameraBuilds,projectTerms,drawViewfinder,wrapChapters,wrapStep} from '../encounters.mjs';
import {World,stages,findPath,blocked,distance,lotCamera,cameraStop,cameraHit} from '../world.mjs';
import {LotLife,curiosities} from '../life.mjs';
import {Renderer} from '../renderer.mjs';
function canvas(width=720,height=400){const ctx=new Proxy({},{get(o,k){return k in o?o[k]:(...args)=>{for(const v of args)if(typeof v==='number')assert.ok(Number.isFinite(v),k);};}});return{width,height,getContext:()=>ctx,setAttribute(){},removeAttribute(){}};}
globalThis.document={createElement:()=>canvas()};
for(let i=0;i<3;i++)for(const wide of [true,false])drawViewfinder(canvas(),i,wide);
const world=new World(),life=new LotLife();
assert.equal(life.hit(lotCamera)?.id,'camera','Clicking the relocated camera reaches its new hotspot');
assert.equal(life.hit({x:cameraHit.x+8,y:cameraHit.y+8})?.id,'camera','The raised monitor remains clickable');
assert.notEqual(life.hit({x:488,y:270})?.id,'camera','The old camera position no longer steals clicks');
assert.ok(blocked(lotCamera.x,lotCamera.y),'The tripod remains solid');
assert.ok(!blocked(488,288),'The old tripod footprint is walkable');
for(const hz of [30,60,120])for(const stage of stages){
 const walker=new World();Object.assign(walker.player,stage.door);walker.goTo(cameraStop,'egg:camera');
 for(let frame=0;frame<hz*30&&!walker.arrived;frame++){walker.update(1/hz);assert.ok(!blocked(walker.player.x,walker.player.y));}
 assert.equal(walker.arrived,'egg:camera');assert.ok(distance(walker.player,cameraStop)<9);
}

for(const id of ['camera','wrap',...crew.map(p=>p.id)]){
 const item=life.hotspot(id);assert.ok(!blocked(item.point.x,item.point.y));
 for(const stage of stages){const path=findPath(stage.door,item.point);assert.ok(path.length);assert.ok(distance(path.at(-1),item.point)<9);for(const point of path)assert.ok(!blocked(point.x,point.y));}
 life.interact(id,world);assert.equal(life.drain()[0].type,id);
}
const renderer=new Renderer(canvas(),canvas);for(let t=0;t<=12;t+=.1)renderer.drawWrap(canvas(720,540),t);
// Exercise the actual application panel functions with an instrumented DOM surface.
const source=fs.readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
const nodes=new Map();const get=s=>{if(!nodes.has(s))nodes.set(s,{...canvas(),textContent:'',hidden:false,disabled:false});return nodes.get(s);};
const raw=JSON.parse(fs.readFileSync(new URL('../../content.json',import.meta.url),'utf8'));
const projects=raw.channels.flatMap(c=>(c.projects||[]).map((p,i)=>({...p,id:c.id+i})));
let kind='',headingFocus=0;const portraitIds=[];
const env={drawCrewPortrait(canvas,id){portraitIds.push(id);drawCrewPortrait(canvas,id);},notebook:new FieldNotebook(),persistNotebook(){},createWrapCast,crew,cameraBuilds,projectTerms,drawViewfinder,wrapChapters,wrapStep,projects,renderer,life,$:get,settings:{reduced:false},stopMedia(){},panelInner:{innerHTML:''},bar:()=>'',heading:()=>'',escape:s=>s,displayName:()=> 'Benjamin Tran',handleLifeEvents(){life.drain();},openPanel(k){kind=k;},focusHeading(){headingFocus++;}};
const functions=source.slice(source.indexOf('function openCraft()'),source.indexOf('function openBuild()'))+source.slice(source.indexOf('function openCamera()'),source.indexOf('function activateEgg('));
const app=vm.runInNewContext(`let cameraIndex=0,cameraWide=false,wrapElapsed=null,wrapPlaying=false,wrapChapter=-1;const crewVisits={};${functions};({openCraft,openCamera,openCrew,openWrap,syncWrap,setWrap:t=>wrapElapsed=t,state:()=>({wrapElapsed,wrapPlaying})})`,env);
app.openCamera();assert.equal(kind,'camera');assert.ok(env.panelInner.innerHTML.includes('data-project'));assert.ok(life.found.has('camera'));
for(const person of crew){app.openCrew(person.id);assert.equal(kind,'crew');assert.ok(env.panelInner.innerHTML.includes(person.lines[0]));app.openCrew(person.id);assert.ok(env.panelInner.innerHTML.includes(person.lines[1]));}
app.openCraft();assert.equal(kind,'craft');
assert.deepEqual(portraitIds,[...crew.flatMap(p=>[p.id,p.id]),'craft'],'Each conversation renders its own crew portrait, including Mara');
app.openWrap();assert.equal(kind,'wrap');assert.equal(app.state().wrapPlaying,true);app.setWrap(12);app.syncWrap();assert.ok(life.found.has('wrap'));assert.equal(app.state().wrapPlaying,false);assert.equal(get('#wrap-credit').hidden,false);
env.settings.reduced=true;app.openWrap();assert.equal(app.state().wrapPlaying,false);assert.equal(app.state().wrapElapsed,9);
assert.deepEqual([...new LotLife(['camera','crew','wrap','bad']).found],['camera','crew','wrap']);
assert.ok(headingFocus>=9);
console.log('Encounters passed: all-stage routes, collision, events, 6 camera compositions, 121 wrap frames, project links, rotating dialogue, timed completion, reduced motion and save compatibility.');

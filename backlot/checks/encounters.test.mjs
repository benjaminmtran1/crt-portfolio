import {drawCrewPortrait} from '../crew-art.mjs';
import {FieldNotebook} from '../notebook.mjs';
import {createWrapCast} from '../wrap-motion.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {normalizeContent} from '../content.mjs';
import {titleBuilds,paintTitleBuild} from '../title-builds.mjs';
import {crew,cameraBuilds,projectTerms,drawViewfinder,wrapChapters,wrapStep} from '../encounters.mjs';
import {World,stages,findPath,blocked,distance,lotCamera,cameraStop,cameraHit} from '../world.mjs';
import {LotLife,curiosities} from '../life.mjs';
import {Renderer} from '../renderer.mjs';
function canvas(width=720,height=400,record=false){
 const calls=[],images=[],ctx=new Proxy({},{get(o,k){return k in o?o[k]:(...args)=>{
  for(const v of args)if(typeof v==='number')assert.ok(Number.isFinite(v),k);
  if(k==='drawImage')images.push(args);
  if(record)calls.push([k,o.fillStyle,...args]);
 };}});
 return{width,height,calls,images,getContext:()=>ctx,setAttribute(){},removeAttribute(){}};
}
globalThis.document={createElement:()=>canvas(720,400,true)};
const ids=['deathstalker','donkey-kong','beast-games','cupra','internet','raptors','wicked','yes-chef','ihop'];
assert.deepEqual(cameraBuilds.map(build=>build.id),ids);
assert.deepEqual(cameraBuilds,titleBuilds,'Camera and title use the same nine build records');
assert.deepEqual(projectTerms,['deathstalker','nintendo','beast games','cupra','internet','raptors','wicked','yes, chef','ihop']);
const hash=canvas=>createHash('sha256').update(JSON.stringify(canvas.calls.map(call=>call[0]==='drawImage'?[...call.slice(0,2),hash(call[2]),...call.slice(3)]:call))).digest('hex');
// Captured from cf17fc92 before adding the five scenes: wide, then framed.
const originalCameraHashes=[
 ['49a9844b48ac0fafc59f9065f415cfac1e36547bd30d20d6761a03fd0b620569','f1f6d3e2af01d5d5b9dbcc553182238b9a231cd15113a779b77d4d03fd9a359d'],
 ['1c97750b716e0a2b7835e701d1411bcf41d6c39702cdf0fced8d90f61118fcfa','be2d06595864ccfeec71f109c7d948daa37b94e68ec679d81ffd16fc2b74fa48'],
 ['caf1002caf5a053ddb6511421abaaa5f4a6abd5acf9760cb75ca3a27a9214659','3c1a675b8c4d30e783ea3327252ab7e4613dd650da3843ea859e7b0ada202b4f'],
 ['01b45cd46c61e73d74529f3f3c9d4608137fe4f4e5899425ae4ce83493a1fe1e','c5a44b1d9b865c4a99a5b7c6affa3eda410f6957be0e2bf56b734ecd566ef874']
];
for(let i=0;i<cameraBuilds.length;i++)for(const wide of [true,false]){
 const view=canvas(720,400,true),expected=canvas(360,180,true);paintTitleBuild(expected.getContext('2d'),i);drawViewfinder(view,i,wide);
 assert.equal(view.images.length,1,'The viewfinder shows exactly one scenic plate');
 const [plate,...framing]=view.images[0];
 assert.equal(plate.width,360);assert.equal(plate.height,180);
 assert.equal(hash(plate),hash(expected),`Both camera modes draw the correct ${ids[i]} plate`);
 assert.deepEqual(framing,wide?[108,76,504,252]:[0,12,720,360],`${ids[i]} uses the intended ${wide?'wide':'framed'} composition`);
 assert.equal(view.getContext('2d').imageSmoothingEnabled,false,'Camera pixels remain crisp');
 if(i<4)assert.equal(hash(view),originalCameraHashes[i][wide?0:1],'All four approved camera compositions stay byte-for-byte equivalent');
 else{
  const floor=wide?270:300;
  assert.ok(view.calls.some(call=>call[0]==='fillRect'&&call[1]==='#213c44'&&call.slice(2).join(',')===[0,floor,720,400-floor].join(',')),'New scenes keep their full footprint on the visible camera floor');
  assert.ok(view.calls.some(call=>call[0]==='fillRect'&&call[1]==='#192F37'),'New scenes have a separate contact shadow behind the plate');
 }
}
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
const {projects}=normalizeContent(raw);
const expectedProjects=[
 ['narrative-01','Deathstalker (2025)'],
 ['commercial-01','Nintendo x Donkey Kong'],
 ['reality-01','Beast Games: season 1'],
 ['commercial-02','Cupra - The Chosen One'],
 ['narrative-06','We’re From The Internet'],
 ['installation-02','Toronto Raptors x Häagen-Dazs'],
 ['commercial-08','Gain Flings x Wicked'],
 ['reality-02','Yes, Chef!'],
 ['commercial-10','IHOP - Go All Out']
];
for(const [i,[id,title]] of expectedProjects.entries()){
 const matches=projects.filter(p=>p.title.toLowerCase().includes(projectTerms[i]));
 assert.equal(matches.length,1,`${cameraBuilds[i].id} maps unambiguously to one current portfolio project`);
 assert.equal(matches[0].id,id);assert.equal(matches[0].title,title);
}
let kind='',headingFocus=0;const portraitIds=[];
const env={drawCrewPortrait(canvas,id){portraitIds.push(id);drawCrewPortrait(canvas,id);},notebook:new FieldNotebook(),persistNotebook(){},createWrapCast,crew,cameraBuilds,projectTerms,drawViewfinder,wrapChapters,wrapStep,projects,renderer,life,$:get,settings:{reduced:false},stopMedia(){},panelInner:{innerHTML:''},bar:()=>'',heading:(_label,title)=>`<h2>${title}</h2>`,escape:s=>s,displayName:()=> 'Benjamin Tran',handleLifeEvents(){life.drain();},openPanel(k){kind=k;},focusHeading(){headingFocus++;}};
const functions=source.slice(source.indexOf('function openCraft()'),source.indexOf('function openBuild()'))+source.slice(source.indexOf('function openCamera()'),source.indexOf('function activateEgg('));
const app=vm.runInNewContext(`let cameraIndex=0,cameraWide=false,wrapElapsed=null,wrapPlaying=false,wrapChapter=-1;const crewVisits={};${functions};({setCamera:i=>cameraIndex=i,setWide:value=>cameraWide=value,openCraft,openCamera,openCrew,openWrap,syncWrap,setWrap:t=>wrapElapsed=t,state:()=>({wrapElapsed,wrapPlaying})})`,env);
for(const i of [...ids.keys(),8,4,0,7,3])for(const wide of [false,true]){
 app.setCamera(i);app.setWide(wide);app.openCamera();
 assert.equal(kind,'camera');assert.ok(life.found.has('camera'));
 const markup=env.panelInner.innerHTML;
 assert.ok(markup.includes(`<h2>${cameraBuilds[i].title}</h2>`));
 assert.ok(markup.includes(`aria-label="${cameraBuilds[i].description}"`),'Accessible description follows the selected build');
 assert.equal((markup.match(/data-camera="\d+"/g)||[]).length,9,'All nine build selectors are present');
 assert.equal((markup.match(/data-camera="\d+" aria-pressed="true"/g)||[]).length,1,'Exactly one build selector is active');
 assert.ok(markup.includes(`data-camera="${i}" aria-pressed="true"`));
 assert.ok(markup.includes(`data-camera-wide aria-pressed="${wide}"`));
 assert.ok(markup.includes(wide?'FRAME THE SHOT':'PULL BACK / SEE THE LIGHTS'));
 assert.deepEqual([...markup.matchAll(/data-project="([^"]+)"/g)].map(match=>match[1]),[expectedProjects[i][0]],`${cameraBuilds[i].id} links only to its actual current project in either framing`);
}
for(const person of crew){app.openCrew(person.id);assert.equal(kind,'crew');assert.ok(env.panelInner.innerHTML.includes(person.lines[0]));app.openCrew(person.id);assert.ok(env.panelInner.innerHTML.includes(person.lines[1]));}
app.openCraft();assert.equal(kind,'craft');
assert.deepEqual(portraitIds,[...crew.flatMap(p=>[p.id,p.id]),'craft'],'Each conversation renders its own crew portrait, including Mara');
app.openWrap();assert.equal(kind,'wrap');assert.equal(app.state().wrapPlaying,true);app.setWrap(12);app.syncWrap();assert.ok(life.found.has('wrap'));assert.equal(app.state().wrapPlaying,false);assert.equal(get('#wrap-credit').hidden,false);
env.settings.reduced=true;app.openWrap();assert.equal(app.state().wrapPlaying,false);assert.equal(app.state().wrapElapsed,9);
assert.deepEqual([...new LotLife(['camera','crew','wrap','bad']).found],['camera','crew','wrap']);
assert.ok(headingFocus>=9);
console.log('Encounters passed: all-stage routes, collision, events, 18 verified camera compositions, unchanged original camera hashes and repeated switches across all nine builds, 121 wrap frames, all nine exact normalized project links, accessible selections, rotating dialogue, timed completion, reduced motion and save compatibility.');

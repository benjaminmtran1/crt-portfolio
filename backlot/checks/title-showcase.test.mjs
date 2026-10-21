import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { TitleScene } from '../title-scene.mjs';
import { titleBuilds, paintTitleBuild, showcaseAt, BUILD_HOLD_MS as HOLD, BUILD_FADE_MS as FADE, BUILD_DARK_MS as DARK, BUILD_CYCLE_MS as CYCLE } from '../title-builds.mjs';

assert.equal(titleBuilds.length,3);
assert.deepEqual(titleBuilds.map(b=>b.id),['deathstalker','donkey-kong','beast-games']);
for(let i=0;i<3;i++){
  assert.deepEqual(showcaseAt(i*CYCLE),{index:i,light:1,phase:'hold'});
  assert.equal(showcaseAt(i*CYCLE+HOLD-1).light,1,'Every build holds fully lit for 8.5 seconds');
  assert.ok(showcaseAt(i*CYCLE+HOLD+FADE/2).light>0);
  assert.equal(showcaseAt(i*CYCLE+HOLD+FADE).light,0,'Old set is fully dark before index changes');
  assert.equal(showcaseAt(i*CYCLE+HOLD+FADE+DARK-1).light,0,'Full blackout interval');
  assert.equal(showcaseAt(i*CYCLE+HOLD+FADE+DARK).light,0);
  assert.equal(showcaseAt(i*CYCLE+HOLD+FADE+DARK+FADE).index,(i+1)%3);
}
assert.equal(showcaseAt(CYCLE*3).index,0);
assert.equal(showcaseAt(-1).index,0);assert.equal(showcaseAt(NaN).index,0);
assert.equal(showcaseAt(1e6,-1).index,2,'Manual index wraps');
for(let time=0;time<CYCLE*3;time+=17){const state=showcaseAt(time);assert.ok(state.light>=0&&state.light<=1);assert.ok(Number.isInteger(state.index));}

function canvas(w,h){
  const calls=[],c={calls,globalAlpha:1,fillStyle:'',imageSmoothingEnabled:true};
  for(const name of ['fillRect','moveTo','lineTo','drawImage','clearRect'])c[name]=(...args)=>{
    for(const n of args.filter(v=>typeof v==='number'))assert.ok(Number.isFinite(n),`Finite ${name} coordinate`);
    if(name==='drawImage')calls.push({image:args[0],alpha:c.globalAlpha,args});
  };
  c.beginPath=c.closePath=c.fill=()=>{};
  return {width:w,height:h,clientWidth:w,clientHeight:h,style:{},ownerDocument:{createElement:()=>canvas(1,1)},getContext:()=>c};
}
for(const [w,h] of [[1440,900],[1366,768],[390,844],[360,667],[844,390],[320,568]]){
  const cv=canvas(w,h),scene=new TitleScene(cv),ctx=cv.getContext('2d');
  for(let t=0;t<CYCLE*3;t+=251){ctx.calls.length=0;scene.render(t);const sets=ctx.calls.filter(call=>scene.buildPlates.includes(call.image));assert.ok(sets.length<=1,'Never draw two sets in one frame');if(scene.buildState.light>0){assert.equal(sets.length,1);assert.equal(sets[0].image,scene.buildPlates[scene.activeBuild]);}else assert.equal(sets.length,0);}
  const anchor=scene.buildGround;
  assert.ok(anchor.y>scene.floor+scene.h*.06,'Scenic bases sit downstage on the visible floor, never at the backdrop seam');
  const placements=[];
  scene.reduced=true;
  for(let build=0;build<3;build++){scene.activeBuild=build;scene.render(scene.lastTime);placements.push(scene.buildGround);}
  assert.equal(placements[0].y,placements[1].y,'Both approved front-facing builds retain their original anchor');
  assert.equal(placements[0].scale,placements[0].baseScale);assert.equal(placements[1].scale,placements[1].baseScale);
  const beast=placements[2];
  assert.ok(beast.scale<beast.baseScale,'Deep isometric box gets its own fit, not a global layout change');
  assert.ok(beast.footprint[0][1]>scene.floor&&beast.footprint[2][1]>scene.floor,'Both visible side feet sit on the floor, not on the cyc');
  assert.ok(beast.y<=beast.captionTop-2,'Nearest corner clears the unchanged selector');
  assert.equal(beast.footprint[3][1],beast.top+174*beast.scale,'Near-corner anchor and footprint use the same projection');
  scene.reduced=false;
  const time=scene.showcaseTime,index=scene.activeBuild;scene.resize(w,h);assert.equal(scene.showcaseTime,time,'Resize preserves scene clock');assert.equal(scene.activeBuild,index);
  scene.reduced=true;const frozen=scene.showcaseTime;scene.render(1e7);assert.equal(scene.showcaseTime,frozen);assert.equal(scene.buildState.light,1);
  scene.stepBuild(1);assert.equal(scene.activeBuild,(index+1)%3);assert.equal(scene.buildState.light,1);
  scene.stepBuild(-1);assert.equal(scene.activeBuild,index);scene.stepBuild(-1);assert.equal(scene.activeBuild,(index+2)%3);
  scene.reduced=false;scene.toggleBuilds();const paused=scene.showcaseTime;scene.render(2e7);assert.equal(scene.showcaseTime,paused);assert.equal(scene.buildState.light,1);
  scene.toggleBuilds();scene.render(2e7+500);assert.equal(scene.showcaseTime,paused+500);
  let report;scene.onBuildChange=b=>{report=b;};scene.stepBuild(1);assert.equal(report.index,scene.activeBuild);assert.equal(report.title,titleBuilds[report.index].title);
}
// The Beast correction must not alter either previously approved scenic plate.
const plateHashes=['5a9d25083cea66b68cca1e75e20e88d8f0bd4be861b5f126320c91cad94d03a6','afaf663ba0d170b3f261b1b7efd5c024811f3f066ead853c92630734bf5fbd0d'];
for(let i=0;i<2;i++){
  const ops=[],c={};for(const k of ['clearRect','fillRect','beginPath','moveTo','lineTo','closePath','fill'])c[k]=(...v)=>ops.push([k,c.fillStyle,...v]);
  paintTitleBuild(c,i);assert.equal(createHash('sha256').update(JSON.stringify(ops)).digest('hex'),plateHashes[i],'Approved non-Beast art stays byte-for-byte equivalent');
}
const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
for(const id of ['title-set-prev','title-set-next','title-set-pause','start-button','title-work'])assert.ok(html.includes(`id="${id}"`));
assert.ok(!html.includes('aria-live="assertive"'),'Decorative rotation must not repeatedly interrupt screen readers');
console.log('Title showcase passed: all 3 real-build references and Beast cash/footprint correction, 8.5-second holds, full blackout before swap, one rendered set only, 6 viewport sizes, finite drawing, wraparound/manual selection, pause/resume, reduced-motion stills, resize continuity, callbacks and immediate menu access. Browser layout remains a separate check.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TitleScene } from '../title-scene.mjs';
import { titleBuilds, showcaseAt, BUILD_HOLD_MS as HOLD, BUILD_FADE_MS as FADE, BUILD_DARK_MS as DARK, BUILD_CYCLE_MS as CYCLE } from '../title-builds.mjs';

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
for(const [w,h] of [[1440,900],[1366,768],[390,844],[360,667],[844,390]]){
  const cv=canvas(w,h),scene=new TitleScene(cv),ctx=cv.getContext('2d');
  for(let t=0;t<CYCLE*3;t+=251){ctx.calls.length=0;scene.render(t);const sets=ctx.calls.filter(call=>scene.buildPlates.includes(call.image));assert.ok(sets.length<=1,'Never draw two sets in one frame');if(scene.buildState.light>0){assert.equal(sets.length,1);assert.equal(sets[0].image,scene.buildPlates[scene.activeBuild]);}else assert.equal(sets.length,0);}
  const anchor=scene.buildGround;
  assert.ok(anchor.y>scene.floor+scene.h*.06,'Scenic bases sit downstage on the visible floor, never at the backdrop seam');
  for(let build=0;build<3;build++){scene.stepBuild(1);assert.equal(scene.buildGround.y,anchor.y,'All three builds share one floor anchor');}
  const time=scene.showcaseTime,index=scene.activeBuild;scene.resize(w,h);assert.equal(scene.showcaseTime,time,'Resize preserves scene clock');assert.equal(scene.activeBuild,index);
  scene.reduced=true;const frozen=scene.showcaseTime;scene.render(1e7);assert.equal(scene.showcaseTime,frozen);assert.equal(scene.buildState.light,1);
  scene.stepBuild(1);assert.equal(scene.activeBuild,(index+1)%3);assert.equal(scene.buildState.light,1);
  scene.stepBuild(-1);assert.equal(scene.activeBuild,index);scene.stepBuild(-1);assert.equal(scene.activeBuild,(index+2)%3);
  scene.reduced=false;scene.toggleBuilds();const paused=scene.showcaseTime;scene.render(2e7);assert.equal(scene.showcaseTime,paused);assert.equal(scene.buildState.light,1);
  scene.toggleBuilds();scene.render(2e7+500);assert.equal(scene.showcaseTime,paused+500);
  let report;scene.onBuildChange=b=>{report=b;};scene.stepBuild(1);assert.equal(report.index,scene.activeBuild);assert.equal(report.title,titleBuilds[report.index].title);
}
const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
for(const id of ['title-set-prev','title-set-next','title-set-pause','start-button','title-work'])assert.ok(html.includes(`id="${id}"`));
assert.ok(!html.includes('aria-live="assertive"'),'Decorative rotation must not repeatedly interrupt screen readers');
console.log('Title showcase passed: all 3 real-build references, 8.5-second holds, full blackout before swap, one rendered set only, 5 viewport sizes, finite drawing, wraparound/manual selection, pause/resume, reduced-motion stills, resize continuity, callbacks and immediate menu access. Browser layout remains a separate check.');

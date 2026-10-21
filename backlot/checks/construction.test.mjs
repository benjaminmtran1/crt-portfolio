import assert from 'node:assert/strict';
import {BuildSequence,buildSteps,BUILD_LENGTH} from '../departments.mjs';
import {constructionBasis,constructionPoint as p,constructionPad,constructionFootprint,constructionState,drawConstructionScene} from '../construction.mjs';

assert.deepEqual(buildSteps.map(s=>s.title),['Design','Mark out','Build','Shoot']);
assert.equal(BUILD_LENGTH,12);
const delta=(a,b)=>b.map((v,i)=>v-a[i]);
const parallel=(a,b)=>Math.abs(a[0]*b[1]-a[1]*b[0])<1e-7;
const b=constructionBasis,pad=constructionPad.map(v=>p(...v)),foot=constructionFootprint.map(v=>p(...v));
assert.ok(parallel(delta(pad[0],pad[1]),b.x));assert.ok(parallel(delta(pad[1],pad[2]),b.y));
for(const z of [0,1,24,75,104,150]){
 const wall=constructionFootprint.map(([x,y])=>p(x,y,z));
 assert.ok(parallel(delta(wall[0],wall[1]),delta(pad[0],pad[1])),'Every horizontal front rail and wall course follows the pad x-axis');
 assert.ok(parallel(delta(wall[1],wall[2]),delta(pad[1],pad[2])),'The return wall follows the pad depth axis');
 assert.deepEqual(delta(wall[0],wall[3]),delta(foot[0],foot[3]),'Height cannot alter footprint or perspective');
}
for(const [x,y]of constructionFootprint){assert.ok(x>0&&x<360&&y>0&&y<180);assert.deepEqual(delta(p(x,y),p(x,y,150)),[0,-150]);}
for(const hz of [30,60,120]){
 const seq=new BuildSequence(),seen=new Set();
 for(let i=0;i<(BUILD_LENGTH+.1)*hz;i++){
  seen.add(seq.step);const s=constructionState(seq);
  for(const n of Object.values(s))assert.ok(Number.isFinite(n)&&n>=0&&n<=1);
  if(seq.step<2)assert.equal(s.frame+s.skin+s.finish,0,'No structure before Build');
  if(seq.step<3)assert.equal(s.shoot,0,'No filming before Shoot');
  if(seq.step===3)assert.equal(s.frame+s.skin+s.finish,3,'The set is finished before filming');
  seq.update(1/hz);
 }
 assert.deepEqual([...seen],[0,1,2,3]);assert.ok(seq.complete);assert.equal(seq.playing,false);
 seq.replay();assert.equal(seq.elapsed,0);assert.equal(seq.step,0);assert.equal(constructionState(seq).shoot,0);
}
for(const elapsed of [0,2.999,3,5.999,6,8.999,9,12]){
 const seq=new BuildSequence();seq.elapsed=elapsed;assert.equal(seq.step,Math.min(3,Math.floor(elapsed/3)));
}
const calm=new BuildSequence(true);assert.equal(calm.playing,false);assert.equal(calm.step,0);
for(const i of [3,0,2,1,3]){calm.show(i);assert.equal(calm.step,i);assert.equal(calm.playing,false);assert.ok(calm.progress(i)>.999);}
const seq=new BuildSequence();for(let i=0;i<20;i++)seq.update(.05);const elapsed=seq.elapsed;
for(let i=0;i<200;i++)seq.update(.05,false);assert.equal(seq.elapsed,elapsed);seq.playing=false;seq.update(.05);assert.equal(seq.elapsed,elapsed);
seq.playing=true;seq.update(.05);assert.ok(seq.elapsed>elapsed);seq.update(-1);assert.ok(seq.elapsed>elapsed);
// Canvas command coverage is dependency-free. Native raster previews are a separate check.
function recorder(){
 const paths=[],rects=[],stack=[];let points=[];
 const c={fillStyle:'',strokeStyle:'',globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();},scale(){},beginPath(){points=[];},moveTo(...p){points.push(p);},lineTo(...p){points.push(p);},closePath(){},fill(){paths.push({kind:'fill',color:this.fillStyle,points});},stroke(){paths.push({kind:'stroke',color:this.strokeStyle,points});},fillRect(...coords){rects.push(coords);}};
 return {canvas:{width:720,height:340,getContext:()=>c},paths,rects,stack};
}
const signatures=[];
for(let step=0;step<4;step++){
 const r=recorder(),s=new BuildSequence();s.show(step);drawConstructionScene(r.canvas,s);
 assert.ok(r.paths.some(shape=>shape.color==='#45605d'&&JSON.stringify(shape.points)===JSON.stringify(pad)),'The pad projection is fixed in every step');
 assert.ok(r.paths.some(shape=>shape.color===['#82a9a5','#d9d4b2','#ad7b62','#efd29a1d'][step]),'Each phase draws its intended physical cue');
 signatures.push(JSON.stringify(r.paths));assert.equal(r.stack.length,0,'Canvas state must be balanced');
}
assert.equal(new Set(signatures).size,4);
for(let t=0;t<=12;t+=.025){
 const r=recorder(),s=new BuildSequence();s.elapsed=t;drawConstructionScene(r.canvas,s);
 for(const {points}of r.paths)for(const point of points)for(const n of point)assert.ok(Number.isFinite(n),'Every animation frame has finite projected geometry');
 for(const rect of r.rects)for(const n of rect)assert.ok(Number.isFinite(n));
 assert.ok(r.paths.some(shape=>shape.color==='#45605d'&&JSON.stringify(shape.points)===JSON.stringify(pad)),'Pad must not drift during assembly');
 assert.equal(r.stack.length,0);
}
console.log('Construction passed: exact stages, shared pad/structure projection, stable ground at 480 intermediate frames, phase gates, 30/60/120 Hz timing, pause/resume/replay, manual/reduced-motion selection and finite Canvas rendering.');

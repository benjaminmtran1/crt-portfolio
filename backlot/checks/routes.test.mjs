import assert from 'node:assert/strict';
import {World,stages,findPath,blocked,distance} from '../world.mjs';
let passed=0;
const walk=(w,id)=>{w.goToStage(id);assert.ok(w.path.length||distance(w.player,stages.find(s=>s.id===id).door)<10,'A route must exist');for(let i=0;i<2500&&!w.arrived;i++){w.update(1/60);assert.equal(blocked(w.player.x,w.player.y),false,'Route intersects scenery');}assert.equal(w.arrived,id);assert.equal(w.nearby()?.id,id);w.arrived=null;passed++;};
for(const target of stages)walk(new World(),target.id);
for(const source of stages)for(const target of stages){const w=new World();Object.assign(w.player,source.door);walk(w,target.id);}
const manual=new World();manual.player.x=324;manual.player.y=282;for(let i=0;i<90;i++)manual.update(1/60,{x:0,y:-1});assert.ok(manual.player.y>262,'Manual input must not enter the stage collision');
const pause=new World();pause.goToStage('narrative');pause.paused=true;const before={...pause.player};pause.update(.05,{x:1,y:1});assert.deepEqual(pause.player,before);pause.paused=false;pause.update(.05,{x:1,y:0});assert.equal(pause.path.length,0,'Manual input cancels automatic route');
for(const hz of [30,60,120]){const w=new World();for(let i=0;i<hz;i++)w.update(1/hz,{x:1,y:0});assert.ok(Math.abs(w.player.x-572)<.001,'Movement is time based');}
const corner=findPath({x:472,y:332},{x:200,y:130});assert.ok(corner.length);assert.ok(corner.every(p=>!blocked(p.x,p.y)));
console.log(`${passed} doorway routes, scenery collision, pause, route cancellation, obstacle clicks, and 30/60/120 Hz movement passed.`);

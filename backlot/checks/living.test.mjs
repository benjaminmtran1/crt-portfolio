import assert from 'node:assert/strict';
import {CrewRoutines} from '../ambient.mjs';
import {World,blocked,distance,obstacles} from '../world.mjs';
import {LotLife} from '../life.mjs';
import {createWrapCast,wrapActorsAt,wrapExit,WRAP_WALK_SPEED} from '../wrap-motion.mjs';
const tasks=new Map(['scenic','grip','pa'].map(id=>[id,new Set()]));
let snapshots=[];
for(const hz of [30,60,120]){
 const routines=new CrewRoutines(),world=new World();world.player={x:100,y:640};
 for(let frame=0;frame<90*hz;frame++){
  const before=structuredClone(routines.people);routines.update(1/hz,world);
  for(const [i,p]of routines.people.entries()){
   assert.ok(!blocked(p.x,p.y),`${p.id} collides at ${frame/hz}s / ${hz}Hz`);
   assert.ok(distance(before[i],p)<=35/hz+.00001,'Crew movement cannot jump');
   tasks.get(p.id).add(p.task);
  }
  if(hz===60&&frame%120===0)snapshots.push(structuredClone(routines.people));
 }
 const held=JSON.stringify(routines.people);world.paused=true;routines.update(.05,world);assert.equal(JSON.stringify(routines.people),held);
 world.paused=false;routines.update(.05,world,true);assert.equal(JSON.stringify(routines.people),held,'Calmer motion pauses every routine');
 for(const p of routines.people){const before={x:p.x,y:p.y,time:p.time};world.player={x:p.x+20,y:p.y};routines.update(.05,world);assert.deepEqual({x:p.x,y:p.y,time:p.time},before);assert.equal(p.moving,false);assert.equal(p.face,'right');}
}
assert.ok(tasks.get('scenic').has('paint')&&tasks.get('scenic').has('mix'));
assert.ok(tasks.get('grip').has('carry')&&tasks.get('grip').has('stack'));
assert.ok(tasks.get('pa').has('radio')&&tasks.get('pa').has('walk'));
// Wrap can begin mid-step anywhere on any routine, without a teleport or shortcut.
for(const people of snapshots){
 const original=JSON.stringify(people),cast=createWrapCast(people);let previous=wrapActorsAt(0,cast);
 assert.deepEqual(previous.map(p=>({x:p.x,y:p.y})),people.map(p=>({x:p.x,y:p.y})));
 for(let frame=0;frame<=9*60;frame++){
  const actors=wrapActorsAt(frame/60,cast);
  for(const [i,p]of actors.entries()){
   assert.ok(!obstacles.some(o=>p.x>o.x-7&&p.x<o.x+o.w+7&&p.y>o.y-7&&p.y<o.y+o.h+7),`${p.id} clips scenery during dynamic wrap`);
   assert.ok(distance(p,previous[i])<=WRAP_WALK_SPEED/60+.00001);
   if(p.y<=wrapExit.y)assert.ok(!blocked(p.x,p.y));else assert.equal(p.x,wrapExit.x);
  }
  previous=actors;
 }
 assert.ok(previous.every(p=>p.exited));assert.equal(JSON.stringify(people),original);
}
// A click on a moving crewmember must remain reachable as the visitor approaches.
for(const people of snapshots.filter((_,i)=>i%4===0))for(const id of ['scenic','grip','pa']){
 const life=new LotLife(),world=new World();life.routines.people=structuredClone(people);
 const item=life.hotspot(id);assert.equal(life.hit({x:item.point.x,y:item.point.y-12})?.id,id);
 world.goTo(item.point,'egg:'+id);
 for(let i=0;i<30*60&&!world.arrived;i++){world.update(1/60);life.update(1/60,world);}
 assert.equal(world.arrived,'egg:'+id);assert.ok(distance(world.player,life.hotspot(id).point)<life.hotspot(id).radius,'Clicked crew must stay within interaction range');
}
console.log('Living backlot passed: 90-second routines at 30/60/120 Hz, collision and speed bounds, work poses, proximity pause, calmer motion, 45 dynamic wrap starts, and moving-crew click arrivals.');

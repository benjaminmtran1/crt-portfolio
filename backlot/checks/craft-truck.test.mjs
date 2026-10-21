import assert from 'node:assert/strict';
import {World,stages,obstacles,craftTruck,craftStop,craftHit,craftCrew,craftCup,findPath,blocked,distance} from '../world.mjs';
import {LotLife,curiosities,catHome,catNook} from '../life.mjs';

for(const [name,part] of Object.entries(craftTruck)){
 assert.ok(obstacles.some(o=>o.x===part.x&&o.y===part.y&&o.w===part.w&&o.h===part.h),`${name} has a solid collision footprint`);
 assert.ok(blocked(part.x+part.w/2,part.y+part.h/2),`${name} cannot be walked through`);
}
assert.deepEqual(Object.keys(craftTruck).sort(),['body','cab','counter']);
assert.ok(craftTruck.cab.x>=craftTruck.body.x+craftTruck.body.w,'The cab is at the front of the serving body');
assert.ok(!blocked(craftStop.x,craftStop.y),'The serving approach stays clear');
assert.ok(!blocked(craftCrew.x,craftCrew.y),'The craft crew member stands outside the truck');
assert.ok(craftStop.y>craftTruck.body.y+craftTruck.body.h,'Visitors approach the serving side');
assert.ok(craftCup.x>=craftTruck.counter.x&&craftCup.x<=craftTruck.counter.x+craftTruck.counter.w,'Coffee remains at the service counter');

const life=new LotLife(),craft=life.hotspot('craft');
assert.deepEqual(craft.point,craftStop);assert.equal(life.nearby(craftStop)?.id,'craft');
const bodyPoint={x:craftTruck.body.x+craftTruck.body.w/2,y:craftTruck.body.y+20};
const roofPoint={x:craftTruck.body.x+craftTruck.body.w/2,y:craftHit.y+10};
for(const point of [bodyPoint,roofPoint,{x:craftTruck.cab.x+20,y:craftTruck.cab.y+20},craftCup]){
 assert.equal(life.hit(point)?.id,'craft','The body, cab, sign and serving counter identify the same craft interaction');
 assert.deepEqual(life.hit(point).point,craftStop,'A vehicle hit targets the clear apron, not solid scenery');
}
assert.ok(roofPoint.y<craftTruck.body.y,'The roof-sign hit is above the collision body');
for(const point of [{x:craftHit.x-1,y:roofPoint.y},{x:craftHit.x+craftHit.w+1,y:roofPoint.y},{x:roofPoint.x,y:craftHit.y-1}])assert.notEqual(life.hit(point)?.id,'craft','The vehicle does not claim unrelated ground outside its hit area');

let manualFaces=0,routes=0;
for(const hz of [30,60,120]){
 // Exercise each exposed face with real movement, not only blocked() probes.
 for(const {face,point,input} of [
  {face:'north',point:{x:craftTruck.body.x+50,y:craftTruck.body.y-16},input:{x:0,y:1}},
  {face:'south',point:{x:craftTruck.counter.x+craftTruck.counter.w/2,y:Math.max(craftTruck.body.y+craftTruck.body.h,craftTruck.counter.y+craftTruck.counter.h)+16},input:{x:0,y:-1}},
  {face:'west',point:{x:craftTruck.body.x-16,y:craftTruck.body.y+24},input:{x:1,y:0}},
  {face:'east',point:{x:craftTruck.cab.x+craftTruck.cab.w+16,y:craftTruck.cab.y+24},input:{x:-1,y:0}}
 ]){
  const world=new World();Object.assign(world.player,point);assert.ok(!blocked(point.x,point.y),`${face} test begins on clear ground`);
  for(let i=0;i<hz*2;i++){world.update(1/hz,input);assert.ok(!blocked(world.player.x,world.player.y),`${face} collision holds at ${hz} Hz`);}
  assert.ok(distance(world.player,point)>0&&distance(world.player,point)<=10,`${face} approach stops at the truck`);manualFaces++;
 }
 const destinations=[...stages.map(s=>({id:s.id,point:s.door})),...curiosities,{id:'start',point:new World().player},{id:'cat-home',point:catHome},{id:'cat-nook',point:catNook}];
 for(const target of destinations){
  if(distance(craftStop,target.point)<1)continue;
  for(const [from,to] of [[craftStop,target.point],[target.point,craftStop]]){
   const world=new World();Object.assign(world.player,from);world.goTo(to,'craft-route');
   assert.ok(world.path.length,`A route connects craft and ${target.id} at ${hz} Hz`);
   assert.ok(world.path.every(p=>!blocked(p.x,p.y)),'All planned waypoints are clear');
   for(let i=0;i<hz*60&&!world.arrived;i++){world.update(1/hz);assert.ok(!blocked(world.player.x,world.player.y),`Walking toward ${target.id} does not clip scenery`);}
   assert.equal(world.arrived,'craft-route',`${target.id} route completes at ${hz} Hz`);assert.ok(distance(world.player,to)<10);routes++;
  }
 }
}

for(const part of Object.values(craftTruck)){
 const target={x:part.x+part.w/2,y:part.y+part.h/2},world=new World(),path=findPath(world.player,target);
 assert.ok(path.length);assert.ok(path.every(p=>!blocked(p.x,p.y)),'Generic obstacle clicks still resolve safely');
 world.goTo(target);for(let i=0;i<3600&&world.path.length;i++){world.update(1/60);assert.ok(!blocked(world.player.x,world.player.y));}
 assert.equal(world.path.length,0);assert.ok(!blocked(world.player.x,world.player.y));
}
life.interact('slate',new World());assert.equal(life.hit(bodyPoint),null);assert.equal(life.hit(roofPoint),null);assert.equal(life.nearby(craftStop),null);
console.log(`Craft truck passed: body/cab/counter collision, ${manualFaces} manual-face/frame-rate checks, ${routes} bidirectional destination/prop/start/cat routes, vehicle/sign hit routing, safe obstacle clicks and take isolation.`);

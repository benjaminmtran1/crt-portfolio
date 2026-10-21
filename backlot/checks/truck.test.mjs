import assert from 'node:assert/strict';
import {World,stages,obstacles,crewTruck,findPath,blocked,distance} from '../world.mjs';
import {catHome,catNook,curiosities} from '../life.mjs';

// The parked truck collision covers each vehicle part, including the extended rear platform.
for(const [name,part] of Object.entries(crewTruck)){
 assert.ok(obstacles.some(o=>o.x===part.x&&o.y===part.y&&o.w===part.w&&o.h===part.h),`${name} is missing its collision footprint`);
 assert.ok(blocked(part.x+part.w/2,part.y+part.h/2),`${name} must be solid`);
}
assert.ok(crewTruck.cab.x>=crewTruck.body.x+crewTruck.body.w,'Cab stays at the front of the cube body');
assert.ok(crewTruck.liftGate.x<crewTruck.body.x,'Lift gate extends out the rear');
assert.ok(!blocked(catNook.x,catNook.y),'The cat and player need a clear standing spot beside the truck');
assert.ok(catNook.x<crewTruck.body.x&&catNook.y<crewTruck.liftGate.y,'The cat stops northwest of the platform');

// Walk into each exposed face rather than only testing a mathematical center point.
for(const {point,input} of [
 {point:{x:800,y:584},input:{x:0,y:1}},
 {point:{x:906,y:642},input:{x:-1,y:0}},
 {point:{x:710,y:668},input:{x:1,y:0}}
]){
 const world=new World();Object.assign(world.player,point);assert.ok(!blocked(point.x,point.y));
 for(let i=0;i<120;i++){world.update(1/60,input);assert.ok(!blocked(world.player.x,world.player.y),'Manual input must not enter the truck or lift gate');}
 assert.ok(distance(world.player,point)<15,'Solid truck faces stop manual movement');
}

// Include both directions: arriving safely is not enough if the truck traps a visitor.
let routes=0;
const destinations=[...stages.map(s=>s.door),...curiosities.map(p=>p.point),catHome,catNook];
for(const source of [catHome,catNook])for(const target of destinations){
 if(distance(source,target)<1)continue;
 const world=new World();Object.assign(world.player,source);world.goTo(target,'truck-test');assert.ok(world.path.length,'The truck must not sever any destination route');
 for(let i=0;i<3600&&!world.arrived;i++){world.update(1/60);assert.ok(!blocked(world.player.x,world.player.y));}
 assert.equal(world.arrived,'truck-test');assert.ok(distance(world.player,target)<10);routes++;
}
for(const part of Object.values(crewTruck)){
 const requested={x:part.x+part.w/2,y:part.y+part.h/2};
 const path=findPath(catHome,requested);assert.ok(path.length,'Clicks on the truck resolve to nearby walkable ground');
 assert.ok(path.every(p=>!blocked(p.x,p.y)));
 const world=new World();Object.assign(world.player,catHome);world.goTo(requested);
 for(let i=0;i<3600&&world.path.length;i++){world.update(1/60);assert.ok(!blocked(world.player.x,world.player.y));}
 assert.equal(world.path.length,0);
}
console.log(`Truck collision passed: body/cab/extended lift gate, three manual approach faces, ${routes} workshop/truck routes, and safe obstacle-click destinations.`);

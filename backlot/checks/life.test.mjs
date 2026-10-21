import assert from 'node:assert/strict';
import {World,stages,blocked,distance} from '../world.mjs?v=crew3';
import {LotLife,curiosities,catHome,catNook,CAT_REST,TAKE_LENGTH} from '../life.mjs?v=crew3';

const catState=life=>structuredClone({cat:life.cat,path:life.catPath});
const update=(life,world,dt=1/60)=>{
 life.update(dt,world);
 assert.ok(!blocked(life.cat.x,life.cat.y),'The cat must not walk through scenery');
};
const advance=(life,world,seconds,hz=60)=>{for(let i=0;i<seconds*hz;i++)update(life,world,1/hz);};
const follow=(life,world,hz=60)=>{
 for(let i=0;i<120*hz&&life.cat.mode==='leading';i++){
  if(i%Math.round(hz/2)===0)world.goTo(life.cat);
  world.update(1/hz);update(life,world,1/hz);
  assert.ok(!blocked(world.player.x,world.player.y),'The player must be able to follow the cat');
 }
 assert.notEqual(life.cat.mode,'leading','A following player must reach the truck');
 assert.ok(distance(life.cat,catNook)<1);
};
const returnHome=(life,world,hz=60)=>{
 Object.assign(world.player,{x:48,y:64});world.path=[];
 for(let i=0;i<120*hz&&life.cat.mode!=='idle';i++)update(life,world,1/hz);
 assert.equal(life.cat.mode,'idle','The cat returns home even when the player stays behind');
 assert.ok(distance(life.cat,catHome)<1,'Each excursion returns to the workshop');
};
const paused=(life,world)=>{
 const before=catState(life);world.paused=true;advance(life,world,12);
 assert.deepEqual(catState(life),before,'Pausing freezes the whole cat state and its route');world.paused=false;
};
const duringTake=(life,world,skipped)=>{
 life.interact('slate',world);life.drain();const before=catState(life);
 for(const id of ['cat','slate','lighting','craft','build'])life.interact(id,world);
 assert.equal(life.drain().length,0,'Interactions cannot interrupt a take');
 assert.equal(life.nearby(life.cat),null);assert.equal(life.hit(life.cat),null);
 if(skipped){advance(life,world,1);life.finishTake(true);}
 else for(let i=0;i<1000&&life.take;i++)update(life,world);
 assert.equal(life.take,null);assert.deepEqual(catState(life),before,'A take freezes cat movement, rest and pet timers');
 life.drain();
};

// Every interaction, including both ends of the repeatable cat trip, stays reachable.
for(const source of stages){
 for(const target of [...curiosities.map(item=>item.point),catHome,catNook]){
  const world=new World();Object.assign(world.player,source.door);world.goTo(target,'test');
  assert.ok(world.path.length,'A curiosity has no route');
  for(let i=0;i<3600&&!world.arrived;i++){world.update(1/60);assert.ok(!blocked(world.player.x,world.player.y));}
  assert.equal(world.arrived,'test');assert.ok(distance(world.player,target)<10);
 }
}
const w=new World(),life=new LotLife();
life.interact('slate',w);assert.equal(life.phase,'quiet');assert.equal(w.player.moving,false);
for(let i=0;i<100;i++)life.update(1/60,w);
assert.equal(life.phase,'action');
const time=life.take.elapsed;w.paused=true;for(let i=0;i<200;i++)life.update(.05,w);
assert.equal(life.take.elapsed,time,'Dialog and background pauses must stop the take');
w.paused=false;for(let i=0;i<600;i++)life.update(1/60,w);
assert.equal(life.take,null);assert.ok(life.found.has('take'));
const skip=new LotLife();skip.interact('slate',w);skip.finishTake(true);
assert.equal(skip.take,null);assert.ok(!skip.found.has('take'),'Skipping a take must not award completion');
for(const hz of [30,60,120]){
 const timed=new LotLife();timed.interact('slate',w);
 for(let i=0;i<(TAKE_LENGTH+.1)*hz;i++)timed.update(1/hz,w);
 assert.ok(timed.found.has('take'),'Take completion depends on seconds, not frame count');
}

// Saved trust is a reward, not a permanent location or a one-shot state machine.
for(const saved of [[],['cat'],['cat','lighting','craft','build','take','backstage']]){
 const restored=new LotLife(saved);
 assert.equal(restored.cat.mode,'idle');assert.ok(distance(restored.cat,catHome)<.001);
 assert.deepEqual([...restored.found],saved);assert.equal(restored.drain().length,0);
}
assert.equal(new LotLife({unexpected:true}).found.size,0);
assert.deepEqual([...new LotLife(['cat','cat','invalid',null]).found],['cat']);
const wander=new LotLife(),wanderWorld=new World();let wandered=false;
for(let i=0;i<1200;i++){
 update(wander,wanderWorld);wandered ||= distance(wander.cat,catHome)>.1;
 assert.equal(wander.cat.mode,'idle');assert.ok(wander.cat.x>=400&&wander.cat.x<=424);assert.equal(wander.cat.y,240);
}
assert.ok(wandered,'The unaccompanied workshop cat gently wanders');
Object.assign(wanderWorld.player,{x:wander.cat.x,y:wander.cat.y+8});
const nearby={x:wander.cat.x,y:wander.cat.y};advance(wander,wanderWorld,5);
assert.equal(wander.cat.x,nearby.x);assert.equal(wander.cat.y,nearby.y,'The cat stays easy to pet when approached');
paused(wander,wanderWorld);duringTake(wander,wanderWorld,true);

// Calmer motion suppresses decorative strolling, not the interactive guide trip.
const calm=new LotLife(['cat']),calmWorld=new World();calm.reduced=true;
advance(calm,calmWorld,20);assert.ok(distance(calm.cat,catHome)<.001);assert.equal(calm.cat.mode,'idle');
calm.reduced=false;advance(calm,calmWorld,4.2);assert.ok(distance(calm.cat,catHome)>.1);
calm.reduced=true;const calmSpot={x:calm.cat.x,y:calm.cat.y};advance(calm,calmWorld,20);
assert.ok(distance(calm.cat,calmSpot)<.001,'Calmer motion also freezes a decorative stroll already in progress');
Object.assign(calmWorld.player,{x:calm.cat.x,y:calm.cat.y+8});calm.interact('cat',calmWorld);follow(calm,calmWorld);
assert.equal(calm.cat.mode,'trusted','Calmer motion still permits the interactive guide');
advance(calm,calmWorld,CAT_REST+.1);assert.equal(calm.cat.mode,'returning');returnHome(calm,calmWorld);
advance(calm,calmWorld,20);assert.ok(distance(calm.cat,catHome)<.001,'Calmer motion keeps the returned cat at the workshop');

const guide=new LotLife(),world=new World();Object.assign(world.player,{x:catHome.x,y:catHome.y+8});
guide.interact('cat',world);assert.equal(guide.cat.mode,'leading');
assert.ok(guide.catPath.length);assert.ok(guide.catPath.every(p=>!blocked(p.x,p.y)));
const route=structuredClone(guide.catPath);guide.interact('cat',world);
assert.deepEqual(guide.catPath,route,'Repeated pets do not replace the guide route');
paused(guide,world);duringTake(guide,world,true);
Object.assign(world.player,{x:800,y:312});const still={x:guide.cat.x,y:guide.cat.y};
advance(guide,world,10);assert.equal(guide.cat.x,still.x);assert.equal(guide.cat.y,still.y);assert.ok(guide.cat.waiting);
Object.assign(world.player,{x:guide.cat.x,y:guide.cat.y+8});follow(guide,world);
assert.equal(guide.cat.mode,'nook');assert.ok(!guide.found.has('cat'),'The first arrival still requires the second pet');
assert.equal(guide.drain().filter(event=>event.type==='cat-arrived').length,1);
const atTruck={x:guide.cat.x,y:guide.cat.y};Object.assign(world.player,{x:48,y:64});advance(guide,world,30);
assert.equal(guide.cat.mode,'nook');assert.equal(guide.cat.x,atTruck.x);assert.equal(guide.cat.y,atTruck.y);
assert.ok(!guide.found.has('cat'),'Walking away before the second pet cannot award the stamp');
paused(guide,world);duringTake(guide,world,false);
guide.interact('cat',world);assert.equal(guide.cat.mode,'trusted');assert.ok(guide.found.has('cat'));
let events=guide.drain();assert.equal(events.filter(e=>e.type==='discovery'&&e.id==='cat').length,1);assert.equal(events.filter(e=>e.type==='cat-approved').length,1);
paused(guide,world);duringTake(guide,world,true);
// Repeated pets must not keep a trusted cat parked at the truck forever.
for(let i=0;i<Math.ceil((CAT_REST+.1)*60)&&guide.cat.mode==='trusted';i++){
 if(i%15===0)guide.interact('cat',world);
 update(guide,world);
}
assert.equal(guide.cat.mode,'returning','Rest ends in elapsed seconds despite repeated pets');
assert.ok(guide.catPath.length);paused(guide,world);duringTake(guide,world,false);
const returnRoute=structuredClone(guide.catPath);guide.interact('cat',world);
assert.equal(guide.cat.mode,'returning');assert.deepEqual(guide.catPath,returnRoute,'Petting the returning cat does not strand it');
assert.ok(guide.drain().some(e=>e.type==='cat-purr'));
returnHome(guide,world);assert.ok(guide.found.has('cat'));

// Complete another trip in the same session without a second reward or second-pet gate.
Object.assign(world.player,{x:catHome.x,y:catHome.y+8});guide.drain();guide.interact('cat',world);follow(guide,world);
assert.equal(guide.cat.mode,'trusted','A known friend can repeat the guide trip immediately');
advance(guide,world,CAT_REST+.1);assert.equal(guide.cat.mode,'returning');returnHome(guide,world);
events=guide.drain();assert.equal(events.filter(e=>e.type==='discovery'&&e.id==='cat').length,0);assert.equal(events.filter(e=>e.type==='cat-approved').length,0);

// Rest, return and replay also work after reloading an existing reward at common frame rates.
for(const hz of [30,60,120]){
 const replay=new LotLife(['cat']),replayWorld=new World();Object.assign(replayWorld.player,{x:catHome.x,y:catHome.y+8});
 replay.interact('cat',replayWorld);follow(replay,replayWorld,hz);assert.equal(replay.cat.mode,'trusted');
 advance(replay,replayWorld,CAT_REST-.1,hz);assert.equal(replay.cat.mode,'trusted','Rest must not expire early at this frame rate');
 advance(replay,replayWorld,.2,hz);assert.equal(replay.cat.mode,'returning');returnHome(replay,replayWorld,hz);
 assert.ok(replay.found.has('cat'));assert.ok(!replay.drain().some(e=>e.type==='discovery'&&e.id==='cat'));
}
for(const id of ['rear-narrative','rear-commercial']){
 const item=guide.hotspot(id);assert.equal(guide.nearby(item.point).id,id);assert.equal(guide.hit(item.point).id,id);assert.equal(guide.backstage(item.point),item.category);
 guide.interact(id,world);assert.ok(guide.drain().some(event=>event.type==='backstage'&&event.category===item.category));
}
assert.ok(guide.found.has('backstage'));assert.equal(guide.backstage({x:224,y:282}),null);
console.log('Crew interactions passed: all prop routes, take timing/isolation, fresh and saved cat loops, idle approach, calmer-motion guide/return, wait/follow, first and repeated rewards, pause/rest/return, repeat pets, collision, 30/60/120 Hz replay, and rear-of-set discoveries.');

import assert from 'node:assert/strict';
import {World,stages,findPath,blocked,distance} from '../world.mjs?v=crew3';
import {LotLife,curiosities,catNook,TAKE_LENGTH} from '../life.mjs?v=crew3';

// Every new interaction must be reachable from every existing destination.
for(const source of stages){
 for(const target of [...curiosities.map(item=>item.point),catNook]){
  const w=new World();Object.assign(w.player,source.door);w.goTo(target,'test');
  assert.ok(w.path.length,'A curiosity has no route');
  for(let i=0;i<3600&&!w.arrived;i++){w.update(1/60);assert.ok(!blocked(w.player.x,w.player.y));}
  assert.equal(w.arrived,'test');assert.ok(distance(w.player,target)<10);
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
const guide=new LotLife();Object.assign(w.player,{x:416,y:248});guide.interact('cat',w);
assert.ok(guide.catPath.length);assert.ok(guide.catPath.every(p=>!blocked(p.x,p.y)));
Object.assign(w.player,{x:800,y:312});const still={x:guide.cat.x,y:guide.cat.y};
for(let i=0;i<200;i++)guide.update(.05,w);
assert.equal(guide.cat.x,still.x);assert.equal(guide.cat.y,still.y);assert.ok(guide.cat.waiting);
let reached=false;
for(let i=0;i<6000;i++){
 if(i%30===0)w.goTo(guide.cat);
 w.update(1/60);guide.update(1/60,w);
 assert.ok(!blocked(guide.cat.x,guide.cat.y),'The cat must not walk through scenery');
 if(guide.cat.mode==='nook'){reached=true;break;}
}
assert.ok(reached,'A following player must reach the secret spot');assert.ok(distance(guide.cat,catNook)<1);
assert.ok(!guide.found.has('cat'),'Finding the nook precedes the second pet');
guide.interact('cat',w);assert.equal(guide.cat.mode,'trusted');assert.ok(guide.found.has('cat'));
const restored=new LotLife([...guide.found]);assert.equal(restored.cat.mode,'trusted');assert.ok(distance(restored.cat,catNook)<1);
assert.equal(new LotLife({unexpected:true}).found.size,0);
for(const id of ['rear-narrative','rear-commercial']){
 const item=guide.hotspot(id);assert.equal(guide.nearby(item.point).id,id);assert.equal(guide.hit(item.point).id,id);assert.equal(guide.backstage(item.point),item.category);
 guide.interact(id,w);assert.ok(guide.drain().some(event=>event.type==='backstage'&&event.category===item.category));
}
assert.ok(guide.found.has('backstage'));assert.equal(guide.backstage({x:224,y:282}),null);
console.log('Crew interactions passed: all prop routes, timed take and skip, dialog pause, cat wait/follow/collision/reward persistence, and both rear-of-set discoveries.');

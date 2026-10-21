import assert from 'node:assert/strict';
import {wrapActorsAt,wrapExit,WRAP_WALK_SPEED} from '../wrap-motion.mjs';
import {blocked,obstacles,distance} from '../world.mjs';
import {crew} from '../encounters.mjs';
import {Renderer} from '../renderer.mjs';
const saved=JSON.stringify(crew);
const initial=wrapActorsAt(0);
assert.deepEqual(initial.map(p=>({x:p.x,y:p.y})),crew.map(p=>p.point));
for(const hz of [30,60,120]){
 let previous=initial;const facings=new Set();
 for(let frame=0;frame<=9*hz;frame++){
  const t=frame/hz,actors=wrapActorsAt(t);
  for(const [i,p] of actors.entries()){
   assert.ok(!obstacles.some(o=>p.x>o.x-7&&p.x<o.x+o.w+7&&p.y>o.y-7&&p.y<o.y+o.h+7),`${p.id} clips scenery at ${t}`);
   if(p.y<=wrapExit.y)assert.ok(!blocked(p.x,p.y),`${p.id} leaves the walkable lot at ${t}`);
   else assert.equal(p.x,wrapExit.x,'Off-lot travel must use the entrance opening');
   assert.ok(distance(p,previous[i])<=WRAP_WALK_SPEED/hz+.00001,'No jumps or corner cutting');
   facings.add(p.face);
  }
  previous=actors;
 }
 assert.ok(facings.has('left')&&facings.has('right')&&facings.has('down'),'Actors turn at route corners');
 assert.ok(previous.every(p=>p.exited),'Everyone finishes before the credits');
}
// Check the renderer actually uses the collision-safe samples, including seeking
// backwards, replay and calmer motion. This fails for the old straight-line draw.
const context=new Proxy({},{get:(o,k)=>o[k]??(()=>{})});
const canvas={width:720,height:540,getContext:()=>context};
const painted=[];
const renderer={base:{},reduced:false,paintLook(){},catSprite(){},actor(c,x,y,face,step,moving,coat){painted.push({x,y,face,step,moving,coat});}};
for(const reduced of [false,true])for(const t of [0,1,3,5,7,9,12,3,0]){
 renderer.reduced=reduced;painted.length=0;Renderer.prototype.drawWrap.call(renderer,canvas,t);
 const expected=wrapActorsAt(t).filter(p=>!p.exited).sort((a,b)=>a.y-b.y);
 assert.deepEqual(painted,expected.map(p=>({x:p.x,y:p.y,face:p.face,step:p.step,moving:p.moving&&!reduced,coat:p.coat})));
}
assert.equal(JSON.stringify(crew),saved,'Wrap must not mutate the live crew');
assert.deepEqual(wrapActorsAt(0),initial,'Replay starts at the crew positions');
console.log('Wrap routes passed: all crew at 30/60/120 Hz avoid every obstacle, use the gate, turn at corners, exit before credits, and replay/seek without mutating the lot. Renderer wiring and calmer motion passed.');

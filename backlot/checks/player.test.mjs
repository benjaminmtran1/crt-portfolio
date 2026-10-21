import assert from 'node:assert/strict';
import {drawPlayer,playerPose,playerPalette} from '../player.mjs';
import {Renderer} from '../renderer.mjs';
import {World} from '../world.mjs';

function recorder(){
 const calls=[];
 const c={fillStyle:null,fillRect(...v){calls.push(['rect',this.fillStyle,...v]);},beginPath(){},ellipse(...v){calls.push(['shadow',...v]);},fill(){}};
 return {c,calls};
}
const render=(face='down',step=0,moving=false,x=100,y=100)=>{const r=recorder();drawPlayer(r.c,x,y,face,step,moving);return r.calls;};
const shadow=render()[0];
assert.deepEqual(shadow,['shadow',101,101,8,3,0,0,Math.PI*2]);
for(const face of ['down','up','left','right']){
 const idle=render(face);
 assert.deepEqual(render(face,932,false),idle,'Stopped sprites must not retain a half-stride');
 assert.ok(idle.some(c=>c[1]===playerPalette.w),'Every facing retains the striped shirt');
 assert.ok(idle.some(c=>c[1]===playerPalette.h),'Every facing retains the dark wavy hair');
 const walk=[];
 for(let frame=0;frame<4;frame++){
  const calls=render(face,frame*Math.PI/2+.01,true);walk.push(JSON.stringify(calls));
  assert.deepEqual(calls[0],shadow,'Gait cannot shift the ground shadow');
  for(const [kind,,x,y,w,h]of calls){
   if(kind!=='rect')continue;
   assert.ok([x,y,w,h].every(Number.isInteger),'All sprite marks land on whole pixels');
   assert.ok(w>0&&h>0,'No gait pose may produce a reversed rectangle');
   assert.ok(x>=91&&x+w<=110,'Sprite width remains compatible with the prior player');
   assert.ok(y>=65&&y+h<=103,'Sprite height and feet remain at the original world scale');
  }
  assert.deepEqual(calls,render(face,(frame+4)*Math.PI/2+.01,true),'Walk loops without a seam');
 }
 assert.equal(new Set(walk).size,3,'Contact poses alternate around a shared passing pose');
 assert.notDeepEqual(JSON.parse(walk[1]),JSON.parse(walk[3]),'Opposing legs and arms must exchange');
}
assert.deepEqual(render('bad-direction'),render('down'),'Unknown facing uses a safe front view');
assert.deepEqual(render('down',0,false,100.2,99.8),render(),'Subpixel movement cannot blur the art');
assert.notDeepEqual(render('up'),render('down'),'The back must not show a face or open tank');
assert.notDeepEqual(render('left'),render('right'),'Side profiles must have a real facing');
assert.ok(render('down').some(c=>c[1]===playerPalette.p),'The front preserves the tiny silver hoop');
assert.ok(!render('up').some(c=>c[1]===playerPalette.p),'The hoop is not stamped onto the back');
for(const step of [0,.1,1.6,3.2,4.8,100,-2])assert.ok(Number.isFinite(playerPose(step,true).stride));
assert.deepEqual(playerPose(0,false),{frame:0,stride:0,bob:0});

// All renderer player entry points use the likeness; NPCs keep the old art.
const player=recorder();Renderer.prototype.actor(player.c,100,100,'down',Math.PI/2,true);
assert.deepEqual(player.calls,render('down',Math.PI/2,true));
const npc=recorder();Renderer.prototype.actor(npc.c,100,100,'down',0,false,'#829786',true);
assert.ok(npc.calls.some(c=>c[1]==='#829786'));
assert.ok(npc.calls.some(c=>c[1]==='#8c7258'),'Crew retains its hat');
assert.ok(!npc.calls.some(c=>c[1]===playerPalette.w),'Player outfit cannot leak onto NPCs');

// Rendering is pure: animation must never edit position, velocity or collision.
const world=new World(),before=structuredClone(world.player);const ctx=recorder().c;
drawPlayer(ctx,world.player.x,world.player.y,world.player.face,world.player.step,world.player.moving);
assert.deepEqual(world.player,before);
console.log('Player checks passed: portrait details, four facings, gait loop, stopped/reduced-motion pose, pixel grid, ground anchor, original scale, renderer dispatch, NPC isolation and pure rendering.');

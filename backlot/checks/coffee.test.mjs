import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {LotLife,TAKE_LENGTH} from '../life.mjs';
import {World,craftStop} from '../world.mjs';
import {crewReply,lightingLooks} from '../departments.mjs';
import {drawPlayer,playerPalette} from '../player.mjs';
import {Renderer} from '../renderer.mjs';
import {crew as crewRoster} from '../encounters.mjs';

// The craft stamp remembers a conversation, not a drink carried between visits.
for(const saved of [[],['craft'],['cat','craft','lighting','take','build','backstage']]){
 const life=new LotLife(saved),world=new World();
 assert.equal(life.hasCoffee,false,'A new session starts empty-handed, even with a saved craft stamp');
 Object.assign(world.player,craftStop);life.interact('craft',world);
 assert.equal(life.hasCoffee,false,'Visiting the truck does not order a coffee');
 assert.ok(life.drain().some(event=>event.type==='craft'));
 for(const topic of ['day','rumour','day']){
  const expected=crewReply(topic,life.found,life.chatCount);
  assert.equal(life.chat(topic),expected,'Existing chatter and hints stay unchanged');
  assert.equal(life.hasCoffee,false,'Only the explicit coffee choice equips a cup');
 }
 assert.equal(life.chatCount,2);assert.ok(life.found.has('craft'));life.drain();
 const found=[...life.found],reply=life.chat('coffee');
 assert.equal(reply,'One coffee. No quest attached. Take your time — we’re still waiting on lighting.');
 assert.equal(life.hasCoffee,true);assert.equal(life.chatCount,2);
 for(let i=0;i<5;i++)assert.equal(life.chat('coffee'),reply);
 assert.equal(life.hasCoffee,true);assert.deepEqual([...life.found],found);
 assert.equal(life.drain().length,0,'Repeated orders neither duplicate the stamp nor add events');
 for(const look of lightingLooks){life.selectLight(look.id);assert.equal(life.hasCoffee,true);}
 world.goTo({x:472,y:332});
 for(let i=0;i<60*120;i++){world.update(1/60);life.update(1/60,world);}
 assert.equal(world.path.length,0);assert.equal(life.hasCoffee,true,'The cup survives walking and has no timer');
 world.paused=true;life.update(1,world);assert.equal(life.hasCoffee,true);world.paused=false;
 for(const skipped of [true,false]){
  life.interact('slate',world);assert.ok(life.take);assert.equal(life.hasCoffee,true);
  if(skipped)life.finishTake(true);else for(let i=0;i<(TAKE_LENGTH+.1)*60;i++)life.update(1/60,world);
  assert.equal(life.take,null);assert.equal(life.hasCoffee,true,'Both skipped and completed takes retain the drink');
 }
 assert.equal(new LotLife([...life.found]).hasCoffee,false,'Saved discoveries never restore session-only coffee');
}
const firstOrder=new LotLife();firstOrder.chat('coffee');
assert.deepEqual(firstOrder.drain(),[{type:'discovery',id:'craft'}],'A first coffee still awards exactly the existing craft stamp');

function recorder(){
 const calls=[];
 const c={fillStyle:null,fillRect(...v){calls.push(['rect',this.fillStyle,...v]);},beginPath(){},ellipse(...v){calls.push(['shadow',...v]);},fill(){}};
 return {c,calls};
}
const render=(face='down',step=0,moving=false,coffee=true,x=100,y=100)=>{const r=recorder();drawPlayer(r.c,x,y,face,step,moving,coffee);return r.calls;};
const faces=['down','up','left','right'],steps=[0,Math.PI/2+.01,Math.PI+.01,Math.PI*1.5+.01];
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const unchanged=[];
for(const face of faces)for(const moving of [false,true])for(const step of steps)unchanged.push(render(face,step,moving,false));
assert.equal(digest(unchanged),'3c7dc2a6f7f294d848b64eb3ac8cc7f44b979a2f97eba7b4d20981b101f378f8','No-coffee drawing is byte-for-byte unchanged from the original sprite');

// Rasterize opaque sprite marks so a cup painted over by the body cannot pass.
function pixels(calls){
 const result=new Map();
 for(const [kind,color,x,y,w,h]of calls)if(kind==='rect')for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)result.set(`${xx},${yy}`,color);
 return result;
}
const cupColors=['#f9efce','#624b35','#273e43'];
const legs=calls=>calls.filter(call=>call[0]==='rect'&&[playerPalette.t,playerPalette.T,playerPalette.k,playerPalette.K].includes(call[1]));
for(const face of faces){
 const idle=render(face);
 assert.deepEqual(render(face,932,false),idle,'Stopped and calmer-motion poses hold the cup still');
 for(const moving of [false,true])for(const step of steps){
  const held=render(face,step,moving),empty=render(face,step,moving,false),visible=[...pixels(held).values()];
  for(const color of cupColors)assert.ok(visible.includes(color),`${face} ${moving?'walking':'idle'} visibly retains paper, sleeve and lid`);
  assert.deepEqual(held[0],empty[0],'Holding coffee cannot move the ground shadow');
  assert.deepEqual(legs(held),legs(empty),'Holding coffee leaves the feet and stride unchanged');
  for(const [kind,,x,y,w,h]of held)if(kind==='rect'){
   assert.ok([x,y,w,h].every(Number.isInteger),'Cup and player stay on the pixel grid');
   assert.ok(w>0&&h>0);assert.ok(x>=85&&x+w<=115&&y>=65&&y+h<=103,'Cup remains a small handheld prop at the original scale');
  }
  assert.deepEqual(held,render(face,step+Math.PI*2,moving),'Coffee poses loop without an animation seam');
 }
 const actor=recorder();Renderer.prototype.actor(actor.c,100,100,face,Math.PI/2,true,undefined,false,true);
 assert.deepEqual(actor.calls,render(face,Math.PI/2,true),'Renderer forwards the cup to the playable character');
}
assert.deepEqual(render('unknown'),render('down'));assert.deepEqual(render('down',0,false,true,100.2,99.8),render());
const npcs=[];
for(const face of faces)for(const moving of [false,true]){
 const empty=recorder(),held=recorder();
 Renderer.prototype.actor(empty.c,100,100,face,Math.PI/2,moving,'#829786',true);
 Renderer.prototype.actor(held.c,100,100,face,Math.PI/2,moving,'#829786',true,true);
 assert.deepEqual(held.calls,empty.calls,'Player coffee must never leak onto crew sprites');npcs.push(empty.calls);
}
assert.equal(digest(npcs),'136dd98d796029f753621502c2150c570a004a266f2a715fbf3debc5727a6a2e','Crew drawing remains unchanged');

// Exercise both real renderer entry points without depending on a Canvas addon.
const c=new Proxy({}, {get:(o,key)=>key in o?o[key]:()=>{}}),actors=[];
const renderer={c,w:960,h:720,camera:{x:480,y:360},base:{},takeLight:{},backings:new Map(),rain:false,
 actor(...args){actors.push(args);},slate(){},craftSteam(){},catSprite(){},paintLook(){},filmScene(){}};
const world=new World(),life=new LotLife(),before=structuredClone(world.player);world.player.moving=true;
for(const reduced of [false,true])for(const coffee of [false,true]){
 renderer.reduced=reduced;life.hasCoffee=coffee;actors.length=0;
 Renderer.prototype.render.call(renderer,world,1/60,life);
 const player=actors.filter(args=>!args[7]),crew=actors.filter(args=>args[7]);
 assert.equal(player.length,1);assert.equal(crew.length,crewRoster.length+1);
 assert.equal(Boolean(player[0][8]),coffee,'The live lot uses the current session coffee state');
 assert.equal(player[0][5],!reduced,'Calmer motion suppresses gait, not the cup');
 assert.ok(crew.every(args=>!args[8]),'Only Ben carries the ordered cup in the live lot');
 actors.length=0;
 Renderer.prototype.drawLighting.call(renderer,{width:720,height:540,getContext:()=>c},world,life);
 assert.equal(actors.filter(args=>!args[7]).length,1);
 assert.equal(Boolean(actors.find(args=>!args[7])[8]),coffee,'The lighting preview keeps the player cup');
 assert.ok(actors.filter(args=>args[7]).every(args=>!args[8]),'The lighting preview does not equip the craft worker');
}
world.player.moving=before.moving;assert.deepEqual(world.player,before,'Rendering with coffee never changes player position or animation state');
console.log('Coffee checks passed: explicit order only, unchanged dialogue/stamps, session-only persistence, repeated orders, walking/takes/lighting, four visible cup facings, gait/reduced motion, unchanged feet/shadow/no-coffee/NPC art, live/preview dispatch and pure rendering.');

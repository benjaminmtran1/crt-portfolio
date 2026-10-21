import assert from 'node:assert/strict';
import {Renderer} from '../renderer.mjs';
import {World,craftCup} from '../world.mjs';
import {LotLife} from '../life.mjs';

function canvas(width=960,height=720){
 const calls=[],ctx=new Proxy({fillStyle:null,strokeStyle:null},{get(o,k){
  if(k in o)return o[k];
  return(...args)=>{for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),`${k} received a non-finite coordinate`);calls.push([k,o.fillStyle,o.strokeStyle,...args]);};
 }});
 return{width,height,calls,getContext:()=>ctx};
}
const truck=canvas(),ctx=truck.getContext();Renderer.prototype.craftServicesTruck(ctx);
const rects=truck.calls.filter(c=>c[0]==='fillRect');
assert.ok(rects.some(c=>c[1]==='#faf9ee'&&c[5]===97&&c[6]===18),'The tall blank roof board must stay bright and unbranded');
assert.ok(rects.some(c=>c[1]==='#24393b'&&c[5]===78&&c[6]===25),'Serving hatch remains genuinely open, not a painted window');
assert.ok(rects.some(c=>c[1]==='#efcf8c'),'The interior retains a warm practical light');
assert.ok(rects.filter(c=>c[1]==='#faf1d4').length>=3,'Ready cups remain on the fold-out ledge');
assert.ok(rects.filter(c=>c[1]==='#e2e6d4').length>=4,'Both dark tyres retain bright chrome rims');
assert.ok(rects.some(c=>c[1]==='#405b5d'&&c[4]<330),'The CRAFT plaque stays above the player and waiting crew');
const snapshots=JSON.stringify(truck.calls);truck.calls.length=0;ctx.fillStyle=null;ctx.strokeStyle=null;Renderer.prototype.craftServicesTruck(ctx);assert.equal(JSON.stringify(truck.calls),snapshots,'Static truck art is deterministic');

const steam=canvas(),steamCtx=steam.getContext(),before=structuredClone(craftCup);
Renderer.prototype.craftSteam.call({reduced:true},steamCtx,5);assert.equal(steam.calls.length,0,'Calmer motion disables steam entirely');
Renderer.prototype.craftSteam.call({reduced:false},steamCtx,0);const first=JSON.stringify(steam.calls);steam.calls.length=0;
Renderer.prototype.craftSteam.call({reduced:false},steamCtx,.8);assert.notEqual(JSON.stringify(steam.calls),first,'Steam gently animates at the actual serving cup');
for(const call of steam.calls.filter(c=>c[0]==='moveTo'||c[0]==='lineTo')){
 assert.ok(Math.abs(call[3]-craftCup.x)<=4);assert.ok(call[4]<craftCup.y&&call[4]>craftCup.y-20);
}
assert.deepEqual(craftCup,before,'Steam never moves the cup or world geometry');

const output=canvas(),renderer=new Renderer(output,canvas),world=new World(),life=new LotLife(['cat','craft']);renderer.w=960;renderer.h=720;renderer.rain=false;
const baseCount=renderer.base.calls.length,position=structuredClone(world.player),saved=[...life.found];
for(const reduced of [false,true])for(const lighting of ['work','golden','night']){
 renderer.reduced=reduced;life.lighting=lighting;
 for(let i=0;i<60;i++){world.t=i/30;renderer.render(world,1/30,life);output.calls.length=0;}
}
assert.equal(renderer.base.calls.length,baseCount,'Vehicle painting and dithered lighting stay cached, not rebuilt per frame');
assert.deepEqual(world.player,position);assert.deepEqual([...life.found],saved,'Rendering never alters discoveries');
assert.ok(renderer.lookLayers.has('golden')&&renderer.lookLayers.has('night'));
console.log('Craft rendering passed: white reference board, open warm hatch, counter cups, chrome rims, readable plaque, deterministic cached artwork, cup-anchored steam, calmer motion, 360 finite day/golden/night frames and pure world/discovery state.');

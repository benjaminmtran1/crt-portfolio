import assert from 'node:assert/strict';
import {World} from '../world.mjs?v=crew3';
import {LotLife,catHome} from '../life.mjs?v=crew3';
import {BuildSequence,BUILD_LENGTH,lightingLooks,crewReply} from '../departments.mjs?v=crew3';

const world=new World(),life=new LotLife(['take','cat']);
for(const id of ['lighting','craft','build']){
 life.interact(id,world);assert.ok(life.drain().some(event=>event.type===id));
 assert.ok(!life.found.has(id),'Opening a discovery should not complete it');
 const item=life.hotspot(id);assert.equal(life.hit(item.point).id,id);assert.equal(life.nearby(item.point).id,id);
}
for(const look of lightingLooks){life.selectLight(look.id);assert.equal(life.lighting,look.id);assert.ok(life.drain().some(e=>e.type==='lighting-change'&&e.id===look.id));}
const current=life.lighting;life.selectLight('broken-value');assert.equal(life.lighting,current);
assert.ok(life.found.has('lighting'));
const smallTalk=new Set(Array.from({length:4},()=>life.chat('day')));assert.equal(smallTalk.size,4);
assert.ok(life.chat('coffee').includes('One coffee'));assert.ok(life.found.has('craft'));
const found=new Set();const expected=['cat','backstage','lighting','build','take'];
const hints=[];for(const id of expected){hints.push(crewReply('rumour',found));found.add(id);}
assert.equal(new Set(hints).size,5,'Hints should change as discoveries are completed');
assert.ok(crewReply('rumour',found).includes('every corner'));
for(const hz of [30,60,120]){
 const seq=new BuildSequence();for(let i=0;i<(BUILD_LENGTH+.1)*hz;i++)seq.update(1/hz);
 assert.ok(seq.complete);assert.equal(seq.playing,false);assert.equal(seq.step,3);assert.equal(seq.progress(3),1);
 seq.replay();assert.equal(seq.elapsed,0);assert.ok(seq.playing);
}
const seq=new BuildSequence();seq.update(.05);const before=seq.elapsed;
for(let i=0;i<100;i++)seq.update(.05,false);assert.equal(seq.elapsed,before,'Background tabs and closed dialogs must not advance a build');
seq.playing=false;seq.update(.05);assert.equal(seq.elapsed,before);
for(let i=0;i<4;i++){seq.show(i);assert.equal(seq.step,i);assert.equal(seq.playing,false);assert.ok(seq.progress(i)>.999);}
seq.show(-1);assert.equal(seq.step,3);seq.show(12);assert.equal(seq.step,3);
const calm=new BuildSequence(true);assert.equal(calm.playing,false);calm.update(.05);assert.equal(calm.step,0);calm.show(3);assert.ok(calm.complete,'Reduced motion users can reach the finished set without autoplay');
life.discover('build');const saved=new LotLife([...life.found]);for(const id of ['take','cat','lighting','craft','build'])assert.ok(saved.found.has(id));assert.equal(saved.cat.mode,'idle');assert.equal(saved.cat.x,catHome.x);assert.equal(saved.cat.y,catHome.y);
life.interact('slate',world);life.drain();for(const id of ['lighting','craft','build'])life.interact(id,world);assert.equal(life.drain().length,0,'Crew props must not interrupt a take');
console.log('Departments passed: lighting choices, evolving crew dialogue, manual and timed construction, reduced motion, pause/resume, existing rewards and take isolation.');

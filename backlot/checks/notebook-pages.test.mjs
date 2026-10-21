import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {FieldNotebook,notebookLeaves,discoveryEntries,resolveBookmark} from '../notebook.mjs';
import {NotebookPageTurn} from '../notebook-motion.mjs';
import {crew} from '../encounters.mjs';
import {stages} from '../world.mjs';

for(const count of [0,1,2,3,20,100]){
 const pages=notebookLeaves(count);
 assert.deepEqual(pages.map(p=>p.section),['saved','lot','crew'],'Exactly three pages regardless of saved project count');
}
const fakeLeaf=()=>({animations:[],animate(frames,options){
 let resolve,reject;const finished=new Promise((yes,no)=>{resolve=yes;reject=no;});
 const animation={frames,options,finished,cancelled:false,finish:resolve,cancel(){this.cancelled=true;reject(new Error('cancelled'));}};
 this.animations.push(animation);return animation;
}});
const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
for(const direction of [1,-1]){
 const turn=new NotebookPageTurn(),old=fakeLeaf(),next=fakeLeaf();let current=old,renders=0;
 const pending=turn.turn(()=>current,()=>{renders++;current=next;},{direction});
 assert.equal(renders,0,'Wait for the outgoing leaf');
 assert.equal(old.animations[0].frames[1].transform,'rotateY('+(direction>0?-76:76)+'deg)');
 old.animations[0].finish();await flush();assert.equal(renders,1);assert.equal(next.animations.length,1);
 next.animations[0].finish();assert.equal(await pending,true);assert.equal(turn.animation,null);
}
{
 const turn=new NotebookPageTurn(),leaf=fakeLeaf();let renders=0;
 await turn.turn(()=>leaf,()=>renders++,{reduced:true});assert.equal(renders,1);assert.equal(leaf.animations.length,0);
 await turn.turn(()=>({}),()=>renders++);assert.equal(renders,2,'Older browsers switch instantly');
 const pending=turn.turn(()=>leaf,()=>renders++);turn.cancel();await pending;assert.equal(renders,2,'Closing never reopens a deferred notebook');
 let active=true;const hidden=turn.turn(()=>leaf,()=>renders++,{active:()=>active});active=false;leaf.animations.at(-1).finish();assert.equal(await hidden,false);assert.equal(renders,2);
}
{
 const turn=new NotebookPageTurn(),leaf=fakeLeaf();let result='';
 const first=turn.turn(()=>leaf,()=>result='stale');
 const second=turn.turn(()=>leaf,()=>result='latest');
 leaf.animations.at(-1).finish();await flush();leaf.animations.at(-1).finish();await Promise.all([first,second]);assert.equal(result,'latest');
}
const source=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
assert.doesNotMatch(source,/data-open-camera|SHOW ME THE CAMERA VIEW/);
assert.equal(crew.find(p=>p.name==='Frankie').role,'Carpenter');
const notebook=new FieldNotebook(),projects=Array.from({length:5},(_,i)=>({id:'narrative-'+i,title:'Build '+i,category:'narrative',image:'build-'+i+'.jpg'}));
for(const p of projects)notebook.toggle(p,projects);
notebook.met.add('grip');const saved=notebook.serialize(),panel={open:false,dataset:{}},drawn=[];
const panelInner={innerHTML:'',querySelectorAll(){return [...this.innerHTML.matchAll(/data-notebook-portrait="([^"]+)"/g)].map(m=>({dataset:{notebookPortrait:m[1]}}));}};
const env={content:{},notebook,projects,notebookLeaves,NotebookPageTurn,resolveBookmark,discoveryEntries,crew,stages,panel,panelInner,
 world:{visited:new Set(['about'])},life:{found:new Set(['crew','screw'])},settings:{reduced:true},
 drawCrewPortrait(canvas,id){drawn.push(id);},$:()=>({focus(){}}),requestAnimationFrame:fn=>fn(),focusHeading(){},stopMedia(){},
 escape:s=>String(s??'').replace(/[&<>"']/g,'_'),pic:s=>s,thumbnailFor:p=>p.image,placeholder:'placeholder.svg',stage:id=>stages.find(s=>s.id===id),
 openPanel(kind){panel.open=true;panel.dataset.kind=kind;}
};
const functions=source.slice(source.indexOf('function openNotebook('),source.indexOf('function openCamera()'));
const app=runInNewContext("let notebookTab='saved',notebookPage=0;const notebookTurn=new NotebookPageTurn();"+functions+";({openNotebook,state:()=>({notebookTab,notebookPage})})",env);
app.openNotebook();for(let i=0;i<5;i++)assert.match(panelInner.innerHTML,new RegExp('Build '+i));
assert.match(panelInner.innerHTML,/Page 1 of 3/);assert.match(panelInner.innerHTML,/01 \/ 03/);
assert.match(panelInner.innerHTML,/data-notebook-step="-1"[^>]*disabled/);
app.openNotebook('saved',1,true);assert.equal(app.state().notebookTab,'lot');assert.match(panelInner.innerHTML,/Page 2 of 3/);
assert.match(panelInner.innerHTML,/Places visited/);assert.match(panelInner.innerHTML,/Crew discoveries/);
assert.equal((panelInner.innerHTML.match(/data-notebook-place=/g)||[]).length,6);
assert.equal((panelInner.innerHTML.match(/class="notebook-stamp /g)||[]).length,10);
assert.match(panelInner.innerHTML,/Pocket hardware/);
app.openNotebook('lot',2,true);assert.equal(app.state().notebookTab,'crew');assert.match(panelInner.innerHTML,/Page 3 of 3/);
for(const label of ['Carpenter','Frankie','Production assistant','Craft services'])assert.match(panelInner.innerHTML,new RegExp(label));
assert.deepEqual(drawn,['scenic','grip','pa','craft'],'Every notebook portrait uses the matching new crew sprite');
assert.match(panelInner.innerHTML,/data-notebook-step="1"[^>]*disabled/);
app.openNotebook('saved',null,true);assert.match(panelInner.innerHTML,/Page 1 of 3/);
assert.equal(notebook.serialize(),saved,'Turning pages must not alter saved projects or introductions');
app.openNotebook('saved',999);assert.equal(app.state().notebookPage,notebookLeaves(5).length-1);
app.openNotebook('saved',-1);assert.equal(app.state().notebookPage,0);
console.log('Pocket notebook passed: complete pagination, page controls and content, portrait/title wiring, both turn directions, calmer motion, unsupported-animation fallback, interruption, close cancellation and unchanged saves.');

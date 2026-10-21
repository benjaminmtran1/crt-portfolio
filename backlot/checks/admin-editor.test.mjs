// DOM/data integration checks. Install linkedom in a temporary test directory,
// then set ADMIN_DOM_MODULE to its absolute package path (see ADMIN.md).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {parseHTML}=require(process.env.ADMIN_DOM_MODULE || 'linkedom');
const root=path.resolve(import.meta.dirname,'../..');
const html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
const raw=JSON.parse(fs.readFileSync(path.join(root,'content.json'),'utf8'));
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const {document,Event}=parseHTML(html);
const storage=new Map(),downloads=[],puts=[],windowEvents=new Map();
let confirmAnswer=true,promptAnswer='',fetchHook=null;
const context=vm.createContext({document,console,Blob,Uint8Array,Date,JSON,Set,WeakSet,WeakMap,Promise,queueMicrotask,encodeURIComponent,unescape,atob,btoa,
  URL:{createObjectURL:blob=>{downloads.push(blob);return 'blob:test';},revokeObjectURL:()=>{}},
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
  window:{addEventListener:(type,fn)=>windowEvents.set(type,fn)},
  confirm:()=>confirmAnswer,prompt:()=>promptAnswer,alert:()=>{},
  fetch:async(url,options={})=>{
    if(fetchHook)return fetchHook(url,options);
    if(url==='content.json')return {ok:true,json:async()=>structuredClone(raw)};
    if(options.method==='PUT'){puts.push({url,payload:JSON.parse(options.body)});return {ok:true};}
    return {ok:true,json:async()=>({sha:'existing-sha'})};
  }
});
vm.runInContext(source,context,{filename:'admin.html'});
const run=s=>vm.runInContext(s,context);
const state=()=>JSON.parse(run('JSON.stringify(content)'));
const drain=()=>new Promise(r=>setImmediate(r));
const select=id=>run(`selected=content.channels.findIndex(c=>c.id===${JSON.stringify(id)});renderEditor();`);
const click=selector=>{const el=document.querySelector(selector);assert.ok(el,selector);el.click();};
const input=(selector,value,event='input')=>{const el=document.querySelector(selector);assert.ok(el,selector);el.value=value;el.dispatchEvent(new Event(event,{bubbles:true}));};
await drain();await drain();
assert.deepEqual(state(),raw,'Loading must not normalize or drop stored content');
assert.equal(run('selected'),raw.channels.findIndex(c=>c.type==='guide'),'Project-first default');
for(const ch of raw.channels){select(ch.id);assert.ok(document.querySelector('#editorBody').innerHTML.length);}
assert.deepEqual(state(),raw,'Visiting every editor must preserve data exactly');
assert.equal(run('hasDraftChanges()'),false);
const fixture=structuredClone(raw);fixture.future={nested:['keep',7]};fixture.site.experimental='retained';fixture.channels[0].legacyExtra={privateShape:true};fixture.channels.find(c=>c.type==='guide').projects[0].unrecognized={a:1};
context.fixture=fixture;run('boot(JSON.parse(JSON.stringify(fixture)))');
for(const ch of fixture.channels)select(ch.id);
assert.deepEqual(state(),fixture,'Unknown top-level, site, section and project data survives');
// An edit must affect exactly its expected field, not neighboring legacy values.
select('narrative');const expected=structuredClone(fixture);expected.channels.find(c=>c.id==='narrative').projects[0].title='Edited title';
input('[data-f="p.0.title"]','Edited title');await drain();assert.deepEqual(state(),expected);assert.equal(run('hasDraftChanges()'),true);
select('commercial');select('narrative');assert.equal(document.querySelector('[data-f="p.0.title"]').value,'Edited title');
// Keyboard-operable disclosure buttons, repeated clicks and item identity on reorder.
click('[data-toggle="proj:0"]');assert.equal(document.querySelector('[data-toggle="proj:0"]').getAttribute('aria-expanded'),'true');
click('[data-toggle="proj:0"]');assert.equal(document.querySelector('[data-toggle="proj:0"]').getAttribute('aria-expanded'),'false');
click('[data-toggle="proj:0"]');click('[data-proj-down="0"]');assert.equal(state().channels.find(c=>c.id==='narrative').projects[1].title,'Edited title');assert.equal(document.querySelector('[data-toggle="proj:1"]').getAttribute('aria-expanded'),'true');
// Every newly generated label points at a real, unique control.
const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);assert.equal(ids.length,new Set(ids).size);
for(const label of document.querySelectorAll('label[for]'))assert.ok(document.getElementById(label.htmlFor || label.getAttribute('for')),label.outerHTML);
for(const button of document.querySelectorAll('[aria-controls]'))assert.ok(document.getElementById(button.getAttribute('aria-controls')));
// Add/edit/reorder/remove project and gallery. Delegation must not duplicate handlers.
const before=state().channels.find(c=>c.id==='narrative').projects.length;
click('#addProject');assert.equal(state().channels.find(c=>c.id==='narrative').projects.length,before+1);
assert.equal(document.querySelector('#chList .active .nav-count').textContent,String(before+1));
input(`[data-f="p.${before}.title"]`,'New project');input(`[data-f="p.${before}.tags"]`,'Construction coordinator');
click(`[data-add-gal="${before}"]`);input(`[data-f="p.${before}.gallery.0.caption"]`,'On set');
promptAnswer='https://vimeo.com/12345';click(`[data-mediaurl="gal:${before}:0"]`);
assert.equal(state().channels.find(c=>c.id==='narrative').projects[before].gallery[0].src,promptAnswer);
click(`[data-meta-add="${before}"]`);input(`[data-f="p.${before}.meta.0.k"]`,'Year');input(`[data-f="p.${before}.meta.0.v"]`,'2026');
click(`[data-mediaclear="gal:${before}:0"]`);assert.equal(state().channels.find(c=>c.id==='narrative').projects[before].gallery[0].src,'');
click(`[data-gal-del="${before}:0"]`);click(`[data-proj-del="${before}"]`);assert.equal(state().channels.find(c=>c.id==='narrative').projects.length,before);
// Site identity, About and Contact write exactly to the old canonical schema.
select('signal');input('#siteHeroName','Ben Test');input('#sitePageTitle','Test portfolio');input('[data-f="sub"]','Designer');
assert.equal(state().site.heroName,'Ben Test');assert.equal(state().channels[0].sub,'Designer');
select('about');input('[data-f="role"]','Builder');input('[data-para="0"]','Updated biography');click('#addSlate');const slateIndex=state().channels.find(c=>c.id==='about').slate.length-1;input(`[data-f="sl.${slateIndex}.k"]`,'Location');input(`[data-f="sl.${slateIndex}.v"]`,'Toronto');
select('contact');input('[data-f="r.0.label"]','Hello');assert.equal(state().channels.find(c=>c.id==='contact').rows[0].label,'Hello');
// JSON export must be lossless, including all hidden and unknown properties.
await document.getElementById('btnDownload').onclick();const exported=JSON.parse(await downloads[0].text());assert.deepEqual(exported,state());assert.deepEqual(exported.future,fixture.future);
// Import accepts a full file, rejects malformed structures, and canceled replacement keeps draft/media.
const beforeImport=state();confirmAnswer=false;await document.getElementById('jsonPicker').onchange({target:{files:[{text:async()=>JSON.stringify(raw)}],value:'chosen'}});assert.deepEqual(state(),beforeImport);
confirmAnswer=true;run("pendingAssets['assets/test.jpg']={base64:'YWJj',mime:'image/jpeg'}");
await document.getElementById('jsonPicker').onchange({target:{files:[{text:async()=>'{invalid'}],value:'chosen'}});assert.deepEqual(state(),beforeImport);assert.equal(run('Object.keys(pendingAssets).length'),1);
await document.getElementById('jsonPicker').onchange({target:{files:[{text:async()=>JSON.stringify(fixture)}],value:'chosen'}});assert.deepEqual(state(),fixture);assert.equal(run('Object.keys(pendingAssets).length'),0);
assert.throws(()=>run('boot({site:{},channels:[{projects:[null]}]})'),/Invalid projects/);
// Interrupted media decode may never attach media from an old draft to a newly imported draft.
let finishDecode;context.decodeMedia=()=>new Promise(resolve=>{finishDecode=resolve;});
run('prepareMedia = decodeMedia');select('narrative');click('[data-media="proj:0"]');
const mediaInput={files:[{name:'test.jpg'}],value:'selected'};
const decoding=document.getElementById('mediaPicker').onchange({target:mediaInput});
run('boot(JSON.parse(JSON.stringify(fixture)))');finishDecode({base64:'YWJj',mime:'image/jpeg',name:'test.jpg'});await decoding;
assert.equal(run('Object.keys(pendingAssets).length'),0);assert.equal(mediaInput.value,'');assert.equal(run('mediaTarget'),null);assert.deepEqual(state(),fixture);

// Unknown section kinds remain intact and safely readable, while sparse old sections can still be edited.
const extended=structuredClone(fixture);extended.channels.push({id:'future',type:'future',opaque:{keep:1}},{id:'sparse-profile',type:'profile'},{id:'sparse-custom',type:'custom'});context.extended=extended;run('boot(JSON.parse(JSON.stringify(extended)))');for(const ch of extended.channels)select(ch.id);assert.deepEqual(state(),extended);
select('sparse-profile');click('#addPara');assert.equal(state().channels.find(c=>c.id==='sparse-profile').paragraphs.length,1);
select('sparse-custom');click('[data-add-blk="text"]');assert.equal(state().channels.find(c=>c.id==='sparse-custom').blocks.length,1);
// New work categories use the existing guide schema, no map IDs are rewritten.
run('boot(JSON.parse(JSON.stringify(fixture)))');click('#btnAddChannel');assert.equal(state().channels.at(-1).type,'guide');assert.ok(state().channels.at(-1).id.startsWith('ch-'));assert.deepEqual(state().channels.slice(0,-1),fixture.channels);
// Publishing exercised against a mocked GitHub transport only: media before content, branch, UTF-8 and SHA.
run('boot(JSON.parse(JSON.stringify(fixture)))');run("pendingAssets['assets/qa.jpg']={base64:'YWJj',mime:'image/jpeg'}");input('#ghToken','test-token');input('#ghOwner','test-owner');input('#ghRepo','test-repo');
await document.getElementById('btnPublish').onclick();assert.equal(puts.length,2);assert.ok(puts[0].url.endsWith('/assets/qa.jpg'));assert.ok(puts[1].url.endsWith('/content.json'));assert.equal(puts[1].payload.branch,'main');assert.equal(puts[1].payload.sha,'existing-sha');
const published=JSON.parse(Buffer.from(puts[1].payload.content,'base64').toString('utf8'));assert.deepEqual({...published.site,updatedAt:undefined},{...fixture.site,updatedAt:undefined});assert.deepEqual(published.channels,fixture.channels);assert.deepEqual(published.future,fixture.future);assert.ok(published.site.updatedAt);assert.equal(run('hasDraftChanges()'),false);assert.equal(run('Object.keys(pendingAssets).length'),0);assert.equal(document.getElementById('btnPublish').disabled,false);
// Failure does not clear queued media, and repeated attempts never stack UI listeners.
run("pendingAssets['assets/retry.jpg']={base64:'YWJj',mime:'image/jpeg'}");fetchHook=async(url,opts)=>opts.method==='PUT'?{ok:false,json:async()=>({message:'Simulated failure'})}:{ok:true,status:200,json:async()=>url.endsWith('/user')?{login:'test-owner'}:url.includes('?ref=')?{sha:'existing'}:{full_name:'test-owner/test-repo',default_branch:'main',permissions:{push:true}}};
await document.getElementById('btnPublish').onclick();assert.equal(run('Object.keys(pendingAssets).length'),1);assert.match(document.getElementById('pubStatus').textContent,/Simulated failure/);assert.equal(document.getElementById('btnPublish').disabled,false);
assert.equal(storage.size,0,'No token saved without existing opt-in');
console.log('Admin editor integration passed: lossless load/navigation/import/export, unknown and legacy fields, precise edits, repeated expansion, project/gallery ordering and removal, category creation, site/About/Contact edits, sparse legacy sections, canceled/invalid import, mocked GitHub publish order/success/failure and unchanged opt-in token storage.');

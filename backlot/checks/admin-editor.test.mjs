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
let confirmAnswer=true,promptAnswer='',fetchHook=null,remoteContent=structuredClone(raw),remoteSha='existing-sha';
const fileResponse=()=>({sha:remoteSha,encoding:'base64',content:Buffer.from(JSON.stringify(remoteContent)).toString('base64')});
const context=vm.createContext({document,console,Blob,Uint8Array,TextDecoder,Date,JSON,Set,WeakSet,WeakMap,Promise,queueMicrotask,encodeURIComponent,unescape,atob,btoa,
  URL:{createObjectURL:blob=>{downloads.push(blob);return 'blob:test';},revokeObjectURL:()=>{}},
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
  window:{addEventListener:(type,fn)=>windowEvents.set(type,fn)},
  confirm:()=>confirmAnswer,prompt:()=>promptAnswer,alert:()=>{},
  fetch:async(url,options={})=>{
    if(fetchHook)return fetchHook(url,options);
    if(url==='content.json')return {ok:true,json:async()=>structuredClone(raw)};
    if(options.method==='PUT'){const payload=JSON.parse(options.body);puts.push({url,payload});if(url.endsWith('/content.json')){assert.equal(payload.sha,remoteSha);remoteContent=JSON.parse(Buffer.from(payload.content,'base64').toString('utf8'));remoteSha='saved-'+puts.length;}return {ok:true};}
    if(url.includes('/contents/content.json?')){assert.equal(options.cache,'no-store');return {ok:true,json:async()=>fileResponse()};}
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
run('boot(JSON.parse(JSON.stringify(fixture)))');remoteContent=structuredClone(fixture);run("pendingAssets['assets/qa.jpg']={base64:'YWJj',mime:'image/jpeg'}");input('#ghToken','test-token');input('#ghOwner','test-owner');input('#ghRepo','test-repo');
await document.getElementById('btnPublish').onclick();assert.equal(puts.length,2);assert.ok(puts[0].url.endsWith('/assets/qa.jpg'));assert.ok(puts[1].url.endsWith('/content.json'));assert.equal(puts[1].payload.branch,'main');assert.equal(puts[1].payload.sha,'existing-sha');
const published=JSON.parse(Buffer.from(puts[1].payload.content,'base64').toString('utf8'));assert.deepEqual({...published.site,updatedAt:undefined},{...fixture.site,updatedAt:undefined});assert.deepEqual(published.channels,fixture.channels);assert.deepEqual(published.future,fixture.future);assert.ok(published.site.updatedAt);assert.equal(run('hasDraftChanges()'),false);assert.equal(run('Object.keys(pendingAssets).length'),0);assert.equal(document.getElementById('btnPublish').disabled,false);
// Failure does not clear queued media, and repeated attempts never stack UI listeners.
run("pendingAssets['assets/retry.jpg']={base64:'YWJj',mime:'image/jpeg'}");fetchHook=async(url,opts)=>opts.method==='PUT'?{ok:false,json:async()=>({message:'Simulated failure'})}:{ok:true,status:200,json:async()=>url.endsWith('/user')?{login:'test-owner'}:url.includes('/contents/content.json?')?fileResponse():url.includes('?ref=')?{sha:'existing'}:{full_name:'test-owner/test-repo',default_branch:'main',permissions:{push:true}}};
await document.getElementById('btnPublish').onclick();assert.equal(run('Object.keys(pendingAssets).length'),1);assert.match(document.getElementById('pubStatus').textContent,/Simulated failure/);assert.equal(document.getElementById('btnPublish').disabled,false);
assert.equal(storage.size,0,'No token saved without existing opt-in');
// Repeated saves advance the baseline to exactly what was submitted.
fetchHook=null;run('pendingAssets={}');select('narrative');input('[data-f="p.0.title"]','A second save');
await document.getElementById('btnPublish').onclick();assert.equal(puts.length,3);assert.equal(remoteContent.channels.find(c=>c.id==='narrative').projects[0].title,'A second save');assert.equal(run('hasDraftChanges()'),false);
assert.deepEqual(JSON.parse(run('repositoryBaseline')),remoteContent);
// Equivalent JSON key ordering/formatting is not a content change.
remoteContent={channels:remoteContent.channels,future:remoteContent.future,site:remoteContent.site};
await document.getElementById('btnPublish').onclick();assert.equal(puts.length,4);assert.equal(run('hasDraftChanges()'),false);
// A prior concurrent update is caught before any media or content write.
remoteContent.channels.find(c=>c.id==='narrative').projects[0].title='Another editor changed this';remoteSha='another-editor-sha';
input('[data-f="p.0.title"]','My unpublished edit');run("pendingAssets['assets/keep.jpg']={base64:'YWJj',mime:'image/jpeg'}");
const conflictedDraft=state(),beforeConflictWrites=puts.length;
await document.getElementById('btnPublish').onclick();assert.equal(puts.length,beforeConflictWrites);assert.deepEqual(state(),conflictedDraft);assert.equal(run('Object.keys(pendingAssets).length'),1);assert.match(document.getElementById('pubStatus').textContent,/PUBLISH CONFLICT/);assert.doesNotMatch(document.getElementById('pubStatus').textContent,/TOKEN|token/i);
await document.getElementById('btnPublish').onclick();assert.equal(puts.length,beforeConflictWrites,'Repeated clicks cannot turn a known conflict into an overwrite');
// Importing does not adopt the imported draft as a repository baseline or merge it.
const baselineBeforeImport=run('repositoryBaseline');
await document.getElementById('jsonPicker').onchange({target:{files:[{text:async()=>JSON.stringify(fixture)}],value:'chosen'}});assert.equal(run('repositoryBaseline'),baselineBeforeImport);assert.match(document.getElementById('pubStatus').textContent,/rather than merges/);
await document.getElementById('btnPublish').onclick();assert.equal(puts.length,beforeConflictWrites);
// A race after preflight, while uploading media, is rejected using the held SHA.
run('boot(JSON.parse(JSON.stringify(fixture)));pendingAssets={};');remoteContent=structuredClone(fixture);remoteSha='before-race';run("pendingAssets['assets/race.jpg']={base64:'YWJj',mime:'image/jpeg'}");
let contentReads=0,raceContentWrites=0,diagnosticReads=0;
fetchHook=async(url,opts)=>{
  if(opts.method==='PUT'){
    if(url.endsWith('/content.json')){raceContentWrites++;assert.equal(JSON.parse(opts.body).sha,'before-race');return {ok:false,status:409,json:async()=>({message:'content.json does not match newer-sha'})};}
    remoteSha='newer-sha';remoteContent.site.heroName='Other editor';return {ok:true};
  }
  if(url.includes('/contents/content.json?')){contentReads++;return {ok:true,json:async()=>fileResponse()};}
  if(url.includes('/contents/assets/'))return {ok:true,json:async()=>({sha:'asset-before'})};
  diagnosticReads++;throw new Error('Conflict should not trigger token diagnostics');
};
const raceDraft=state();await document.getElementById('btnPublish').onclick();assert.equal(contentReads,1);assert.equal(raceContentWrites,1);assert.equal(diagnosticReads,0);assert.deepEqual(state(),raceDraft);assert.equal(run('Object.keys(pendingAssets).length'),1);assert.match(document.getElementById('pubStatus').textContent,/No automatic conflict retry/);assert.match(document.getElementById('pubStatus').textContent,/Some media may already have uploaded/);
// Editing during a pending request remains unpublished; double clicks do not start a second write.
run('boot(JSON.parse(JSON.stringify(fixture)));pendingAssets={};');remoteContent=structuredClone(fixture);remoteSha='before-edit';
let resolveWrite,inFlightWrites=0;
fetchHook=async(url,opts)=>{
  if(opts.method==='PUT'){inFlightWrites++;const payload=JSON.parse(opts.body);remoteContent=JSON.parse(Buffer.from(payload.content,'base64').toString('utf8'));remoteSha='after-edit';return new Promise(resolve=>{resolveWrite=resolve;});}
  return {ok:true,json:async()=>fileResponse()};
};
const inFlight=document.getElementById('btnPublish').onclick();await drain();assert.equal(typeof resolveWrite,'function');
await document.getElementById('btnPublish').onclick();assert.equal(inFlightWrites,1);
select('narrative');input('[data-f="p.0.title"]','Typed while publishing');run("pendingAssets['assets/newer.jpg']={base64:'ZGVm',mime:'image/jpeg'}");resolveWrite({ok:true});await inFlight;
assert.equal(run('hasDraftChanges()'),true);assert.equal(state().channels.find(c=>c.id==='narrative').projects[0].title,'Typed while publishing');assert.notEqual(remoteContent.channels.find(c=>c.id==='narrative').projects[0].title,'Typed while publishing');assert.equal(run('Object.keys(pendingAssets).length'),1);assert.deepEqual(JSON.parse(run('repositoryBaseline')),remoteContent);assert.match(document.getElementById('pubStatus').textContent,/Newer edits/);assert.equal(document.getElementById('btnPublish').disabled,false);
assert.equal(storage.size,0,'No credential persistence change');
// Import-only startup cannot silently claim an unknown baseline or discard a draft on close.
run('repositoryBaseline=null;pendingAssets={};boot(JSON.parse(JSON.stringify(fixture)),true)');
assert.equal(run('repositoryBaseline'),null);assert.equal(run('hasDraftChanges()'),true);
let unloadPrevented=false;const unloadEvent={preventDefault:()=>{unloadPrevented=true;}};windowEvents.get('beforeunload')(unloadEvent);assert.equal(unloadPrevented,true);assert.equal(unloadEvent.returnValue,'');
let unknownBaseWrites=0;fetchHook=async(url,opts)=>{if(opts.method==='PUT')unknownBaseWrites++;return {ok:true,json:async()=>fileResponse()};};
await document.getElementById('btnPublish').onclick();assert.equal(unknownBaseWrites,0);assert.match(document.getElementById('pubStatus').textContent,/no loaded repository baseline/);assert.deepEqual(state(),fixture);
console.log('Admin editor integration passed: lossless load/navigation/import/export, unknown and legacy fields, precise edits, repeated expansion, project/gallery ordering and removal, category creation, site/About/Contact edits, sparse legacy sections, canceled/invalid import, mocked GitHub publish order/success/failure and unchanged opt-in token storage.');
console.log('Publish concurrency passed: repeated saves, equivalent JSON, preflight conflict, no blind retry, imported baseline preservation, held SHA during media upload, in-flight draft/media preservation, and double-click guard.');

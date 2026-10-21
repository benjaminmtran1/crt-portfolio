import assert from 'node:assert/strict';
import {FieldNotebook,projectKey,resolveBookmark} from '../notebook.mjs';
const a={id:'narrative0',category:'narrative',title:'A Real Build',image:'assets/a.jpg'};
const b={id:'narrative1',category:'narrative',title:'Another Build',image:'assets/b.jpg'};
const notebook=new FieldNotebook('{broken');assert.equal(notebook.saved.length,0);
for(const raw of ['null','42','[]','{"saved":[null,{},1],"met":[null,"bogus"]}']){const n=new FieldNotebook(raw);assert.equal(n.saved.length,0);assert.equal(n.met.size,0);}
assert.equal(notebook.toggle(a,[a,b]),true);assert.ok(notebook.has(a,[a,b]));
notebook.met.add('scenic');const reload=new FieldNotebook(notebook.serialize());assert.ok(reload.has(a,[a,b]));assert.ok(reload.met.has('scenic'));
const reordered=[{...b,id:'narrative0'},{...a,id:'narrative1'}];assert.equal(resolveBookmark(reload.saved[0],reordered).title,a.title);
assert.equal(resolveBookmark(reload.saved[0],[b]),null,'A deleted build never opens its former index neighbour');
const renamed={...a,title:'The Renamed Build'};assert.equal(resolveBookmark(reload.saved[0],[b,renamed]),renamed);
assert.equal(resolveBookmark(reload.saved[0],[renamed,{...renamed,title:'Duplicate image'}]),null,'Ambiguous image matches are not guessed');
assert.notEqual(projectKey(a),projectKey({...a,category:'commercial'}));
assert.equal(reload.toggle(renamed,[b,renamed]),false);assert.equal(reload.saved.length,0);
reload.toggle(b,[a,b]);reload.remove(projectKey(b));assert.equal(reload.saved.length,0);
const duplicates=new FieldNotebook(JSON.stringify({saved:[...notebook.saved,...notebook.saved],met:['scenic','scenic','bad']}));assert.equal(duplicates.saved.length,1);assert.deepEqual([...duplicates.met],['scenic']);
console.log('Notebook passed: corrupt storage, save/remove, reload persistence, project reordering, deleted projects, rename recovery, ambiguous media and duplicate records.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {TitleScene} from '../title-scene.mjs';
import {titleBuilds, BUILD_CYCLE_MS as CYCLE, BUILD_HOLD_MS as HOLD, BUILD_FADE_MS as FADE} from '../title-builds.mjs';
const source = fs.readFileSync(new URL('../app.mjs', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').split("const panel=$('#panel')")[0];
const nodes = new Map();
const context = new Proxy({}, {get: (o, k) => k in o ? o[k] : () => {}, set: (o, k, v) => (o[k] = v, true)});
let document;
function element() {return {style: {}, attributes: {}, hidden: false, textContent: '', width: 900, height: 720, clientWidth: 900, clientHeight: 720, ownerDocument: document, getContext: () => context, setAttribute(k, v) {this.attributes[k] = v;}, getAttribute(k) {return this.attributes[k];}, click() {this.onclick?.();}};}
document = {createElement: () => element(), querySelector: s => {if (!nodes.has(s)) nodes.set(s, element()); return nodes.get(s);}};
const titleScene = vm.runInNewContext(`(()=>{${source};return titleScene;})()`, {document, World: class {}, Renderer: class {}, TitleScene});
const get = s => nodes.get(s);
function assertLabels(index) {
  const build = titleBuilds[index];
  assert.equal(titleScene.activeBuild, index);
  assert.equal(get('#title-set-name').textContent, build.title);
  assert.equal(get('#title-set-detail').textContent, build.detail);
  assert.equal(get('#title-set-description').textContent, build.description);
  assert.equal(get('#title-set-number').textContent, `ON STAGE / ${String(index + 1).padStart(2, '0')}`);
}
// Visit every title and both wraps through the actual app's button wiring.
assert.equal(titleBuilds.length, 9);
for (let i = 1; i <= titleBuilds.length; i++) {get('#title-set-next').click(); assertLabels(i % titleBuilds.length);}
for (let i = titleBuilds.length - 1; i >= 0; i--) {get('#title-set-prev').click(); assertLabels(i);}
get('#title-set-pause').click();
assert.equal(titleScene.paused, true); assert.equal(get('#title-set-pause').getAttribute('aria-pressed'), 'true');
assert.equal(get('#title-set-pause').getAttribute('aria-label'), 'Resume the set changes');
for (let i = 1; i <= titleBuilds.length; i++) {
  get('#title-set-next').click(); assertLabels(i % titleBuilds.length);
  assert.equal(titleScene.paused, true, 'Manual choice does not restart a paused set');
  titleScene.render(titleScene.lastTime + CYCLE * 2); assertLabels(i % titleBuilds.length);
}
get('#title-set-pause').click();
assert.equal(titleScene.paused, false); assert.equal(get('#title-set-pause').getAttribute('aria-pressed'), 'false');
assert.equal(get('#title-set-pause').getAttribute('aria-label'), 'Pause the set changes');
// New title metadata becomes current in darkness, not while the old set is lit.
titleScene.render(titleScene.lastTime + HOLD + FADE - 1); assertLabels(0);
titleScene.render(titleScene.lastTime + 1); assertLabels(1); assert.equal(titleScene.buildState.light, 0);
// Interrupting a blackout with an arrow restores a fully visible chosen build.
get('#title-set-next').click(); assertLabels(2); assert.equal(titleScene.buildState.light, 1);
titleScene.reduced = true;
assert.equal(get('#title-set-pause').hidden, true, 'Reduced motion has manual arrows, never autoplay');
for (let i = 0; i < titleBuilds.length; i++) {
  const next = (titleScene.activeBuild + 1) % titleBuilds.length;
  get('#title-set-next').click(); assertLabels(next);
  titleScene.render(titleScene.lastTime + CYCLE * 2); assertLabels(next); assert.equal(titleScene.buildState.light, 1);
}
titleScene.reduced = false; assert.equal(get('#title-set-pause').hidden, false);
console.log('Title showcase UI passed: all nine app-wired title/detail/description/number labels, complete forward/back wraps, accessible pause/resume, manual choices while paused, blackout metadata synchronization, blackout interruption and every reduced-motion still.');

// Actual DOM and app event wiring. Artwork/framing is checked in encounters.test.mjs;
// physical touch and browser layout remain separate visual checks.
// ADMIN_DOM_MODULE=/absolute/path/to/linkedom when not installed locally.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {World, stages, WIDTH, HEIGHT, distance, cameraStop} from '../world.mjs';
import {LotLife} from '../life.mjs';
import {BuildSequence, buildSteps, lightingLooks} from '../departments.mjs';
import * as contentAPI from '../content.mjs';
import * as encounterAPI from '../encounters.mjs';
import * as notebookAPI from '../notebook.mjs';
import {NotebookPageTurn} from '../notebook-motion.mjs';
import {createWrapCast} from '../wrap-motion.mjs';
const require = createRequire(import.meta.url), {parseHTML} = require(process.env.ADMIN_DOM_MODULE || 'linkedom');
const root = new URL('../../', import.meta.url), html = fs.readFileSync(new URL('index.html', root), 'utf8');
const raw = JSON.parse(fs.readFileSync(new URL('content.json', root), 'utf8'));
const source = fs.readFileSync(new URL('backlot/app.mjs', root), 'utf8').replace(/^import .*;\n/gm, '');
const expectedProjects = ['narrative-01', 'commercial-01', 'reality-01', 'commercial-02', 'narrative-06', 'installation-02', 'commercial-08', 'reality-02', 'commercial-10'];
const projects = contentAPI.normalizeContent(raw).projects;
async function boot(reduced) {
  const {document, Event} = parseHTML(html), get = s => document.querySelector(s), listeners = new Map(), storage = new Map(), drawn = [], writes = [], hashes = [];
  document.fonts = {ready: Promise.resolve()}; document.hidden = false; document.hasFocus = () => true;
  get('#panel').open = false; get('#panel').showModal = function () {this.open = true;};
  get('#panel').close = function () {this.open = false; this.dispatchEvent(new Event('close'));};
  const proto = Object.getPrototypeOf(document.createElement('div'));
  proto.focus = function () {document.activeElement = this;};
  proto.getBoundingClientRect = () => ({left: 0, top: 0, right: 900, bottom: 720, width: 900, height: 720});
  proto.pause = proto.load = proto.scrollIntoView = function () {};
  document.activeElement = document.body;
  const renderer = new Proxy({camera: {}, screenToWorld: (x, y) => ({x, y})}, {get: (o, k) => k in o ? o[k] : () => {}});
  const env = {
    document, window: {addEventListener: (k, fn) => listeners.set(k, fn)},
    getComputedStyle: () => ({flexDirection: 'column', gap: '0'}), matchMedia: q => ({matches: q.includes('reduced-motion') ? reduced : false}),
    localStorage: {getItem: k => storage.get(k) || null, setItem(k, v) {storage.set(k, v); writes.push(k);}},
    location: {hash: '', pathname: '/', search: ''}, history: {replaceState(_state, _unused, hash) {hashes.push(hash);}},
    ResizeObserver: class {observe() {}}, requestAnimationFrame() {}, setTimeout() {}, clearTimeout() {},
    fetch: async () => ({ok: true, json: async () => structuredClone(raw)}), console, URLSearchParams,
    World, stages, WIDTH, HEIGHT, distance, LotLife, BuildSequence, buildSteps, lightingLooks,
    ...contentAPI, ...encounterAPI, ...notebookAPI, NotebookPageTurn, createWrapCast,
    drawViewfinder(canvas, index, wide) {drawn.push({canvas, index, wide});},
    Renderer: class {constructor() {return renderer;}}, TitleScene: class {resize() {} render() {}}
  };
  const app = await vm.runInNewContext(`(async()=>{${source}\nreturn {dismissIntro,openCamera,openIndex,closePanel,life,world,settings};})()`, env);
  app.dismissIntro();
  return {app, get, document, drawn, storage, writes, hashes,
    click(selector) {const element = get(selector); assert.ok(element, selector); element.dispatchEvent(new Event('click', {bubbles: true}));},
    key(key) {listeners.get('keydown')({key, repeat: false, target: get('#world'), preventDefault() {}}); listeners.get('keyup')({key});}
  };
}
function assertCamera(t, index, wide) {
  const {app, get, document, drawn} = t, build = encounterAPI.cameraBuilds[index];
  assert.equal(get('#panel').open, true); assert.equal(get('#panel').dataset.kind, 'camera'); assert.equal(app.world.paused, true);
  assert.equal(get('#panel-title').textContent, build.title);
  assert.equal(get('#camera-view').getAttribute('role'), 'img');
  assert.equal(get('#camera-view').getAttribute('aria-label'), build.description);
  const choices = [...document.querySelectorAll('[data-camera]')];
  assert.equal(choices.length, 9); assert.deepEqual(choices.map(b => b.textContent), encounterAPI.cameraBuilds.map(b => b.detail));
  assert.deepEqual(choices.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => Number(b.dataset.camera)), [index]);
  assert.equal(get('[data-camera-wide]').getAttribute('aria-pressed'), String(wide));
  assert.equal(get('[data-camera-wide]').textContent, wide ? 'FRAME THE SHOT' : 'PULL BACK / SEE THE LIGHTS');
  assert.equal(get('#panel-inner [data-project]').dataset.project, expectedProjects[index]);
  assert.equal(drawn.at(-1).canvas, get('#camera-view')); assert.equal(drawn.at(-1).index, index); assert.equal(drawn.at(-1).wide, wide);
}
for (const reduced of [false, true]) {
  const t = await boot(reduced), {app, get} = t;
  Object.assign(app.world.player, cameraStop); t.click('#touch-action'); assertCamera(t, 0, false);
  assert.ok(app.life.found.has('camera')); assert.deepEqual(JSON.parse(t.storage.get('backlot-crew-v1')), ['camera']);
  for (const index of [0, 4, 5, 6, 7, 8, 3, 2, 1, 8, 4, 0]) {
    t.click(`[data-camera="${index}"]`); assertCamera(t, index, false);
    t.click(`[data-camera="${index}"]`); assertCamera(t, index, false);
    for (const wide of [true, false]) {
      t.click('[data-camera-wide]'); assertCamera(t, index, wide);
      t.click('#panel-inner [data-project]');
      const project = projects.find(p => p.id === expectedProjects[index]);
      assert.equal(get('#panel-title').textContent, project.title, 'Explore opens the actual current portfolio project');
      assert.equal(get('[data-save-project]').dataset.saveProject, project.id);
      assert.equal(t.hashes.at(-1), `#project=${project.id}`, 'The project keeps its existing deep link');
      assert.equal(t.document.querySelectorAll('[data-photo]').length, contentAPI.galleryFor(project).length, 'Existing project media is preserved');
      t.click('[data-close]'); assert.equal(get('#panel').open, false); assert.equal(app.world.paused, false);
      assert.equal(t.document.activeElement, get('#world'));
      t.key('e'); assertCamera(t, index, wide);
    }
  }
  assert.equal(t.writes.filter(key => key === 'backlot-crew-v1').length, 1, 'Repeated camera/project visits never duplicate the discovery');
  app.openIndex(); assert.equal(get('#camera-view'), null, 'Index navigation removes the camera panel');
  app.closePanel(); t.click('#touch-action'); assertCamera(t, 0, false);
  // LinkeDOM has no browser-native Escape default; exercise the same dialog close lifecycle.
  get('#panel').close(); assert.equal(get('#panel').open, false); assert.equal(app.world.paused, false);
  assert.equal(app.settings.reduced, reduced);
}
console.log('Camera DOM passed: all nine real controls, repeated/nonsequential selection, both framings, accessible metadata, actual project/gallery/deep-link navigation, close/reopen and index interruption, touch-action/keyboard entry, native-dialog close lifecycle, single saved discovery, and reduced-motion parity. Browser layout remains a separate check.');

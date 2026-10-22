import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { TitleScene } from '../title-scene.mjs';
import { titleBuilds, paintTitleBuild, showcaseAt, BUILD_HOLD_MS as HOLD, BUILD_FADE_MS as FADE, BUILD_DARK_MS as DARK, BUILD_CYCLE_MS as CYCLE } from '../title-builds.mjs';

const expectedIds = ['deathstalker', 'donkey-kong', 'beast-games', 'cupra', 'internet', 'raptors', 'wicked', 'yes-chef', 'ihop'];
const titleTerms = [/DEATHSTALKER/, /DONKEY KONG/, /BEAST GAMES/, /CUPRA/, /INTERNET/, /RAPTORS/, /WICKED/, /YES,? CHEF/, /IHOP/];
assert.deepEqual(titleBuilds.map(b => b.id), expectedIds);
assert.equal(new Set(titleBuilds.map(b => b.title)).size, 9, 'All nine builds have distinct titles');
assert.ok(Object.isFrozen(titleBuilds));
for (const [i, build] of titleBuilds.entries()) {
  assert.ok(Object.isFrozen(build));
  assert.match(build.title, titleTerms[i]);
  for (const field of ['title', 'detail', 'description']) assert.ok(build[field]?.trim(), `${build.id} has a useful ${field}`);
  assert.match(build.accent, /^#[a-f\d]{6}$/i);
  const start = i * CYCLE, next = (i + 1) % titleBuilds.length;
  assert.deepEqual(showcaseAt(start), {index: i, light: 1, phase: 'hold'});
  assert.deepEqual(showcaseAt(start + HOLD - 1), {index: i, light: 1, phase: 'hold'}, 'Every build holds fully lit for 8.5 seconds');
  const fading = showcaseAt(start + HOLD + FADE / 2);
  assert.equal(fading.index, i); assert.equal(fading.phase, 'out'); assert.ok(fading.light > 0 && fading.light < 1);
  assert.deepEqual(showcaseAt(start + HOLD + FADE), {index: next, light: 0, phase: 'dark'}, 'Index switches only once the old set is fully dark');
  assert.deepEqual(showcaseAt(start + HOLD + FADE + DARK - 1), {index: next, light: 0, phase: 'dark'}, 'Full blackout interval');
  assert.deepEqual(showcaseAt(start + HOLD + FADE + DARK), {index: next, light: 0, phase: 'in'});
  const relighting = showcaseAt(start + HOLD + FADE + DARK + FADE / 2);
  assert.equal(relighting.index, next); assert.equal(relighting.phase, 'in'); assert.ok(relighting.light > 0 && relighting.light < 1);
  assert.deepEqual(showcaseAt(start + CYCLE), {index: next, light: 1, phase: 'hold'});
}
assert.equal(showcaseAt(CYCLE * titleBuilds.length).index, 0);
assert.equal(showcaseAt(-1).index, 0); assert.equal(showcaseAt(NaN).index, 0);
assert.equal(showcaseAt(1e6, -1).index, titleBuilds.length - 1, 'Manual index wraps backward');
assert.equal(showcaseAt(1e6, titleBuilds.length * 2).index, 0, 'Manual index wraps forward');
for (let time = 0; time < CYCLE * titleBuilds.length; time += 17) {
  const state = showcaseAt(time);
  assert.ok(state.light >= 0 && state.light <= 1); assert.ok(Number.isInteger(state.index));
  assert.ok(state.index >= 0 && state.index < titleBuilds.length);
}

function canvas(w, h) {
  const calls = [], c = {calls, operationCount: 0, globalAlpha: 1, fillStyle: '', imageSmoothingEnabled: true};
  for (const name of ['fillRect', 'moveTo', 'lineTo', 'drawImage', 'clearRect', 'beginPath', 'closePath', 'fill']) c[name] = (...args) => {
    c.operationCount++;
    for (const n of args.filter(v => typeof v === 'number')) assert.ok(Number.isFinite(n), `Finite ${name} coordinate`);
    if (name === 'drawImage') calls.push({image: args[0], alpha: c.globalAlpha, args});
  };
  return {width: w, height: h, clientWidth: w, clientHeight: h, style: {}, ownerDocument: {createElement: () => canvas(1, 1)}, getContext: () => c};
}
const frameTimes = new Set([0, CYCLE * titleBuilds.length]);
for (let t = 0; t < CYCLE * titleBuilds.length; t += 251) frameTimes.add(t);
for (let i = 0; i < titleBuilds.length; i++) for (const offset of [HOLD - 1, HOLD, HOLD + FADE / 2, HOLD + FADE - 1, HOLD + FADE, HOLD + FADE + DARK - 1, HOLD + FADE + DARK, CYCLE - 1]) frameTimes.add(i * CYCLE + offset);
for (const [w, h] of [[1440, 900], [1366, 768], [390, 844], [360, 667], [844, 390], [320, 568]]) {
  const cv = canvas(w, h), scene = new TitleScene(cv), ctx = cv.getContext('2d'), seen = new Set();
  const plateCounts = scene.buildPlates.map(plate => plate.getContext('2d').operationCount);
  assert.equal(scene.buildPlates.length, 9, 'All nine scenic plates are cached');
  assert.ok(plateCounts.every(count => count > 1), 'Every cached plate contains drawing operations');
  for (const t of [...frameTimes].sort((a, b) => a - b)) {
    ctx.calls.length = 0; scene.render(t);
    const sets = ctx.calls.filter(call => scene.buildPlates.includes(call.image));
    assert.ok(sets.length <= 1, 'Never draw two sets in one frame, including fade/blackout boundaries');
    if (scene.buildState.light > 0) {
      assert.equal(sets.length, 1); assert.equal(sets[0].image, scene.buildPlates[scene.activeBuild]);
      assert.equal(sets[0].alpha, scene.buildState.light); seen.add(scene.activeBuild);
    } else assert.equal(sets.length, 0, 'Blackout is empty, not an invisible second plate');
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), titleBuilds.map((_, i) => i));
  assert.equal(scene.activeBuild, 0, 'The ninth build loops back to Deathstalker');
  const anchor = scene.buildGround;
  assert.ok(anchor.y > scene.floor + scene.h * .06, 'Scenic bases sit downstage on the visible floor, never at the backdrop seam');
  const placements = [];
  scene.reduced = true;
  for (let build = 0; build < titleBuilds.length; build++) {
    scene.activeBuild = build; scene.render(scene.lastTime); placements.push(scene.buildGround);
    const ground = scene.buildGround;
    assert.ok(ground.scale > 0 && ground.scale <= ground.baseScale, `${titleBuilds[build].id} has a positive stage fit`);
    assert.ok(ground.left >= 0 && ground.left + ground.width <= scene.w, `${titleBuilds[build].id} stays inside the viewport`);
    assert.ok(ground.top >= 0, `${titleBuilds[build].id} stays below the top edge`);
    assert.ok(ground.y > scene.floor, `${titleBuilds[build].id} is grounded on the stage floor`);
    assert.ok(ground.top + 174 * ground.scale <= ground.captionTop, `${titleBuilds[build].id} clears the unchanged selector`);
    const frozen = scene.showcaseTime; scene.render(scene.lastTime + 1e5);
    assert.equal(scene.showcaseTime, frozen); assert.equal(scene.activeBuild, build); assert.equal(scene.buildState.light, 1);
  }
  assert.equal(placements[0].y, placements[1].y, 'Both approved front-facing builds retain their original anchor');
  assert.equal(placements[0].scale, placements[0].baseScale); assert.equal(placements[1].scale, placements[1].baseScale);
  assert.equal(placements[3].y, placements[0].y, 'Cupra shares the stage floor anchor');
  const beast = placements[2];
  assert.ok(beast.scale < beast.baseScale, 'Deep isometric box gets its own fit, not a global layout change');
  assert.ok(beast.footprint[0][1] > scene.floor && beast.footprint[2][1] > scene.floor, 'Both visible side feet sit on the floor, not on the cyc');
  assert.ok(beast.y <= beast.captionTop - 2, 'Nearest corner clears the unchanged selector');
  assert.equal(beast.footprint[3][1], beast.top + 174 * beast.scale, 'Near-corner anchor and footprint use the same projection');
  scene.reduced = false;
  const time = scene.showcaseTime, index = scene.activeBuild;
  scene.resize(w, h); assert.equal(scene.showcaseTime, time, 'Resize preserves scene clock'); assert.equal(scene.activeBuild, index);
  scene.reduced = true;
  for (const direction of [1, -1]) for (let step = 0; step < titleBuilds.length; step++) {
    const previous = scene.activeBuild; scene.stepBuild(direction);
    assert.equal(scene.activeBuild, (previous + direction + titleBuilds.length) % titleBuilds.length);
    assert.equal(scene.buildState.light, 1); assert.equal(scene.reduced, true);
  }
  scene.reduced = false; scene.toggleBuilds();
  for (let step = 0; step < titleBuilds.length; step++) {
    const previous = scene.activeBuild; scene.stepBuild(1);
    assert.equal(scene.activeBuild, (previous + 1) % titleBuilds.length); assert.equal(scene.paused, true, 'Manual selection never restarts a paused rotation');
    const paused = scene.showcaseTime; scene.render(scene.lastTime + 1e5);
    assert.equal(scene.showcaseTime, paused); assert.equal(scene.buildState.light, 1);
  }
  const paused = scene.showcaseTime; scene.toggleBuilds(); scene.render(scene.lastTime + 500);
  assert.equal(scene.showcaseTime, paused + 500);
  let report; scene.onBuildChange = b => {report = b;}; scene.stepBuild(1);
  assert.equal(report.index, scene.activeBuild); assert.equal(report.title, titleBuilds[report.index].title);
  assert.deepEqual(scene.buildPlates.map(plate => plate.getContext('2d').operationCount), plateCounts, 'Rotation, resize and controls reuse all cached plates');
}
// Five new builds must not alter any of the four approved scenic plates.
const plateHashes = ['5a9d25083cea66b68cca1e75e20e88d8f0bd4be861b5f126320c91cad94d03a6', 'afaf663ba0d170b3f261b1b7efd5c024811f3f066ead853c92630734bf5fbd0d', 'fab56eac5bafc2d04aa1d8e1efbcf2702113f71332380a0c09f2b5e6ac9d36ee', 'af3f10dce97ff603738b96180f65f9c4d4a50f3424bf32ec2d995a4b9d493fff'];
function plateHash(index) {
  const ops = [], c = {};
  for (const k of ['clearRect', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fill']) c[k] = (...v) => ops.push([k, c.fillStyle, ...v]);
  paintTitleBuild(c, index);
  assert.deepEqual(ops[0], ['clearRect', undefined, 0, 0, 360, 180], 'Each build starts with a clean native-size plate');
  return createHash('sha256').update(JSON.stringify(ops)).digest('hex');
}
const hashes = titleBuilds.map((_, i) => plateHash(i));
assert.equal(new Set(hashes).size, 9, 'Every title has its own distinct artwork, never a fallback or repeated existing build');
for (let i = 0; i < titleBuilds.length; i++) assert.equal(plateHash(i), hashes[i], 'All nine scenic plates are deterministic');
for (let i = 0; i < plateHashes.length; i++) assert.equal(hashes[i], plateHashes[i], 'Approved existing art stays byte-for-byte equivalent');
assert.equal(plateHash(-1), hashes.at(-1)); assert.equal(plateHash(titleBuilds.length), hashes[0]);
const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
for (const id of ['title-set-prev', 'title-set-next', 'title-set-pause', 'start-button', 'title-work']) assert.ok(html.includes(`id="${id}"`));
assert.ok(!html.includes('aria-live="assertive"'), 'Decorative rotation must not repeatedly interrupt screen readers');
console.log('Title showcase passed: all 9 real builds, four unchanged original drawing hashes, distinct deterministic cached plates, 8.5-second holds, exact blackout boundaries, one rendered set, 6 viewport sizes, finite drawing, stage/caption fit, full wrap/manual/pause/reduced-motion cycles, resize continuity and callbacks. Browser layout remains a separate check.');

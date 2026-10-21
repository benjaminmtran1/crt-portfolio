/**
 * An original, front-facing soundstage for the title, not a view of the game map.
 * All scenery is drawn locally and cached at one native pixel per two CSS pixels.
 * render() takes a requestAnimationFrame timestamp in milliseconds.
 */
const P = Object.freeze({
  ink: '#071B26', petrol: '#102B37', deep: '#0C2431', steel: '#224956',
  teal: '#28616A', cyan: '#35D6C5', pale: '#86E4D1', apricot: '#FFD39A',
  wood: '#B5856A', coral: '#FF657A', red: '#B93F65', cobalt: '#386BFF',
  blue: '#25489D', lilac: '#9D94EA', cream: '#FFE9C6'
});
const q = Math.round;
const rect = (c, x, y, w, h, color) => {
  c.fillStyle = color;
  c.fillRect(q(x), q(y), Math.max(1, q(w)), Math.max(1, q(h)));
};
const poly = (c, points, color) => {
  c.fillStyle = color;
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(q(x), q(y)) : c.moveTo(q(x), q(y)));
  c.closePath();
  c.fill();
};
// Pixel-perfect lines keep the structural drawing crisp, including on phones.
const line = (c, x0, y0, x1, y1, color, weight = 1) => {
  x0 = q(x0); y0 = q(y0); x1 = q(x1); y1 = q(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  c.fillStyle = color;
  for (;;) {
    c.fillRect(x0, y0, weight, weight);
    if (x0 === x1 && y0 === y1) break;
    const e = error * 2;
    if (e >= dy) { error += dy; x0 += sx; }
    if (e <= dx) { error += dx; y0 += sy; }
  }
};
const ellipse = (c, x, y, rx, ry, color) => {
  c.fillStyle = color;
  rx = Math.max(1, q(rx)); ry = Math.max(1, q(ry));
  for (let yy = -ry; yy <= ry; yy++) {
    const half = q(rx * Math.sqrt(1 - yy * yy / (ry * ry)));
    c.fillRect(q(x) - half, q(y) + yy, half * 2 + 1, 1);
  }
};
const seeded = seed => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
  return (seed >>> 0) / 4294967296;
};

export class TitleScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.c = canvas.getContext('2d', { alpha: false });
    this.reduced = false;
    this.canvas.style.imageRendering = 'pixelated';
    this.resize(canvas.clientWidth || 960, canvas.clientHeight || 640);
  }

  resize(width, height) {
    this.w = Math.max(1, q((Number(width) || 1) / 2));
    this.h = Math.max(1, q((Number(height) || 1) / 2));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.c.imageSmoothingEnabled = false;
    this.portrait = this.w / this.h < 1.1;
    // Props remain legible, but narrower layouts get smaller, recomposed wings.
    this.unit = Math.max(.68, Math.min(1.3, this.w / 620));
    this.floor = q(this.h * (this.portrait ? .755 : .73));
    this.rig = q(Math.min(this.h * .105, 39));
    const make = () => {
      const layer = this.canvas.ownerDocument.createElement('canvas');
      layer.width = this.w; layer.height = this.h;
      layer.getContext('2d').imageSmoothingEnabled = false;
      return layer;
    };
    this.back = make();
    this.wings = make();
    this.front = make();
    this.paintBackdrop(this.back.getContext('2d'));
    this.paintWings(this.wings.getContext('2d'));
    this.paintForeground(this.front.getContext('2d'));
    this.render(0);
  }

  paintBackdrop(c) {
    const { w, h, floor } = this;
    rect(c, 0, 0, w, h, P.petrol);
    // A broad cyclorama, not a vignetted screenshot. The center stays quiet.
    rect(c, 0, this.rig + 8, w, floor - this.rig, '#12323F');
    rect(c, w * .12, this.rig + 13, w * .76, floor - this.rig, '#123440');
    rect(c, w * .25, this.rig + 17, w * .5, floor - this.rig, '#143743');
    const r = seeded(47);
    for (let i = 0; i < w * h / 90; i++) {
      const x = q(r() * w), y = this.rig + 12 + q(r() * (floor - this.rig - 10));
      rect(c, x, y, 1, 1, i % 3 ? '#163844' : '#193D47');
    }
    // The rear wall and floor meet in a blue, receding stage lip.
    rect(c, 0, floor - 13, w, 13, '#183D49');
    rect(c, 0, floor - 8, w, 1, '#285563');
    rect(c, 0, floor - 3, w, 2, '#317D87');
    rect(c, 0, floor - 1, w, 2, P.cyan);
    poly(c, [[0, floor + 1], [w, floor + 1], [w, h], [0, h]], '#203E49');
    // Timber-plank perspective converges beyond the back of the stage.
    const vanish = w * .52;
    for (let i = -6; i < 16; i++) {
      const x = i * w / 9;
      const topX = vanish + (x - vanish) * .3;
      poly(c, [[topX, floor + 2], [topX + w / 29, floor + 2], [x + w / 9, h], [x, h]], i % 2 ? '#234550' : '#264B55');
      line(c, topX, floor + 2, x, h, '#183641');
      if (i % 3 === 0) line(c, topX + 2, floor + 3, x + 3, h, '#315360');
    }
    for (let i = 1; i < 6; i++) {
      const y = floor + (h - floor) * (i / 6) ** 1.65;
      line(c, 0, y, w, y, '#193844');
      line(c, 0, y + 1, w, y + 1, '#36525B');
      for (let j = 0; j < 7; j++) {
        const x = (j + (i % 2) * .5) * w / 6;
        rect(c, x, y - 1, 1, 1, '#71847D');
      }
    }
    // Broken brush strokes: deliberately sparse, not a per-frame noise effect.
    for (let i = 0; i < w / 2; i++) {
      const y = floor + 7 + r() * Math.max(1, h - floor - 7);
      rect(c, r() * w, y, 2 + r() * 7, 1, i % 2 ? '#355662' : '#1D3C47');
    }
    // A film-set spike mark quietly points toward the central entrance.
    const mx = q(w * .5), my = q(floor + (h - floor) * .57);
    line(c, mx - 5, my - 2, mx + 5, my + 2, P.apricot, 2);
    line(c, mx - 5, my + 2, mx + 5, my - 2, P.apricot, 2);
    // Dark foreground lip sells the whole image as a physical stage.
    rect(c, 0, h - 9, w, 9, P.ink);
    rect(c, 0, h - 10, w, 1, '#428B91');
    for (let x = 12; x < w; x += 27) rect(c, x, h - 5, 4, 1, '#28505D');
  }

  scaffold(c, x, top, width, bottom, accent) {
    rect(c, x, top, 3, bottom - top, P.ink);
    rect(c, x + width, top, 3, bottom - top, P.ink);
    line(c, x + 1, top, x + 1, bottom, '#3B6571');
    line(c, x + width + 1, top, x + width + 1, bottom, '#4D7A80');
    for (let y = top + 8; y < bottom - 8; y += 26) {
      line(c, x + 2, y, x + width, y + 23, '#315764');
      line(c, x + width, y, x + 2, y + 23, '#315764');
      rect(c, x - 2, y - 2, width + 7, 3, P.ink);
      line(c, x - 1, y - 2, x + width + 3, y - 2, '#51747A');
    }
    rect(c, x - 3, top, width + 9, 4, P.steel);
    rect(c, x - 1, top, width + 5, 1, accent);
    rect(c, x - 4, bottom, 11, 4, P.ink);
    rect(c, x + width - 3, bottom, 11, 4, P.ink);
  }

  paintWings(c) {
    const { w, h, floor, unit: u, rig, portrait } = this;
    const edge = Math.min(w * (portrait ? .135 : .16), 110 * u);
    // Out-of-focus rear ribs stay behind the brighter scenic flats.
    for (const side of [0, 1]) {
      const x = side ? w - edge * .7 : edge * .7;
      rect(c, x, rig, 3, floor - rig, '#0F2A36');
      rect(c, x + 4, rig, 1, floor - rig, '#244855');
    }
    // Left: an unfinished cobalt flat, with a visible timber rear and bracing.
    const lx = -8, ly = q(h * (portrait ? .56 : .39));
    const lw = edge * .88, lh = floor - ly + 8;
    poly(c, [[lx, ly + 12], [lx + lw, ly], [lx + lw + 9, floor + 10], [lx, floor + 16]], P.ink);
    poly(c, [[lx, ly + 7], [lx + lw - 4, ly], [lx + lw + 1, floor + 4], [lx, floor + 8]], P.cobalt);
    line(c, lx + lw - 5, ly + 1, lx + lw, floor + 4, '#7799FF', 2);
    line(c, lx + lw + 3, ly + 3, lx + lw + 8, floor + 10, P.apricot, 2);
    for (let y = ly + 15; y < floor; y += 28) {
      line(c, lx, y + 5, lx + lw - 3, y, P.blue);
      rect(c, lx + lw - 9, y - 1, 2, 2, P.apricot);
    }
    poly(c, [[lx + lw - 5, floor - 24], [lx + lw + 24 * u, floor + 14], [lx + lw + 28 * u, floor + 14], [lx + lw - 3, floor - 26]], P.wood);
    line(c, lx + lw - 4, floor - 26, lx + lw + 27 * u, floor + 13, P.apricot);
    // Thin coral scenic arch on the right, cropped like a working set wall.
    const rw = edge * .87, rx = w - rw + 4, ry = q(h * (portrait ? .5 : .35));
    poly(c, [[rx - 3, ry + 5], [w, ry - 2], [w, floor + 18], [rx - 7, floor + 9]], P.red);
    poly(c, [[rx, ry + 3], [w, ry], [w, floor + 9], [rx - 3, floor + 4]], P.coral);
    rect(c, rx + 3, ry + 4, rw, 2, P.apricot);
    const archX = rx + rw * .38, archW = Math.max(9, rw * .62), archY = ry + 22;
    poly(c, [[archX, floor + 4], [archX, archY + 10], [archX + 3, archY + 10], [archX + 3, archY + 5], [archX + 8, archY + 5], [archX + 8, archY + 2], [archX + archW, archY + 2], [archX + archW, floor + 8]], P.ink);
    line(c, archX - 1, archY + 11, archX - 1, floor + 3, '#FFAA91', 2);
    line(c, rx + 3, floor - 11, w, floor - 6, '#D64569', 2);
    // Scaffolding is confined to the outside wings, never behind the name.
    this.scaffold(c, -5, rig + 14, Math.max(12, edge * .47), floor + 14, P.cyan);
    this.scaffold(c, w - edge * .37, rig + 15, Math.max(12, edge * .36), floor + 16, P.coral);
    // Cropped front hanging drapes are cut in long pixel folds, not a border.
    poly(c, [[0, 0], [edge * .51, 0], [edge * .49, rig + 38], [edge * .35, rig + 56], [edge * .15, rig + 68], [0, rig + 72]], P.blue);
    poly(c, [[0, 0], [edge * .31, 0], [edge * .29, rig + 40], [edge * .16, rig + 57], [0, rig + 61]], '#315CE1');
    rect(c, edge * .18, 0, 2, rig + 37, '#5B86FF');
    poly(c, [[w, 0], [w - edge * .4, 0], [w - edge * .35, rig + 35], [w - edge * .18, rig + 55], [w, rig + 62]], '#8D3C65');
    poly(c, [[w, 0], [w - edge * .2, 0], [w - edge * .17, rig + 43], [w, rig + 55]], P.red);
    // Cross-stage catwalk. Its thin profile preserves the open title area.
    rect(c, 0, rig - 4, w, 10, P.ink);
    line(c, 0, rig - 4, w, rig - 4, '#42636D');
    line(c, 0, rig + 5, w, rig + 5, '#315E69');
    for (let x = 0; x < w; x += 26) {
      line(c, x, rig - 2, x + 13, rig + 3, '#315260');
      line(c, x + 13, rig + 3, x + 26, rig - 2, '#315260');
    }
    for (const [f, color] of [[.15, P.cyan], [.31, P.apricot], [.68, P.apricot], [.85, P.coral]]) {
      const x = q(w * f);
      rect(c, x, 0, 1, rig - 4, '#38525C');
      rect(c, x - 3, rig + 6, 6, 4, '#49616B');
      rect(c, x - 7, rig + 9, 14, 8, P.ink);
      rect(c, x - 5, rig + 11, 10, 5, '#1E3949');
      rect(c, x - 4, rig + 16, 8, 2, color);
      rect(c, x - 8, rig + 11, 2, 7, P.ink);
      rect(c, x + 6, rig + 11, 2, 7, P.ink);
    }
    // Festoon cable behind the central lettering, entirely above its safe area.
    let px = w * .2, py = rig - 9;
    for (let i = 1; i <= 32; i++) {
      const x = w * (.2 + .6 * i / 32), y = rig - 9 + Math.sin(i / 32 * Math.PI) * 5;
      line(c, px, py, x, y, '#071A25'); px = x; py = y;
    }
    for (let i = 1; i < 9; i++) {
      const x = w * (.2 + .6 * i / 9), y = rig - 9 + Math.sin(i / 9 * Math.PI) * 5;
      rect(c, x, y + 1, 1, 3, '#456267');
      rect(c, x - 1, y + 4, 3, 2, i % 3 ? P.apricot : P.cyan);
    }
  }

  roadCase(c, x, y, w, h, color) {
    rect(c, x + 2, y + h + 2, w, 3, P.ink);
    rect(c, x, y, w, h, P.ink);
    rect(c, x + 2, y + 2, w - 4, h - 4, color);
    line(c, x + 1, y + 1, x + w - 2, y + 1, '#66969C');
    line(c, x + 1, y + h - 2, x + w - 2, y + h - 2, '#66969C');
    for (const xx of [x + 1, x + w - 3]) {
      rect(c, xx, y, 2, 4, '#A4B4A1');
      rect(c, xx, y + h - 4, 2, 4, '#A4B4A1');
      rect(c, xx, y + h, 3, 4, P.ink);
    }
    rect(c, x + w * .45, y + h * .48, w * .2, 2, '#0B2430');
    rect(c, x + w * .2, y + 4, 4, 3, P.apricot);
  }

  camera(c, x, y, u) {
    const s = (a, b, ww, hh, color) => rect(c, x + a * u, y + b * u, ww * u, hh * u, color);
    ellipse(c, x + 1, y + 9 * u, 29 * u, 4 * u, '#0B2530');
    line(c, x, y - 22 * u, x - 19 * u, y + 8 * u, '#75958E', 3);
    line(c, x, y - 22 * u, x + 20 * u, y + 8 * u, '#4C737A', 3);
    line(c, x + 1, y - 22 * u, x + 1, y + 12 * u, P.ink, 3);
    line(c, x - 11 * u, y - 3 * u, x + 12 * u, y - 3 * u, P.ink, 2);
    s(-15, -41, 32, 20, P.ink);
    s(-12, -38, 25, 14, '#315362');
    s(-11, -38, 22, 2, '#789B9A');
    s(-8, -34, 14, 7, P.petrol);
    s(-7, -33, 9, 5, P.cobalt);
    s(16, -38, 8, 14, '#456875');
    s(22, -40, 7, 18, P.ink);
    s(23, -37, 2, 12, P.cyan);
    s(-12, -47, 10, 6, P.ink);
    s(1, -47, 10, 6, P.ink);
    s(-10, -46, 6, 2, '#49616B');
    s(3, -46, 6, 2, '#49616B');
    s(-21, -36, 6, 4, P.ink);
    s(-11, -24, 3, 2, P.coral);
    line(c, x + 4 * u, y - 21 * u, x + 25 * u, y - 16 * u, P.ink, 2);
  }

  directorChair(c, x, y, u) {
    ellipse(c, x, y + 7 * u, 24 * u, 4 * u, '#0A2430');
    line(c, x - 13 * u, y - 8 * u, x + 15 * u, y + 9 * u, P.wood, 3);
    line(c, x + 13 * u, y - 8 * u, x - 15 * u, y + 9 * u, P.apricot, 3);
    for (const d of [-1, 1]) {
      line(c, x + d * 13 * u, y - 31 * u, x + d * 13 * u, y - 3 * u, P.apricot, 2);
      rect(c, x + d * 13 * u - 4 * u, y - 17 * u, 9 * u, 3 * u, P.wood);
    }
    rect(c, x - 12 * u, y - 31 * u, 25 * u, 12 * u, P.coral);
    rect(c, x - 10 * u, y - 29 * u, 21 * u, 2 * u, '#FFB6A0');
    rect(c, x - 13 * u, y - 8 * u, 27 * u, 4 * u, P.coral);
    rect(c, x - 4 * u, y - 25 * u, 9 * u, 2 * u, P.ink);
  }

  paintForeground(c) {
    const { w, h, floor, unit: u, portrait } = this;
    const y = h - 21;
    // Coiled cables lie low in the foreground, leaving the stage entrance free.
    for (let i = 0; i < 3; i++) {
      ellipse(c, w * .18, y - 4 + i, 24 * u - i * 4, 4, P.ink);
      ellipse(c, w * .18, y - 5 + i, 21 * u - i * 4, 2, '#264B55');
    }
    line(c, 0, y + 2, w * .19, y + 2, P.ink, 2);
    line(c, w * .19, y + 2, w * .26, y - 9, P.ink, 2);
    line(c, w * .26, y - 9, w * .35, y - 8, P.ink, 2);
    // Props recompose into the bottom corners on a phone, rather than cropping
    // the desktop center and accidentally filling the typography's safe area.
    this.camera(c, w * (portrait ? .14 : .115), y - 6 * u, u);
    this.roadCase(c, -6, y - 15 * u, 26 * u, 23 * u, P.blue);
    if (!portrait) {
      this.roadCase(c, w * .19, y - 12 * u, 36 * u, 20 * u, '#326270');
      this.roadCase(c, w * .2, y - 24 * u, 23 * u, 12 * u, '#274B60');
      // A folded reflector with its polished apron picking up the cyan light.
      line(c, w * .055, floor + 9, w * .035, y + 1, P.wood, 2);
      poly(c, [[w * .025, floor - 5], [w * .085, floor - 8], [w * .083, floor + 15], [w * .023, floor + 18]], P.apricot);
      line(c, w * .025, floor - 5, w * .085, floor - 8, P.cream, 2);
    }
    this.directorChair(c, w * (portrait ? .83 : .84), y - 4 * u, u);
    this.roadCase(c, w - 23 * u, y - 11 * u, 31 * u, 19 * u, P.blue);
    // Clapper on a low rolling workbox. It's scenery, not an interactive target.
    if (!portrait) {
      const x = w * .91, yy = y - 30 * u;
      this.roadCase(c, x - 15 * u, yy + 8 * u, 26 * u, 25 * u, '#365B64');
      rect(c, x - 10 * u, yy - 5 * u, 22 * u, 15 * u, P.ink);
      rect(c, x - 8 * u, yy + 2 * u, 18 * u, 1, P.apricot);
      rect(c, x - 8 * u, yy + 6 * u, 11 * u, 1, '#75958E');
      poly(c, [[x - 11 * u, yy - 7 * u], [x + 10 * u, yy - 13 * u], [x + 12 * u, yy - 9 * u], [x - 10 * u, yy - 3 * u]], P.apricot);
      for (let i = 0; i < 3; i++) line(c, x + (-7 + i * 6) * u, yy + (-7 - i * 1.7) * u, x + (-4 + i * 6) * u, yy + (-4 - i * 1.7) * u, P.ink, 2);
    }
    // The corner work lamp has an unmistakable practical, warm light source.
    const lampX = w * (portrait ? .955 : .958), lampY = floor + 17;
    line(c, lampX, lampY - 24 * u, lampX, lampY + 22 * u, '#739394', 2);
    line(c, lampX, lampY + 16 * u, lampX - 10 * u, lampY + 24 * u, P.ink, 2);
    line(c, lampX, lampY + 16 * u, lampX + 10 * u, lampY + 24 * u, P.ink, 2);
    rect(c, lampX - 9 * u, lampY - 26 * u, 18 * u, 12 * u, P.ink);
    rect(c, lampX - 6 * u, lampY - 24 * u, 12 * u, 8 * u, P.apricot);
    rect(c, lampX - 4 * u, lampY - 23 * u, 8 * u, 2 * u, P.cream);
  }

  suspendedScenery(c, time) {
    const { w, h, rig, portrait } = this;
    // A small scenic sun and cloud expose their suspension, like stage flats.
    // They stay outside the central 80% in portrait and outside 70% on desktop.
    const sway = Math.sin(time * .00037) * (portrait ? 1 : 2);
    const x = w * (portrait ? .975 : .925) + sway;
    const y = h * (portrait ? .29 : .245) + Math.sin(time * .00029) * 1.2;
    const radius = portrait ? 12 : Math.min(24, w * .033);
    line(c, x - radius * .35, rig + 7, x - radius * .35, y - radius, '#48616A');
    line(c, x + radius * .35, rig + 7, x + radius * .35, y - radius, '#48616A');
    ellipse(c, x + 2, y + 2, radius, radius, P.red);
    ellipse(c, x, y, radius, radius, P.coral);
    ellipse(c, x - 3, y - 3, radius - 4, radius - 4, P.apricot);
    rect(c, x + radius * .2, y - radius * .9, 3, 3, P.cream);
    // Small zig-zag scenic cloud on the opposite wing, shifted toward the edge.
    const cx = w * (portrait ? .025 : .072) - sway, cy = h * .3;
    const cw = portrait ? 16 : 26;
    line(c, cx, rig + 7, cx, cy - 5, '#3A5963');
    poly(c, [[cx - cw, cy + 7], [cx - cw, cy], [cx - 10, cy], [cx - 10, cy - 6], [cx + 4, cy - 6], [cx + 4, cy - 2], [cx + 13, cy - 2], [cx + 13, cy + 3], [cx + cw, cy + 3], [cx + cw, cy + 9], [cx - cw, cy + 9]], P.teal);
    line(c, cx - 9, cy - 6, cx + 3, cy - 6, P.cyan);
    line(c, cx - cw, cy + 9, cx + cw, cy + 9, '#0B2632');
  }

  render(time = 0) {
    const { c, w, h, rig, floor } = this;
    if (!c || !this.back) return;
    const t = this.reduced ? 6200 : Number(time) || 0;
    c.globalAlpha = 1;
    c.drawImage(this.back, 0, 0);
    // Slow sweeps are low contrast so the HTML title is always the brightest
    // object. No random flicker, no full-screen camera motion, no flashing.
    const drift = Math.sin(t * .00013) * w * .055;
    const lamps = [
      { x: w * .15, target: w * .24 + drift, color: '#35D6C5', width: w * .12 },
      { x: w * .85, target: w * .75 - drift, color: '#FFD39A', width: w * .13 }
    ];
    for (const lamp of lamps) {
      c.globalAlpha = .045;
      poly(c, [[lamp.x - 3, rig + 17], [lamp.x + 3, rig + 17], [lamp.target + lamp.width, floor + 12], [lamp.target - lamp.width, floor + 12]], lamp.color);
      c.globalAlpha = .035;
      poly(c, [[lamp.x - 2, rig + 17], [lamp.x + 2, rig + 17], [lamp.target + lamp.width * .55, floor + 12], [lamp.target - lamp.width * .55, floor + 12]], lamp.color);
      c.globalAlpha = .09;
      ellipse(c, lamp.target, floor + 13, lamp.width, 5, lamp.color);
      c.globalAlpha = .07;
      ellipse(c, lamp.target, floor + 13, lamp.width * .62, 3, lamp.color);
    }
    c.globalAlpha = 1;
    this.suspendedScenery(c, t);
    c.drawImage(this.wings, 0, 0);
    c.drawImage(this.front, 0, 0);
    // A few lit dust motes, constrained to the wings, drift without blinking.
    c.globalAlpha = .26;
    for (let i = 0; i < 12; i++) {
      const phase = t * .000008 + i * .0833;
      const x = (i % 2 ? w * .88 : w * .12) + Math.sin(i * 4.7 + t * .00019) * w * .025;
      const y = rig + 30 + ((phase % 1) * (h * .53));
      rect(c, x, y, 1, 1, i % 3 ? P.apricot : P.cyan);
    }
    c.globalAlpha = 1;
  }
}

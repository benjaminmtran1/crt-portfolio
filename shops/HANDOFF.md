# SHOPS — Handoff

Studio site for Benjamin Tran's scenic fabrication work, built as cut paper on
a warm ground under a light source that cannot be trusted, with a
self-contained admin GUI for updating content.

Same skeleton as `crt-portfolio`: no build step, no dependencies beyond one
Google Font, three files that know about each other.

## Files

| File           | What it is                                                     |
|----------------|----------------------------------------------------------------|
| `index.html`   | The site. Renders itself from `content.json` at load time.     |
| `content.json` | All site content: sections, jobs, media paths, contact.        |
| `admin.html`   | "The Bench" — edit content, upload media, publish.             |
| `assets/`      | Media files.                                                    |

## Quick start

Serve the folder locally (fetching `content.json` is blocked on `file://`):

```bash
python3 -m http.server
# site:  http://localhost:8000
# admin: http://localhost:8000/admin.html
```

Deploy with GitHub Pages (Settings → Pages → deploy from `main`). The admin
works when hosted too, so the live site can be edited from
`yoursite/admin.html` on any machine.

## The idea

Nothing here is a page. There is one heap of scraps along the bottom of the
screen, and a section is what happens when you pull pieces out of it: they arc
up, turn over, and settle into an arrangement that makes sense. Leave, and they
go back. The heap is always on screen, because the whole conceit collapses if
you cannot see where things came from.

The visual register comes from a set of Japanese poster references: deep
atmospheric space with haze between the planes rather than a flat ground,
things that *hang* rather than sit, display type inside an organic blob rather
than on a baseline, vertical label rails, and one saturated moment against a
pale mist.

Warm earthy paper survived that shift — but it moved. It is in the *scraps*
now, hanging in a cold misty theatre, instead of lying on a plaster table.

### The arc

A scrap is two nested elements. The outer one carries X and rotation, the inner
one Y and scale, **on different easing curves**. Two straight interpolations
running at different rates describe a curve — that is the whole trick, and it is
why the pieces fly rather than slide. The inner curve overshoots
(`cubic-bezier(.28,1.22,.4,1)`) so they settle rather than stop.

The pile pose is pure CSS arithmetic. A scrap knows where it belongs
(`--x`, `--y`, `--w`, `--r`, percentages of the stage) and where it came from
(`--pilex`, `--piler`, its place in the heap), and the resting transform is the
difference between the two expressed in `vw`/`vh`. No JavaScript recomputes
anything on resize.

Coming out is slower and more considered than going back: exits run ~430ms on a
reversed stagger, because things are *thrown* at a pile, not placed on one. The
two overlap deliberately — new pieces start climbing while the old ones are
still falling, or the stage sits visibly empty for a beat.

### The light

Every shadow still derives from `--sun-x` / `--sun-y`, registered with
`@property` so CSS can tween them. Each section declares a `sun` angle, so
arriving somewhere new swings every shadow at once, and shadows still run 130ms
behind their paper. That conceit was never the problem with the old design —
it was landing on rectangles.

### Torn, not cut

Two mechanisms, deliberately different:

- **Photographs** get `filter: url(#torn)` — an `feTurbulence` displacing the
  alpha, which eats the edge of the actual image.
- **Paper** gets `.ragged`: a many-point `clip-path`. A clip-path would eat a
  `box-shadow`, so ragged stock drops its cast shadows and rebuilds them as
  *chained `drop-shadow()` filters*, which follow the clipped silhouette instead
  of the box. The lit edge stays an inset shadow — that one is meant to be
  clipped.

`.ragged.alt` is a second tear pattern, alternated so neighbouring scraps do not
share a silhouette.

### The blob

The title sits in a cloud built by the `#goo` filter: blur a group of five
circles, then throw the alpha through a steep `feColorMatrix` so the blurred
overlaps snap back to one hard silhouette. Three stacked copies at different
scales give the reference's double outline — cream halo, ink edge, lacquer face
— because a gooed shape has no stroke to give. The lobes carry *different*
colours, and the gooey blur mixes them, so the blob gets its gradient from its
own construction.

The rainbow is weather, not typography: a masked ring in the sky plane, behind
everything. It appears once. A rainbow used twice stops being surreal.

## Design tokens

| Token | Value | Role |
|-------|-------|------|
| `--mist-hi` / `--mist` / `--mist-lo` | `#eef0ec` `#dde5e6` `#c4d1d5` | the theatre: cold, deep, full of air |
| `--far` / `--further` | `#a9b8be` `#8d9ea6` | painted ridges receding |
| `--paper` / `--paper-2` | `#f5edda` `#ead9bb` | the scraps: warm, aged, torn |
| `--kraft` / `--board` | `#d7bf99` `#bda37c` | heavier stock |
| `--vermilion` / `--lacquer` | `#c8402c` `#8d2415` | the saturated moment |
| `--gold` / `--blossom` / `--azure` | `#c39a45` `#eec0cd` `#6ea7c9` | accents, used once each |
| `--indigo` | `#23375f` | the title's type, and the one dark strip |
| `--sumi` | `#1e1b1d` | ink. the black swan, the hair |

Type is **Shippori Mincho B1** for display and the vertical rails — a mincho
serif, chosen for the blade-like contrast the reference posters have, with full
Latin coverage so it reads as a high-contrast serif rather than pastiche — and
**Jost** for body and UI.

## Structure

- `.world` holds six **planes** back to front: sky (with the rainbow and the
  painted ridges), far haze, the stages, near haze, the hangings, the pile.
  Each drifts at its own rate under the pointer via `data-depth`.
- `#stages` is the one plane pinned to `inset: 0`. Every other plane overscans
  by `-6%` so parallax never reveals an edge; applied to the stage that
  overscan remaps every `x` and crops the compositions at both sides.
- **The hangings** are navigation as lantern columns dropped from the top of the
  frame. They sway on their own hinge; the current one hangs lower and turns
  lacquer red.
- **The pile** is 40 torn pieces, overwhelmingly warm stock with three accents
  in the whole heap. An even spread of colours reads as confetti; paper with the
  odd scrap of lacquer in it reads as a shop floor. It jostles when something is
  taken out of it.

Haze belongs *between* the planes and along the floor. At full strength it
desaturated every scrap and the whole tableau went to milk.

## Compositions

Sections are not laid out, they are **composed**. `COMPOSE[type]` returns
hand-placed fragments in a 100×100 stage space — a composition assembled by a
loop is a grid wearing a costume.

Two constraints hold the whole system together:

1. **Keep `y` centres above ~70.** The pile's tall scraps rise well past the
   top of their container, and the pile paints over the stage. Tall panels want
   ≤ 62.
2. **Vertical rails are for labels only.** Rotated Latin is a spine, and a spine
   is no place for a sentence — section titles are set horizontally in a
   `.headline` scrap, top left, clear of the centred hangings.

`SCATTER` is nine hand-placed slots for work items. The rest stay in the heap
until asked for, which is the only honest form of pagination on a site made of
scraps — **More from the pile** throws the batch back and pulls the next one.

## Content schema (`content.json`)

Unchanged from the previous build, so `admin.html` drives this one without
edits. `sun` is still read and still means what it meant.

```
site: { title, mark, markSub }
sections: [
  { type:"title",    label, sun, eyebrow, name, tagline, paragraphs[],
                     plates:[{ src, caption }] }
  { type:"work",     label, sun, title, sub,
                     items:[{ title, kind, role, year, client, image,
                              writeup, meta:[{k,v}], gallery:[{src,caption}] }] }
  { type:"services", label, sun, title, sub, note,
                     items:[{ title, blurb, points[], lead }] }
  { type:"process",  label, sun, title, sub,
                     steps:[{ title, text, src, caption }] }
  { type:"about",    label, sun, title, sub, name, role,
                     portrait:{src,caption}, facts:[{k,v}], paragraphs[] }
  { type:"contact",  label, sun, title, sub, rows:[{k,label,href}],
                     meta:[{k,v}], note }
  { type:"custom",   label, sun, title, sub,
                     blocks:[{ kind:text|image|video, ... }] }
]
```

`kind` on a work item is free text and needs no separate list of categories.
Only stills take a natural crop in a gallery — a player with no aspect ratio
collapses to nothing, so `shotHtml()` forces video back into the frame.

## Adding a section type

Two places, nothing else:

1. `COMPOSE.<type>` in `index.html` — returns hand-placed fragments.
2. `SPEC.<type>` in `admin.html` — a list of `[key, label, type]` fields, plus
   a matching `BLANK` entry so **+ ADD** produces something that renders.

## The admin ("The Bench")

Unchanged, and still correct. Three panels: sections, a generated editor,
publish. Every form is built from `SPEC`, so a new field is one line. Photos are
downscaled to 1920px and re-encoded as JPEG in the browser before queueing;
publish commits `content.json` plus queued media through the GitHub contents
API with a fine-grained PAT (*Contents: Read and write*); `diagnose()` explains
a failure instead of relaying "Not Found". **DOWNLOAD** is the no-GitHub route.

The sun dial sets where a section's light comes from. The little square on the
dial casts its own shadow, so the control shows what the setting does rather
than naming an angle.

## Accessibility and motion

`prefers-reduced-motion` stops the flight, the sway, the drift and the late
shadows; the scraps render straight into their composed places, still torn,
still lit. Every control is a real `<button>` with a visible focus ring, the
hangings carry `aria-current`, and decorative layers are `aria-hidden`.

Below 820px the tableaux collapse into a single scrolling column — a
composition in percentages is unreadable on a phone — but the scraps still come
out of the pile. That never changes.

## Known gaps

- `process` step images are portfolio stills standing in for shop-floor
  photographs.
- No work item carries a `writeup` yet, so a detail view shows facts and
  gallery only.
- Compositions hold up to five commissions, five process stages and four custom
  blocks; beyond that the extras are not placed.

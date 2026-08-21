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

Magritte, not Ernst: the shapes are precise and the surfaces are clean. The
strangeness is in the logic, not the texture. Three rules carry it.

**One light, and it is lying.** Everything on the page derives its shadow
from two numbers, `--sun-x` and `--sun-y` — a unit vector for where the light
is coming from, written onto `:root` in `setSun()`. Both are registered with
`@property` as `<number>`, which is the whole trick: unregistered custom
properties cannot be transitioned, so registering them lets CSS tween the
light instead of snapping it.

**The sun moves between sections.** Every section carries a `sun` angle in
degrees clockwise from straight down (`0` drops shadows below an object, `90`
throws them right). `go()` sets the new sun *before* it swaps plates, so all
the shadows in view swing while the composition rebuilds. That swing is the
transition; the paper flying is just what happens on top of it.

**The shadows arrive late.** `.sheet` transitions `transform` and `box-shadow`
at the same duration, but the shadow carries a `130ms` delay. For about a
tenth of a second after anything moves, it sits on the table casting nothing.
Nobody reads this as a bug; it reads as weight.

Two smaller contradictions run underneath: `.contra` lights an element from
behind and `.cross` from ninety degrees off, so at least one object per
section disagrees with the rest about the time of day. And the `.sunmark` in
the bottom-right corner — a paper disc sitting where the light is — is the
only object on the site that casts no shadow at all.

### The signature

A flat sky-blue rectangle whose shadow is a cloud (`.cloudplate`). It sits
below-left of the print pile on the title card, on open ground where the whole
silhouette shows — tucked behind the pile the joke had nowhere to land.

The cloud is built from four opaque `<i>` lobes rather than masked out of one
SVG shape. Opaque siblings overlap without darkening each other, so blur and
opacity on the parent treat the group as a single object; an SVG mask was
tried first and only ever rendered its base rectangle. The lobes are
positioned in percentages, so resizing `.face` resizes the cloud with it.

## Design tokens

The ground is warm and earthy and never neutral — a grey anywhere in this
palette reads as a mistake. One cool note, used sparingly, does all the
contrast work.

| Token | Value | Role |
|-------|-------|------|
| `--plaster` | `#e7dac4` | the tabletop everything sits on |
| `--paper` | `#f4ecdf` | a fresh sheet, top of the pile |
| `--paper-lo` | `#eadcc6` | an older sheet, further down |
| `--sand` | `#d2b993` | card stock |
| `--clay` | `#b96f45` | terracotta — the working accent |
| `--rust` | `#8d472a` | its pressed state |
| `--soot` | `#241c17` | type. warm black |
| `--faded` | `#7a6a5b` | secondary type |
| `--sky` | `#93b9d6` | the one cool thing on the site |

The page ground is not a flat fill: `body::before` is a radial gradient whose
bright centre is placed *opposite* the sun, so even the empty table turns over
when a section changes. `body::after` multiplies one `feTurbulence` over
everything, which is what stops the flat fills reading as CSS.

Type is **Jost** (a Futura substitute — geometric, period-correct to
surrealism, and deadpan). Swap it by changing `--display-font` /
`--body-font` and the `family=` in the Google Fonts `<link>`; nothing else
reads the face directly.

## The sheet

One component does all the material work. `.sheet` carries `--lift` (how many
sheets up it sits, 1–6) and paints four shadows off it: a lit edge inset on
the side facing the sun, a hard contact shadow with **no blur** — that one is
what makes it read as cut rather than drawn — and two softer casts for the air
between. Everything else is a `.sheet` with a background: `.kraft`, `.card`,
`.blue`, `.clay`, `.soot`.

Hover raises `--lift` and translates *against* the sun, so a lifted card moves
toward the light. Don't animate the shadow separately from the transform; the
delay on `box-shadow` already does that work.

## Structure

`.rail` is the navigation — a stack of index tabs, each its own sheet, so the
nav is made of the same material as the work. `.table` holds one `.plate` per
section, stacked in the same space; only one has `.on`.

Inside a plate, anything the composition is built from is a `.piece`. Pieces
enter on a stagger from offsets that alternate by index (`--i`, assigned in
`number()`), and exit blown along the current light. An exiting plate keeps
`opacity: 1` via `.plate.out` — fading the whole plate would cut the exit off
at its first frame.

A hovering `.piece` and a hovering `.sheet` both want `transform`, so anything
with hover motion is wrapped: `.piece > .sheet`, never both on one element.

## Content schema (`content.json`)

```
site: { title, mark, markSub }
sections: [
  { type:"title",    label, sun, eyebrow, name, tagline, paragraphs[],
                     plates:[{ src, caption }] }
  { type:"work",     label, sun, title, sub,
                     items:[{ title, kind, role, year, client, image,
                              writeup, meta:[{k,v}],
                              gallery:[{ src, caption }] }] }
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

Section numbers come from array order. All text is HTML-escaped at render
time. `#work`-style hashes deep-link to a section; arrow keys and number keys
walk them.

`kind` on a work item generates the filter chips — there is no separate list
of categories to keep in step. Filtering re-queues the survivors' `--i` and
re-adds `.piece`, so the grid rebuilds in order rather than gapping.

Only stills take the `natural` crop in a gallery. A player with no aspect
ratio collapses to nothing, so `frameHtml()` forces video back into the frame
regardless of what the caller asked for.

## Adding a section type

Two places, nothing else:

1. `RENDER.<type>` in `index.html` — returns the plate's inner HTML.
2. `SPEC.<type>` in `admin.html` — a list of `[key, label, type]` fields.

Field types available to the admin: `text`, `textarea`, `paras` (blank-line
separated), `lines` (newline separated), `media`, `mediaobj`, `kv`, `kv3`, and
`list` (which nests, so a job's gallery is just a list inside a list). Add a
matching entry to `BLANK` so **+ ADD** produces something that renders.

## The admin ("The Bench")

Three panels: sections on the left, the generated editor in the middle,
publish on the right. Every form is built from `SPEC` — there are no bespoke
editors, which is why a new field is one line.

- **The sun dial** sets the section's light. The little square on the dial
  casts its own shadow, so the control shows what the setting does rather than
  just naming an angle.
- **Media.** Photos are downscaled to 1920px and re-encoded as JPEG (~q0.82)
  in the browser before they are queued, so a phone shot does not become a
  12 MB commit. HEIC converts where the browser can decode it and explains
  itself where it cannot. Videos are capped at 25 MB and must be MP4/WebM;
  **USE URL** takes YouTube, Vimeo, or any hosted file. **+ BATCH UPLOAD** on
  a media list takes a multi-select.
- **Publish** commits `content.json` plus any queued media through the GitHub
  contents API. Needs a fine-grained PAT scoped to this repo with
  *Contents: Read and write*. The token is used for those requests and stored
  nowhere unless "remember" is ticked. When a publish fails, `diagnose()` asks
  GitHub who the token is and what it can reach, so the box says what is
  actually wrong instead of "Not Found".
- **DOWNLOAD** is the no-GitHub route: exports `content.json` and any pending
  media for manual placement and commit.

Cards remember which of them are open across re-renders (`openCards`, keyed by
path), so editing a field deep in a gallery does not collapse the tree.

## Accessibility and motion

`prefers-reduced-motion` stops the paper flying, the sun travelling, the
shadows arriving late, and the print pile auto-advancing. The material stays —
depth was never the animation. Decorative layers are `aria-hidden`; every
control is a real `<button>` with a visible focus ring.

Below 980px the rail lies down along the top and the plates take full width;
below 620px the compositions unstack. A collage that needs two columns is not
a collage on a phone.

## Known gaps

- `process` step images are seeded from portfolio stills as placeholders —
  swap them for shop-floor photographs in the admin.
- Work items carry no `writeup` yet, so a job's detail view shows its gallery
  and facts only. Adding a write-up in the admin is what makes the card read
  "Lift this one off the pile".

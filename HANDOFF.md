# CRT Portfolio — Handoff Doc

Portfolio site for Ben's film construction work, styled as an old CRT television,
with a self-contained admin GUI for updating content.

## Files

| File           | What it is                                                    |
|----------------|---------------------------------------------------------------|
| `index.html`   | The site. Renders itself from `content.json` at load time.    |
| `content.json` | All site content: channels, projects, media paths, contact.   |
| `admin.html`   | "Control Room" GUI — edit content, upload media, publish.     |
| `assets/`      | Media files (created on first upload).                        |

No build step, no dependencies beyond two Google Fonts.

## Quick start

Serve the folder locally (fetch of content.json is blocked on file://):

```bash
python3 -m http.server
# site:  http://localhost:8000
# admin: http://localhost:8000/admin.html
```

Deploy by enabling GitHub Pages on this repo (Settings → Pages → deploy from
`main`). The admin tool also works when hosted — you can edit the live site
from `yoursite.github.io/admin.html` on any machine.

## Editing workflow (admin.html)

1. Open `admin.html`. It loads `content.json` automatically (or use
   LOAD JSON FILE when serving isn't possible).
2. **Left panel** — channel list. Click to select, ▲▼ to reorder, ✕ to delete,
   `+ NEW CHANNEL` to add one (types: hero, guide, process, contact, custom).
3. **Middle panel** — the editor for the selected channel. Projects, hero
   carousel slides, and gallery images are **collapsible cards**: click a
   card's header to open/close it, or use EXPAND ALL / COLLAPSE ALL in the
   section header. Collapsed cards show number, title, and a summary
   (image count, whether there's a write-up, filename, or a red "no media"
   flag). Newly added items open automatically; batch-uploaded ones stay
   collapsed. Collapse state is tracked per item object, so it follows a
   card when reordered and never lands in content.json. Guide channels have
   an `+ NEW PROJECT` button; each project has fields plus an UPLOAD MEDIA
   button with a live CRT-graded preview. Custom channels compose free-form
   text / image / video blocks.
4. **Right panel** — publish. Enter GitHub owner, repo, branch, and a
   fine-grained personal access token scoped to this repo with
   *Contents: Read and write*. PUBLISH commits `content.json` plus any newly
   uploaded media to `assets/` via the GitHub API. Pages redeploys in ~1 min.
   - The token never leaves the browser; "remember settings" is opt-in
     localStorage.
   - No-GitHub fallback: DOWNLOAD JSON exports `content.json` and any pending
     media files for manual placement + commit.

### Adding the showreel

In a guide channel's editor, set Showreel to `youtube` / `vimeo` and paste the
watch URL (the ID is extracted automatically), or `file` and upload an MP4.
`none` hides the reel block entirely (so category channels without a reel
don't show an empty frame).

### Media uploads (admin)

Uploaded images are processed in the browser before queueing: downscaled to
max 1920px and re-encoded as JPEG (~q0.82). HEIC converts automatically where
the browser can decode it; otherwise the slot shows an inline error with
instructions. Videos are capped at 25 MB and must be MP4/WebM. Every media
slot also has a USE URL button for externally hosted media.

Batch upload: the hero FEATURED CAROUSEL and each project gallery have a
`+ BATCH UPLOAD` button — multi-select files in one go; each becomes a slide
(same downscale/JPEG pipeline; failures are reported and skipped without
aborting the rest).

### Project categories

Projects live in one guide channel per category — NARRATIVE, COMMERCIAL,
REALITY, INSTALLS — plus SIGNAL (hero), ABOUT (custom), and CONTACT.
Categories are just guide channels: add/remove/reorder them freely in the
admin's channel list.

## Content schema (content.json)

```
site: { pageTitle, heroName }            heroName may contain <br>
channels: [
  { type:"hero",    label, sub, paragraphs[], showTestBars,
                    carousel:[{ src, caption }] }
  { type:"guide",   label, title, sub,
                    reel:{ kind:none|youtube|vimeo|file, src, caption },
                    projects:[{ time, title, desc, tags, image, caption,
                                writeup, gallery:[{ src, caption }] }] }
  { type:"process", label, title, sub,
                    steps:[{ timecode, text, image, caption }] }
  { type:"contact", label, title, sub, rows:[{ k, label, href }], note }
  { type:"custom",  label, title, sub,
                    blocks:[{ kind:text|image|video, ... }] }
]
```

Channel numbers (CH 01…) come from array order. All text is HTML-escaped at
render time except `heroName`'s `<br>`.

## Design tokens

- `--tube` `#0b0e0c` — unlit phosphor background
- `--phosphor` `#a8bfa0` — muted green, primary text
- `--phosphor-dim` `#5f6f5b` — secondary text
- `--amber` `#c2a35c` — OSD accents, active states
- `--ghost` `#6e7f8d` — dimmed UI labels
- `--burn` `#d8d4c4` — bright highlights (headings)

Fonts: **VT323** (OSD/display), **IBM Plex Mono** (body).

## CRT effect layers (index.html)

Stacked overlays inside `.crt`, back to front: `.grille` (RGB stripes),
`.scanlines`, `.sweep` (travelling refresh band), `.vignette`, `.flicker`,
`#noise` (canvas static during channel changes), `.boot` (power-on flash).
All decorative layers are `aria-hidden`; `prefers-reduced-motion` disables
motion effects. Arrow keys (← →) change channels, and number keys tune
channels directly.

## CH 00 — OFF AIR (easter egg)

A hidden test-card channel, hardcoded in `index.html` (never in the dial or
content.json). Muted SMPTE-style bars, a BEN·TV ident, a live broadcast clock,
blinking PLEASE STAND BY, and a TONE button that plays a quiet 1 kHz sine via
WebAudio (auto-killed when tuning away). Three ways in: channel-surfing wraps
through it (← from CH 01 or → past the last channel), pressing the 0 key, or
tapping the CH number OSD in the top-right corner (tap again to return —
that's the touch route).

## Media treatment (`.tv-frame`)

Any image/video/iframe wrapped in `.tv-frame` gets the broadcast look:
desaturated green-shifted CSS filter grade, per-media scanlines, vignette,
hover tracking glitch with VHS chroma bleed (SVG filter `#chromaBleed`
splits R/B channels, smears and wobbles them via SMIL — on touch devices,
press-and-hold any frame for the same effect, with a short linger after a
tap), optional `.tv-caption` (add `.rec` for blinking record
dot). Empty slots render an animated NO SIGNAL state. The grade is pure CSS —
no image pre-processing needed. On YouTube/Vimeo iframes the overlay sits over
player controls too; self-hosted video avoids that.

## Project pop-up ("Program Detail")

A project with a `writeup` and/or `gallery` becomes clickable in the guide —
hovering shows "PRESS FOR PROGRAM DETAIL", and clicking (or Enter/Space) opens
a picture-in-picture window styled as its own small tube: scanlines, vignette,
tune-in animation. Inside: title, tags, a carousel of the gallery images at
the top, then the write-up (blank lines become paragraph breaks). Arrow keys
step the carousel while open; ESC or the backdrop closes it and
channel-switching keys are suspended. Projects with neither field stay
non-clickable. Edit both fields per-project in the admin's guide editor
(`+ GALLERY IMAGE` to add images).

## CH 01 — the title card

CH 01 is a single fixed composition that never scrolls: the hero carousel
fills the whole tube as a picture plate and the type is supered over it, the
way a title card or a broadcast super worked in the 70s-90s. The reference
points are Kubrick and Lynch title sequences — everything symmetrical about
the centre line, type sitting in the picture rather than beside it.

Structure (`RENDERERS.hero`, the `.hero-*` rules in index.html):

| Layer | What it does |
|-------|--------------|
| `.hero-plate` | the carousel, full-bleed; 16:9 dropped, scaled 1.04 for CRT overscan |
| `.hero-dip` | dips the picture under the words — a radial under the type plus a top/bottom wash |
| `.hero-safe` | title-safe registration marks in the four corners |
| `.hero-copy` | eyebrow → title → rule → body → test bars, centred on one axis |

- The plate drops its own scanlines and vignette; the tube already supplies
  both, and a second set over a full-bleed picture only crushes it.
- Carousel nav shrinks to 26% edge strips so the middle of the picture isn't
  a click trap. The still counter and slide caption move to the top
  title-safe corners — the bottom ones belong to the dial.
- `.hero-eyebrow` is `ch.sub`, tracked out to 0.44em and uppercased. The old
  `.hero-sub` rule is gone; the content field itself is unchanged.
- `.hero-title` is `white-space: nowrap`, so it keeps the line breaks written
  into `heroName`. `fitHeroTitle()` scales it down if a longer name would run
  past the title-safe box.
- `fitHeroFrame()` measures the dial and publishes `--dial-h`, so the copy
  block and the safe marks clear it however many rows it wraps to on narrow
  screens. Both run on load, after fonts settle, and on resize.

Nothing here is content-specific — edit CH 01 in the admin exactly as before.
`showTestBars` still works; the bars sit under the body copy, and are hidden
on narrow or short screens where the dial needs the room.

## CRT carousel (hero + pop-up)

Shared component (`carouselHtml`/`carGo` in index.html). Slides swap with a
"retune" glitch (tracking jitter + chroma bleed + brightness stutter). Click
or tap the left third for previous, right two-thirds for next (hover shows
◀ TRACK / TRACK ▶ hints); swipe works on touch. The hero carousel
auto-advances every ~6s while its channel is on air and unhovered; the pop-up
carousel is manual (plus arrow keys). `prefers-reduced-motion` disables both
the glitch and auto-advance. Hero slides are managed in the admin's SIGNAL
editor (FEATURED CAROUSEL → `+ SLIDE`).

The pop-up carousel is "natural" (`cls: 'natural'`): stills keep their
original crop and aspect ratio (max 62vh tall, pillarboxed on black) rather
than filling a 16:9 frame, and pop-up media drops both scanline layers — the
per-media one and the pop-up window's own overlay (the carousel sits above it
at z-index 8) — for a clearer read. The frame's vignette and the CRT colour
grade stay. Video slides keep 16:9 so their players size correctly. The hero
carousel is the full-frame picture plate behind CH 01's titles (see above):
tube-shaped rather than 16:9, cover-cropped, dipped under the type.

Slides accept video too: a YouTube/Vimeo watch URL or a direct .mp4/.webm
file becomes an embedded player (`slideVideoKind`/`slideMediaHtml`). On video
slides the nav zones shrink to 12% edge strips so player controls stay
clickable, the camcorder caption is hidden, and auto-advance holds until the
viewer moves on ("video holds the broadcast"). Gallery images in the admin's
project editor take the same URLs via USE URL.

## Publishing / security notes

- Fine-grained token: github.com → Settings → Developer settings →
  Fine-grained tokens → scope to this one repo, Contents R/W only.
- Media uploads go through the GitHub contents API (base64), fine for photos
  and short clips. GitHub blocks files >100 MB and the API gets unhappy well
  before that — host long reels on YouTube/Vimeo or an external host instead.
- If the repo is public, `admin.html` is publicly reachable when Pages is on.
  That's safe — it's inert without a token — but you can keep it out of the
  deploy if preferred.

## Content to replace before launch

- [ ] Hero copy on CH 01
- [ ] Project entries + real stills (placeholders point at picsum.photos)
- [ ] Reel embed
- [ ] Email, phone, reel link on CH 04

## Ideas parked for later

- Lightbox: thumbnails expand fullscreen with the channel-tune animation
- Live preview iframe inside admin.html

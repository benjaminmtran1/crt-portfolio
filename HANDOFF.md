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
  { type:"contact", label, title, sub, rows:[{ k, label, href }],
                    tx:[{ k, v }], note }
  { type:"custom",  label, title, sub,
                    blocks:[{ kind:text|image|video, ... }] }
]
```

Channel numbers (CH 01…) come from array order. All text is HTML-escaped at
render time except `heroName`'s `<br>`.

Guide channels lay their listings out in **two columns once the tube is at
least 900px wide** (a container query, not a viewport one — see above), like a
printed guide page — roughly twice the programmes visible before scrolling,
and the dead half of a wide tube put to work. Grid rows align across both
columns so the hairlines line up the way they would in print; a row whose
title wraps makes both cells taller. Below 1000px it returns to one column.
`desc` and `tags` only render when set, so projects carrying just a role
don't leave empty rows behind.

## Design tokens

The palette comes off 60s–80s film title cards: one saturated ink printed
over faded Technicolor photography, warm bone-white credits, never a neutral
grey.

| Token | Value | Role |
|-------|-------|------|
| `--tube` | `#15100e` | warm near-black — unlit glass |
| `--deep` | `#0c0908` | deepest black — bezels, scrims |
| `--burn` | `#f7e9d2` | bone white — headings, highlights |
| `--phosphor` | `#ded0bb` | warm sand — body copy |
| `--phosphor-dim` | `#9c8a79` | secondary text |
| `--ghost` | `#a58f7b` | dimmed UI labels |
| `--ink` | per channel | the colour currently on air |

**The inks.** Every channel is "printed" in a different one, the way each
title card in a run got its own colour pass — tomato `#e8503a`, butter
`#f2cb4a`, bubblegum `#f272a8`, sea green `#67b6a6`, marigold `#ec9a3c`,
bone `#f6e6cd`, cycling by channel number (CH 00 is always bone). `paintInk()`
writes `--ink` and `--ink-rgb` onto `.crt` from inside `tune()`'s static
burst, so the OSD, dial, headings, timecodes and hero title all repaint
together with the picture.

Because custom properties compute once where they are declared, an alias like
`--amber: var(--ink)` on `:root` would freeze at the root value and never
follow the channel. Use `var(--ink)` directly.

Translucent glows, borders and scrims use the `*-rgb` triplet tokens
(`rgba(var(--ink-rgb), 0.4)`) so they track the palette rather than
hardcoding it.

`--grade` holds the film grade applied to every image, video and iframe —
one definition, five call sites (base, hover, touch-bleed, retune, off-air).

**The channel colour pass.** On top of `--grade`, `.tv-frame::after` layers a
flat `--ink` veil under its vignette, so every picture on a channel is tinted
toward that channel's ink and its blacks lift. Faded dye goes milky and
coloured in the shadows while the highlights hold, which is why a flat veil
reads as age rather than as a filter. It rides the existing pseudo-element,
so it reaches every `.tv-frame` with no markup changes — hero window, guide
thumbnails, pop-up galleries, reels. Flipping channels changes the film
stock, not just the accent colour. Tune the depth with the veil's alpha
(currently `0.13`); note that butter (CH 02) and marigold (CH 05) are the
closest pair in the ink cycle, so those two read most alike.

Fonts: **VT323** (OSD chrome — channel numbers, dial, captions),
**Bowlby One SC** via `--display-font` (headings and the hero title — the fat
rounded grotesque the title cards use), **IBM Plex Mono** (body copy and the
tracked credit line above the hero title).

Swap the display face by changing `--display-font` and the `family=` list in
the Google Fonts `<link>`; the hero title re-fits itself to whatever face
loads, so no sizes need touching.

## Station identity

**The ident.** Tuning hands off from the static burst to a full-screen
continuity card — BEN·TV over a rule, then `NOW TUNING` and the channel
you have landed on — held 700ms, then faded. `showIdent()` runs inside
`tune()`'s burst callback *after* `paintInk`, so the card is already painted
in the ink of the channel being tuned to. Surfing on before it clears
cancels the pending timer, so idents never stack. Hidden entirely under
`prefers-reduced-motion`.

**The bug.** `.bug` is the translucent BEN·TV watermark in the bottom-right,
riding above the dial. Stations watermark *programming*, not idents or title
cards, so it shows on the guide channels only —
`.crt:has(.ch-guide.on) .bug` — and stays off on the hero, ABOUT, CONTACT
and the off-air test card.

## CH 07 — the continuity slate

A closedown slate was an engineering card: station ident, then the details in
ruled label/value rows. That form is more legible than free text, so the
period reference and the one hard requirement on this page — the address and
number must be unmissable — pull the same way. Fixed to the tube like CH 01;
a slate never scrolls.

- `.slate-box` holds the `rows`. Values are set in **bone, not the channel
  ink** — a saturated ink on near-black is a far weaker contrast, and this is
  the one thing on the site that has to read at a glance. The ink carries the
  "this is a link" signal as an underline instead, and `justify-self: start`
  keeps that rule hugging the text rather than running the width of the grid
  cell. The whole row is the tap target, not just the text.
- `tx` is the transmitter-data block — `[{ k, v }]`, flavour only, sitting
  well clear of the details above and hidden on short screens where the
  contact rows need the room. Editable in the admin's contact editor
  alongside the normal rows.
- `.slate-inner .slate-note` is qualified deliberately: `.smpte-note` is
  declared later in the sheet at equal specificity, so an unqualified
  `.slate-note` would lose on source order and inherit the old scrolling
  layout's much larger margin.

## Halation

`--halation` holds the glow stack shared by the hero title, the channel
headings and the ident wordmark. Halation is light scattering in the
emulsion and bouncing off the film backing, and it is never one glow — a
tight bloom hugging the letterform, a wider halo, a broad wash. The outer
wash skews warm because the anti-halation layer absorbs blue and green
harder than red, but the ink's own hue carries the first three radii:
weighting the wash any heavier makes a cool ink (CH 04) read as a
misregistered red shadow rather than a glow.

It is declared **on `.crt`**, not `:root`, so it resolves against the
`--ink-rgb` that `paintInk()` writes onto that element. On `:root` it would
compute once against the default ink and inherit frozen — the same trap the
old `--amber` alias fell into.

## The 4:3 tube

A set was 4:3, so on a landscape window ≥900px the tube takes that ratio and
the cabinet fills the pillars either side. Portrait and small screens keep
filling the window, since 4:3 on a phone would give a letterbox strip rather
than a television. The rule has to sit **after** `.crt`'s own `width: 100%`
— same specificity, so source order decides it.

Pillarboxing decouples the tube from the window, which breaks any viewport
media query describing layout *inside* the tube. `.screen` is therefore a
container (`container-type: inline-size`) and the guide's two-column rule is
`@container (min-width: 900px)`. A 1280x720 window gives an 892px tube and
correctly drops to one column, where a viewport query would have forced two
into a tube too narrow for them.

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

CH 01 is a single fixed composition that never scrolls. The name is set on
unlit tube — most film title cards are type on black — and the hero carousel
sits beside the credits as a contained picture window, like a broadcast
over-the-shoulder insert. Everything stays locked to the title-safe
rectangle, with registration marks in the corners and a faint ink wash
behind the title so the black isn't dead flat.

Structure (`RENDERERS.hero`, the `.hero-*` rules in index.html):

| Piece | What it is |
|-------|------------|
| `.hero-head` | eyebrow → title → rule, centred, full width |
| `.hero-lower` | body copy + test bars on the left, picture window right |
| `.hero-side` | the carousel in a normal `.tv-frame` — full CRT treatment |
| `.hero-safe` | title-safe registration marks in the four corners |

- The window is a stock carousel: scanlines, vignette, caption, counter,
  38/62 nav zones, auto-advance — nothing hero-specific.
- `.hero-title` is `white-space: nowrap`, printed in the channel ink with
  the hard offset shadow; `fitHeroTitle()` scales it to the head's inner
  width (it measures the *container*, since the title is a fit-content flex
  item that overflows silently).
- Three measurements drive the layout, all run on load, after fonts settle,
  and on resize: `fitHeroFrame()` publishes the dial's height as
  `--dial-h`; `fitHeroTitle()` fits the name; `fitHeroLower()` publishes
  the leftover height under the head as `--lower-h` (capped at 520px), and
  the window's width takes the smaller of its column and
  `--lower-h × 16/9`, so the 16:9 frame never outgrows the row. Order
  matters: the fitted title size decides how much height is left.
- On tall tubes the whole card centres as a group
  (`justify-content: center`) instead of pinning the head to the top.
- Below 760px the row stacks — credits, then the window full-width — and
  the test bars hide (the dial owns the bottom).

Nothing here is content-specific — edit CH 01 in the admin exactly as
before. `showTestBars` still works; the bars sit under the body copy.

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
carousel is CH 01's picture window (see above): a stock 16:9 frame beside
the credits, full CRT treatment.

Passing `strip: true` to `carouselHtml` adds a **filmstrip** under the
frame — every slide as a small thumbnail, dimmed like a contact sheet, the
current one lit in the channel ink, so the viewer always sees the few stills
behind and ahead of the one on air. The strip scrolls sideways with faded
edges and keeps the active frame centred (`carStripSync`); clicking a thumb
jumps straight to that slide (`carSet`, which `carGo` now steps through).
Stills thumb themselves, YouTube slides use the ytimg thumbnail service
(falling back to a ▶ tile if it fails), Vimeo and raw files get the ▶ tile.
The project pop-up's gallery carousel has it on; the hero window stays
clean.

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

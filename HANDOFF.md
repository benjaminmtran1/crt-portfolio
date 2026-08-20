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
3. **Middle panel** — the editor for the selected channel. Guide channels have
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

### Project categories

Projects live in one guide channel per category — NARRATIVE, COMMERCIAL,
REALITY, INSTALLS — plus SIGNAL (hero), ABOUT (custom), and CONTACT.
Categories are just guide channels: add/remove/reorder them freely in the
admin's channel list.

## Content schema (content.json)

```
site: { pageTitle, heroName }            heroName may contain <br>
channels: [
  { type:"hero",    label, sub, paragraphs[], showTestBars }
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
tune-in animation. Inside: title, tags, the write-up (blank lines in the
write-up become paragraph breaks), and a gallery with a 16:9 main viewer plus
a camera-select thumbnail strip. Arrow keys step the gallery while open; ESC
or the backdrop closes it and channel-switching keys are suspended. Projects
with neither field stay non-clickable. Edit both fields per-project in the
admin's BUILDS editor (`+ GALLERY IMAGE` to add images).

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

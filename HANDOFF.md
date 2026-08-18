# CRT Portfolio — Handoff Doc

Portfolio site for Ben's film construction work, styled as an old CRT television.
Single-file site: everything lives in `index.html` (HTML + CSS + vanilla JS, no
build step, no dependencies beyond two Google Fonts).

## Quick start

Open `index.html` in a browser. That's it. To deploy, host the file anywhere
static (GitHub Pages, Netlify, Cloudflare Pages).

## Concept

The site *is* the television. Sections are channels; navigating triggers a
static burst, a tune-in animation, and an amber OSD channel readout.

| Channel | Section  | Content                                      |
|---------|----------|----------------------------------------------|
| CH 01   | SIGNAL   | Intro / hero                                 |
| CH 02   | BUILDS   | Showreel slot + project list as a TV guide   |
| CH 03   | PROCESS  | Build process as a VTR timecode log          |
| CH 04   | CONTACT  | Email / phone / reel links                   |

Arrow keys (← →) also change channels.

## Design tokens

Defined as CSS custom properties at the top of the stylesheet:

- `--tube` `#0b0e0c` — unlit phosphor background
- `--phosphor` `#a8bfa0` — muted green, primary text
- `--phosphor-dim` `#5f6f5b` — secondary text
- `--amber` `#c2a35c` — OSD accents, active states
- `--ghost` `#6e7f8d` — dimmed UI labels
- `--burn` `#d8d4c4` — bright highlights (headings)

Fonts: **VT323** (OSD/display), **IBM Plex Mono** (body). Loaded from Google
Fonts with monospace fallbacks.

## CRT effect layers

Stacked full-screen overlays inside `.crt`, back to front:

1. `.grille` — faint RGB aperture-grille stripes
2. `.scanlines` — horizontal scanlines (multiply blend)
3. `.sweep` — slow travelling refresh band
4. `.vignette` — tube curvature shading
5. `.flicker` — subtle whole-screen flicker
6. `#noise` — canvas static, only visible during channel changes
7. `.boot` — one-shot power-on flash on page load

All decorative layers are `aria-hidden` and `pointer-events: none`.
`prefers-reduced-motion` disables flicker, sweep, boot, glitches, and blinks.

## Media treatment (`.tv-frame`)

Wrap any `<img>`, `<video>`, or `<iframe>` in `<div class="tv-frame">` to get
the broadcast look: desaturated green-shifted grade (CSS filter), per-media
scanlines (`::before`), vignette (`::after`), and a hover tracking glitch.

Modifiers / extras:

- `.wide` — locks 16:9 aspect ratio (use for video)
- `.guide-thumb` — 4:3 thumbnail sizing for guide rows
- `.no-signal` — empty-slot state with drifting "NO SIGNAL" text
- `<span class="tv-caption">CAM 1</span>` — camcorder OSD caption; add `.rec`
  for a blinking red record dot

### Adding your reel

In CH 02, replace the `.no-signal` block with one of the commented-out embeds
directly below it (YouTube / Vimeo / self-hosted `<video>` variants are all
there). Note: on YouTube/Vimeo iframes the scanline overlay sits over the
player controls too. Self-hosted video avoids that.

### Replacing placeholder images

All images currently point at `picsum.photos` seeds. Swap each `src` for your
own stills; the grade is applied by CSS, so no pre-processing needed. Keep
`loading="lazy"` on anything below the fold.

## Content to replace before launch

- [ ] Hero copy on CH 01 (bio is placeholder)
- [ ] All four project entries on CH 02 (titles, descriptions, tags)
- [ ] All placeholder images
- [ ] Reel embed on CH 02
- [ ] Email, phone, reel link on CH 04
- [ ] `<title>` tag and the on-screen name

## Architecture notes

- Channel switching: `tune(ch)` in the inline script — runs the static burst,
  swaps `.on` classes, replays the tune-in animation via forced reflow, resets
  scroll, updates the OSD.
- Static noise renders at half resolution to the `#noise` canvas for speed.
- No frameworks, no build tooling — deliberate, to keep hosting trivial.

## Ideas parked for later

- Lightbox: thumbnails expand fullscreen with the channel-tune animation
- Degraded-broadcast image hover (VHS chroma bleed via SVG filters)
- An off-air / test-card easter egg channel (CH 00)
- Real project stills shot on set

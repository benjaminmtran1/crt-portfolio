# The Backlot — live portfolio

The homepage is now an explorable pixel-art film set. The rebuilt Backlot Studio admin keeps the original content format and GitHub publishing workflow. No build step or package installation is required.

## Current Build

- Live site: https://benjamintran.ca
- Editor: https://benjamintran.ca/admin.html
- Publishing branch: `main` (the existing GitHub Pages configuration).
- `index.html` is the game frame. The implementation and original pixel artwork are in `backlot/`.
- `content.json` and `assets/` remain canonical. There is no generated image manifest to rebuild after edits. Images are the admin's existing 1920px maximum uploads.
- All project counts and category filters come from the current content. A new guide category appears in Work index automatically. The six physical map destinations keep their existing IDs.
- A separate, full-screen theatrical title scene opens each visit: oversized, colourful **Benjamin Tran** lettering with **Construction Coordinator**, original soundstage artwork, Enter Backlot, a direct Work index option and optional sound. A short curtain transition enters the playable lot; calmer motion skips it. The name follows `site.heroName`; the requested title-screen role is fixed. Settings can return to the title screen. Shared project links open the project directly.
- The clapperboard beside the central avenue starts a 10.5-second scene: quiet on set, a lantern-carrying performer, a moving camera and a wrap. CUT or Escape skips it. Dialogs and background tabs pause it.
- Walk behind stages 01 and 02 through the northern service lane to reveal the timber backs, braces and sandbags. Inspect the small rear placards to open an illustrated cutaway and links to the current project galleries.
- Pet the gently strolling workshop cat, then follow it. It waits if you fall behind and leads to the white production cube truck beyond the prop garden, with its cargo bay open and lift gate lowered horizontally. Pet it there to earn a Crew Approved stamp. The stamp is saved, but the cat is free to roam: after a short rest it walks back to the workshop and can lead you again. Reloads start it at the workshop without resetting any discoveries. The truck and extended lift gate are solid scenery, with a clear interaction spot beside the rear.
- The lighting desk beside the central avenue offers **Work lights**, **Golden hour** and **Night shoot**, with a preview of the whole lot. The selected look is saved in this browser. A filmed take uses its own lighting, then returns to your chosen look.
- Stop at **Craft services** on the western cross street for coffee, rotating crew chatter and hints that change with discoveries already found. This is fictional in-game dialogue, separate from project credits and About content.
- The drafting table outside the workshop opens a 12-second miniature build: **Design → Mark out → Build → Shoot**. Plans are drawn on the pad, transferred to chalk, assembled into a framed and finished set, then filmed with a dolly camera and key light. Pad, plans, chalk, walls and equipment use one axonometric projection. Pause, resume, replay or inspect any step. Calmer motion disables autoplay and keeps every step available. Closing the window or switching away stops progression.
- Six optional crew discoveries now persist in the existing browser save; previous cat rewards remain valid. Settings shows a small discovery count. Projects remain available through Work index at all times.

## Updating the site

Open the editor. Use owner **benjaminmtran1**, repository **crt-portfolio**, branch **main**, and your existing valid GitHub token with Contents read/write. The token stays in your browser and is not included in the source.

Edit projects or add media, then choose **PUBLISH TO GITHUB**. The existing editor uploads pending files to `assets/` and commits `content.json`. GitHub Pages publishes that commit. Reload the portfolio after deployment completes. Publishing also stamps `site.updatedAt`, so a replacement image using the same filename gets a fresh URL.

Supported in the Backlot:

- Project titles, descriptions, role/tags, images, captions, paragraphs, extra info fields, project order and gallery order.
- New projects, deletions, new image uploads and replacement images. Missing images show a clapper placeholder.
- YouTube and Vimeo films play inside project galleries with tap-to-play, native controls, inline playback and fullscreen. Existing gallery URLs/captions remain unchanged. Watch buttons select the embedded film; a small external-watch fallback stays available for provider restrictions. Closing or switching items/projects unloads hosted players and stops local videos. Local MP4/WebM, externally hosted images and category reel links remain supported.
- Category labels and subheadings, browser title, hero/title-screen name and the in-game header role line. The old SIGNAL welcome paragraph is superseded by the title screen.
- About portrait, name, role, biography and slate; Contact rows.

Map location IDs: `narrative`, `commercial`, `reality`, `installation`, `about`, `contact`. Keep these IDs when editing the existing destinations. New guide categories are immediately available in Work index; creating another building or changing the map requires a code update. Non-guide custom/process channels, television timeslots, test bars, the old SIGNAL carousel and other CRT-specific effects do not drive the game map.

The editor now puts project titles, roles and media first. Optional details and legacy-only fields stay available without cluttering the main form, and opening or exporting content does not remove stored values. See [ADMIN.md](ADMIN.md) for the field audit and editor integration test setup.

## Rollback

The old homepage is preserved in branch `archive/crt-before-backlot-2026-10-20`, at commit `fd991678b2fef974df1ff62a26be47715133df02`. Reverting the Backlot release commit restores the former homepage without erasing newer repository history. The `CNAME` file and original project media were preserved.

## Validation

```sh
node backlot/checks/routes.test.mjs
node backlot/checks/admin-compat.test.mjs
node backlot/checks/life.test.mjs
node backlot/checks/truck.test.mjs
node backlot/checks/departments.test.mjs
node backlot/checks/construction.test.mjs
node backlot/checks/title.test.mjs
node backlot/checks/video.test.mjs
node --check backlot/app.mjs
```

The route checks cover every destination from the start and all destination pairs, collision, pause, manual override and movement at different frame rates. The crew checks cover every new prop route, timed takes, skipping and pausing, cat path collision, waiting for the player, fresh and saved rewards, workshop roaming, and repeated guide/rest/return cycles at 30/60/120 Hz. Truck checks cover its body, cab and extended lift gate, manual approaches, obstacle clicks and routes to and from every destination. Department checks cover all lighting cues, changing dialogue hints, construction timing at 30/60/120 Hz, manual stepping, pause/replay and calmer motion. Drafting-table checks also cover the exact four phases, shared projection and stable ground through 480 intermediate frames. Run `construction-ui.test.mjs` with the same `ADMIN_DOM_MODULE` setup as the editor integration tests for real-DOM control labels, touch entry, replay, repeated/manual selections, discovery persistence, hidden/unfocused/closed pauses and reduced motion. The admin checks exercise adding/relabeling/removing projects and categories, new photos, videos, metadata, missing content and filename replacement. Native Canvas renders check the pixel artwork and drawing performance; all three lighting looks and four construction steps have been visually reviewed.

Title lifecycle checks cover repeated entry, curtain timing, interrupted transitions, returning to the title, direct Work index, shared project links, reduced motion, saved discoveries and failed-load recovery. Editor integration checks also verify lossless import/export and mocked publishing success/failure.

No real publish was performed through the user's personal token during testing. The managed preview server started, but the cloud browser timed out before opening it; browser and physical iPhone touch QA remain unverified. GitHub Pages deployment is checked separately after the source push.

## Locked Decisions

Use the existing content and exact project credits. Keep photography readable inside the pixel-art world. Keep the work index accessible without walking. Preserve the custom domain and admin publishing workflow. Use the name alone as the title, with Construction Coordinator underneath. Keep all crew discoveries optional, with sound muted by default and reduced-motion support.

## Open Questions

Physical iPhone touch feel and final visual polish; whether individual projects should eventually get bespoke sets.

## Future Ideas

Remaining brainstorm ideas are parked: a suspiciously large door, a production-office directory, recurring incidents and a wrap photo. Additional map areas and project-specific props are separate design changes, rather than content-only admin edits.

The prior [HANDOFF.md](HANDOFF.md) describes the archived CRT interface. This document describes the current homepage. The separate private Sites prototype remains an earlier design snapshot; GitHub is now the source for this live release.

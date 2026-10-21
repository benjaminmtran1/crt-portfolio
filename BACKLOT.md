# The Backlot — live portfolio

The homepage is now an explorable pixel-art film set. The rebuilt Backlot Studio admin keeps the original content format and GitHub publishing workflow. No build step or package installation is required.

## Current Build

- Live site: https://benjamintran.ca
- Editor: https://benjamintran.ca/admin.html
- Publishing branch: `main` (the existing GitHub Pages configuration).
- `index.html` is the game frame. The implementation and original pixel artwork are in `backlot/`.
- `content.json` and `assets/` remain canonical. There is no generated image manifest to rebuild after edits. Images are the admin's existing 1920px maximum uploads.
- All project counts and category filters come from the current content. A new guide category appears in Work index automatically. The six physical map destinations keep their existing IDs.
- A separate, full-screen theatrical title scene opens each visit: oversized red italic-pixel **Benjamin Tran** lettering with **Construction Coordinator**, original soundstage artwork, Enter Backlot, a direct Work index option and optional sound. A short curtain transition enters the playable lot; calmer motion skips it. The name follows `site.heroName`; the requested title-screen role is fixed. Settings can return to the title screen. Shared project links open the project directly.
- Three pixel-art interpretations of actual portfolio builds rotate one at a time on the title soundstage: Deathstalker's mossy graveyard/gated ruin, Nintendo x Donkey Kong's rounded green SUBWAY entrance, and Beast Games' black-and-silver build filled with a stepped mound of green cash bundles. The two front-facing sets retain their original floor anchor; the isometric Beast build uses its own fitted placement and diamond-footprint contact shadow. Each holds for 8.5 seconds before a 650 ms lights-down, 240 ms fully hidden set swap and 650 ms relight. Previous/next and pause controls are optional; calmer motion keeps a static set with manual selection. Entry and Work index never wait on the scenic cycle.
- The playable character uses the approved About-portrait likeness: wavy dark hair, moustache/light stubble, silver nose hoop, blue-and-white striped overshirt, white tank, work trousers and boots. Four facings and the walking cycle preserve the existing ground anchor and collision. Ordering a craft coffee adds a takeaway cup for the current visit.
- The clapperboard beside the central avenue starts a 10.5-second scene: quiet on set, a lantern-carrying performer, a moving camera and a wrap. CUT or Escape skips it. Dialogs and background tabs pause it.
- Walk behind stages 01 and 02 through the northern service lane to reveal the timber backs, braces and sandbags. Inspect the small rear placards to open an illustrated cutaway and links to the current project galleries.
- Pet the gently strolling workshop cat, then follow it. It waits if you fall behind and leads to the white production cube truck beyond the prop garden, with its cargo bay open and lift gate lowered horizontally. Pet it there to earn a Crew Approved stamp. The stamp is saved, but the cat is free to roam: after a short rest it walks back to the workshop and can lead you again. Reloads start it at the workshop without resetting any discoveries. The truck and extended lift gate are solid scenery, with a clear interaction spot beside the rear.
- The lighting desk beside the central avenue offers **Work lights**, **Golden hour** and **Night shoot**, with a preview of the whole lot. The selected look is saved in this browser. A filmed take uses its own lighting, then returns to your chosen look.
- Stop at the white **Craft services** step-van on the western cross street for coffee, rotating crew chatter and hints that change with discoveries already found. The reference-inspired truck has a blank roof board, warm open serving hatch, fold-down counter and chrome-rimmed tyres. Click or tap anywhere on the truck to walk to its clear serving apron; the body, cab and counter are solid scenery. This is fictional in-game dialogue, separate from project credits and About content.
- The drafting table outside the workshop opens a 12-second miniature build: **Design → Mark out → Build → Shoot**. Plans are drawn on the pad, transferred to chalk, assembled into a framed and finished set, then filmed with a dolly camera and key light. Pad, plans, chalk, walls and equipment use one axonometric projection. Pause, resume, replay or inspect any step. Calmer motion disables autoplay and keeps every step available. Closing the window or switching away stops progression.
- Nine optional crew discoveries now persist in the existing browser save; previous cat rewards remain valid. Settings shows a small discovery count. Projects remain available through Work index at all times.

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
node backlot/checks/craft-truck.test.mjs
node backlot/checks/craft-render.test.mjs
node backlot/checks/departments.test.mjs
node backlot/checks/construction.test.mjs
node backlot/checks/title.test.mjs
node backlot/checks/title-showcase.test.mjs
node backlot/checks/title-showcase-ui.test.mjs
node backlot/checks/player.test.mjs
node backlot/checks/video.test.mjs
node --check backlot/app.mjs
```

The route checks cover every destination from the start and all destination pairs, collision, pause, manual override and movement at different frame rates. The crew checks cover every new prop route, timed takes, skipping and pausing, cat path collision, waiting for the player, fresh and saved rewards, workshop roaming, and repeated guide/rest/return cycles at 30/60/120 Hz. Truck checks cover its body, cab and extended lift gate, manual approaches, obstacle clicks and routes to and from every destination. Craft-truck checks cover its separate footprint, all-destination arrival/departure, vehicle-wide pointer targets, serving-cup animation, and unchanged CREW truck. Run `craft-ui.test.mjs` with the same `ADMIN_DOM_MODULE` setup for keyboard, click and touch entry, all existing conversation choices, discovery persistence, close/reopen and take isolation. Department checks cover all lighting cues, changing dialogue hints, construction timing at 30/60/120 Hz, manual stepping, pause/replay and calmer motion. Drafting-table checks also cover the exact four phases, shared projection and stable ground through 480 intermediate frames. Run `construction-ui.test.mjs` with the same `ADMIN_DOM_MODULE` setup as the editor integration tests for real-DOM control labels, touch entry, replay, repeated/manual selections, discovery persistence, hidden/unfocused/closed pauses and reduced motion. The admin checks exercise adding/relabeling/removing projects and categories, new photos, videos, metadata, missing content and filename replacement. Native Canvas renders check the pixel artwork and drawing performance; all three lighting looks and four construction steps have been visually reviewed.

Title showcase checks cover per-build floor anchoring, Beast side-foot and caption clearance, unchanged Deathstalker/Subway drawing, one plate per frame, full-dark swaps, timing, manual selection, pause/resume, reduced motion, resizing, finite Canvas coordinates and actual control wiring. Player checks cover portrait details, four facings, walking/stopped poses, scale, ground anchoring and unchanged NPC dispatch. Title lifecycle checks cover repeated entry, curtain timing, interrupted transitions, returning to the title, direct Work index, shared project links, reduced motion, saved discoveries and failed-load recovery. Editor integration checks also verify lossless import/export and mocked publishing success/failure.

No real publish was performed through the user's personal token during testing. The managed preview server started, but the cloud browser timed out before opening it; browser and physical iPhone touch QA remain unverified. GitHub Pages deployment is checked separately after the source push.

## Locked Decisions

Use the existing content and exact project credits. Keep photography readable inside the pixel-art world. Keep the work index accessible without walking. Preserve the custom domain and admin publishing workflow. Use the name alone as the title, with Construction Coordinator underneath. Keep all crew discoveries optional, with sound muted by default and reduced-motion support.

## Open Questions

Physical iPhone touch feel and final visual polish; whether individual projects should eventually get bespoke sets.

## Future Ideas

Remaining brainstorm ideas are parked: a suspiciously large door, a production-office directory, recurring incidents and a wrap photo. Additional map areas and project-specific props are separate design changes, rather than content-only admin edits.

The prior [HANDOFF.md](HANDOFF.md) describes the archived CRT interface. This document describes the current homepage. The separate private Sites prototype remains an earlier design snapshot; GitHub is now the source for this live release.


## Camera, crew and wrap — October 21 update

Current Build: A camera approached at (736,328) opens the three existing hand-drawn real-build plates (Deathstalker, Nintendo × Donkey Kong, Beast Games), with framed/pulled-back compositions and links resolved from current project titles. Jules the scenic painter, Frankie the carpenter and Kit the PA have three rotating fictional lines each. The bell approached at (392,640), or Kit’s dialogue, starts a 12-second dusk vignette with closing stage doors, departing crew, a resting cat and credits. Pause, manual next, replay, close and Work index remain available. Reduced motion starts on the final tableau without autoplay. New discoveries use the existing browser save (nine total).

Locked Decisions: Reuse the existing real-build pixel art. Crew dialogue is explicitly fictional and does not change production credits. No changes to content.json or the admin editor. Wrap is reversible and does not alter saved lighting or cat progress.

Open Questions: Full browser and physical iPhone visual/input QA remain pending; the local environment blocks opening a preview server and dependency downloads. Automated route, rendering-coordinate and application panel tests pass.

Future Ideas: More bespoke camera builds need a chosen project and one or two clear reference images. Remaining brainstorm ideas stay parked.

Validation: `node backlot/checks/encounters.test.mjs`, plus existing routes, life, departments, craft rendering and title showcase suites.

### Wrap collision correction

Crew departures now follow cached routes through the existing collision map, turn to face each segment, and walk through the raised entrance barrier. Movement is sampled by distance at a common speed; no straight-line interpolation through buildings remains. Absolute-time sampling preserves pause, chapter selection and replay without moving the live crew. All three leave before the credits.

Regression: `node backlot/checks/wrap-motion.test.mjs` samples every crew route at 30/60/120 Hz against every obstacle, checks the gate-only exit, speed, direction changes and completion, and verifies that the renderer uses those routes for normal motion, calmer motion, seeking and replay.


## Living backlot and field notebook — October 21 release

### Current Build

Prepared against production `d6ac006b86cdde0e710524cb4c56e916a31d04f2`. Ben approved the character artwork and notebook content, requested the pocket-notebook refinements below, and explicitly authorized publishing this revision.

- Jules mixes scenic paint and works on a braced practice flat; Frankie carries pine from his station toward the workshop; Kit makes walkie rounds beside production. They follow the existing collision grid, pause near visitors or when clicked, and resume after the visitor moves away. Dialogs, filming, background tabs and Calmer motion stop the routines.
- Original crew sprites have distinct silhouettes, hair, skin tones, clothing and kit: Jules has a curly bun, paint apron, palette and brush; Frankie has a knit cap, beard, denim and tool belt; Kit has a ponytail, headset, clipboard and radio; Mara at craft has a copper headwrap, glasses, cream apron and coffee. Matching portraits appear in conversations and the notebook. Existing fictional dialogue and project credits remain separate.
- The camera has a detailed film body, magazine, monitor, focus wheel, lens rings, matte box, support rails and tripod. The wrap bell has a weathered timber post, iron bracket, shaded brass, clapper and rope. Their ground footprints, the practice flat and lumber are part of the collision map. Static props remain visible in the lighting and wrap views.
- **Notebook** in the header, or **N**, opens Field notes. Save a project from its detail page; reopen or remove it under Saved work. Lot notes collects six visited places and the nine existing discoveries. Crew records introductions. The browser-local save is separate from the existing discoveries and editor content. Bookmarks use category/title identity, with a unique image fallback for renamed projects, rather than position in the editor. Removed or ambiguous projects are shown as unavailable.
- Wrap snapshots the crew's actual current positions, including mid-step, and routes everyone through the entrance without altering their live routine. Replay and chapter selection remain deterministic.

### Locked Decisions

The 20-project `content.json`, current media, “INSTALLS and Editorial” label, approved professional bio, title sequence, player likeness and admin are unchanged. No new production credits are invented. This release keeps the existing local-first save behavior. Ben explicitly authorized promotion to main after the requested pocket-notebook, camera-choice and Carpenter-title changes.

### Validation

- `node backlot/checks/living.test.mjs`: 90-second routines at 30/60/120 Hz, collision and speed bounds, job poses, approach/click waiting, Calmer motion, 45 different mid-routine wrap starts and interaction arrival.
- `node backlot/checks/notebook.test.mjs`: malformed storage, save/remove/reload, project reordering, deleted projects, rename recovery, ambiguous images and duplicates.
- Existing routes, life, wrap-motion, encounters, coffee and craft-render suites passed. Native Canvas renders visually reviewed the four crew designs and whole lot.
- Cloud Chromium checked the live title-to-lot entry, notebook empty state, project save and reload persistence, reopen, visited-place navigation, moving-crew conversation and introduction record, desktop layout and a 390 × 844 CSS viewport.

### Open Questions

Ben approved the crew artwork and the notebook content and structure. The pocket-notebook refinements below have automated coverage; a fresh visual browser check was blocked by the disconnected workspace. Physical iPhone touch feel and advancing hosted-video playback remain unverified; this revision does not change video code.

### Future Ideas

More camera builds need a selected real project and clear reference images. Other brainstorm ideas remain parked.


### Pocket notebook refinements

- Field notes is now a compact cloth-covered book with a stitched spine, layered paper edges, ruled pages and a ribbon. Saved work, Lot notes and Crew retain their content and section structure. The three sections each occupy one page: Saved work, Lot notes and Crew. Long lists scroll inside their page; the counter remains 1–3 regardless of saved builds or discoveries.
- Previous/Next controls, left/right arrow keys, section tabs and horizontal touch swipes change pages. Numbered leaves turn in the chosen direction. Calmer motion switches instantly, and older browsers without Web Animations fall back to an instant change.
- Page turns cancel when closing the notebook, changing to a project or other dialog, or requesting another page. Page changes do not alter bookmarks or introductions. The existing browser save and internal crew IDs remain compatible.
- Conversations no longer offer a camera-view button. The physical camera remains the way to look through the camera. Frankie's displayed title is **Carpenter**; his artwork and personality are unchanged.

Validation: `node backlot/checks/notebook-pages.test.mjs` covers complete pagination, the actual application markup and section changes, portraits/title wiring, both turn directions, instant fallback, reduced motion, rapid requests and cancelled/closed transitions. Its assertions and the existing notebook persistence suite passed in the available JavaScript runtime; changed application modules also passed syntax and import-target checks. The local workspace disconnected during this pass, so the final pocket-notebook styling and native touch behavior have not been freshly reviewed in a browser. Earlier browser and Canvas checks above apply to the preceding living-backlot revision.


### Notebook, camera and portrait corrections

Current Build: The pocket notebook has exactly three numbered pages, retaining its cover, paper styling, directional page turns, keyboard/swipe controls and existing saves. Lot notes includes all six places and nine discoveries; Crew includes all four people. The physical camera is now centred at (736,304) on Commercial’s forecourt, approached at (736,328). Its artwork, pointer silhouette and solid footprint derive from one location. The former central camera spot is clear. Conversations and notebook portraits call the current shared crew artwork directly, with explicit character IDs and refreshed asset URLs.

Locked Decisions: Keep the approved crew designs, Carpenter title, notebook content, portfolio data and admin unchanged. The camera-view interaction remains on the physical camera.

Validation: Notebook pagination and persistence suites passed, including three pages with 0–100 saved projects, complete contents, both turn directions and cancellation. Encounter checks passed all-stage camera approaches at 30/60/120 Hz, the new/old pointer targets and footprint, all four conversation portrait IDs, viewfinder compositions and dialogue rotation. Existing doorway routes, living crew, wrap motion and craft rendering suites passed. Native Canvas produced four distinct current crew portraits. Cloud Chromium reviewed all three notebook pages, the relocated camera and its nearby viewfinder entry, Commercial access, and the updated Jules conversation.

Open Questions: Physical iPhone touch and advancing hosted-video playback remain unverified. No video code changed.

Future Ideas: Unchanged; other brainstorm ideas remain parked.

## Lot cleanup — October 21 review

### Current Build

This review starts from production commit `409c566dda862bf4b370fe0fa5584de52f4c21fd`. It opens the main avenue without changing the 960 × 720 map or the viewing scale. The two central crates form a storage cluster beside Narrative; the call sheet is smaller and stands beside Production. Lumber, drafting and Frankie share the workshop apron. The clapper joins the Commercial camera area, and Jules's mixing pot and practice flat sit farther along the eastern edge. Redundant loose stacks, two cross-street cones, the freestanding chair/table and the decorative boom have been removed. Road texture has lower contrast and density.

The desktop featured-project monitor starts as a 94 px compact strip, retaining its image, project name, cycling and direct project entry. Its labelled +/− button restores or collapses the 200 px preview. The existing touch-device behavior remains in place.

### Locked Decisions

Keep the approved camera location in front of Commercial, the crew artwork and Carpenter title, three-page notebook, all discoveries and portfolio/admin data. All 20 projects, media and the approved biography match production. The relocated solid props use the same coordinates for drawing and collision; crew routines use their work-area anchors. This is a private review pending visual approval, following the project brief; production main has not been promoted.

### Validation

Passed existing doorway routing, life, living crew, wrap motion, encounters, craft truck and craft rendering suites, plus application syntax. Checks cover all six destinations, relocated prop approaches, cat loops, 90-second crew routines and 45 mid-routine wrap starts, including 30/60/120 Hz collision checks. Desktop Chromium reviewed the open avenue and grouped work areas, monitor expansion/collapse, featured-project cycling and opening a project. Preview files were compared with source, and portfolio content/media were compared with production.

### Open Questions

Ben's visual review of the new spacing; physical iPhone touch feel remains unverified. No video or admin behavior changed.

### Future Ideas

Only consider widening the cross street if this placement pass still feels tight. Other ideas stay parked.

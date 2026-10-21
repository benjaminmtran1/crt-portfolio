# The Backlot — live portfolio

The homepage is now an explorable pixel-art film set. The original admin and content format remain the publishing workflow. No build step or package installation is required.

## Current Build

- Live site: https://benjamintran.ca
- Editor: https://benjamintran.ca/admin.html
- Publishing branch: `main` (the existing GitHub Pages configuration).
- `index.html` is the game frame. The implementation and original pixel artwork are in `backlot/`.
- `content.json` and `assets/` remain canonical. There is no generated image manifest to rebuild after edits. Images are the admin's existing 1920px maximum uploads.
- All project counts and category filters come from the current content. A new guide category appears in Work index automatically. The six physical map destinations keep their existing IDs.
- A 1990s game title screen opens each visit: **Benjamin Tran** with **Construction Coordinator**, Press Start, a direct Work index option and optional sound. The name follows `site.heroName`; the requested title-screen role is fixed. Settings can return to the title screen. Shared project links open the project directly.
- The clapperboard beside the central avenue starts a 10.5-second scene: quiet on set, a lantern-carrying performer, a moving camera and a wrap. CUT or Escape skips it. Dialogs and background tabs pause it.
- Walk behind stages 01 and 02 through the northern service lane to reveal the timber backs, braces and sandbags. Inspect the small rear placards to open an illustrated cutaway and links to the current project galleries.
- Pet the workshop cat, then follow it. It waits if you fall behind and leads to a small crew corner beyond the prop garden. Pet it there to earn a Crew Approved stamp. The stamp and the cat's new resting place are saved in this browser.

## Updating the site

Open the editor. Use owner **benjaminmtran1**, repository **crt-portfolio**, branch **main**, and your existing valid GitHub token with Contents read/write. The token stays in your browser and is not included in the source.

Edit projects or add media, then choose **PUBLISH TO GITHUB**. The existing editor uploads pending files to `assets/` and commits `content.json`. GitHub Pages publishes that commit. Reload the portfolio after deployment completes. Publishing also stamps `site.updatedAt`, so a replacement image using the same filename gets a fresh URL.

Supported in the Backlot:

- Project titles, descriptions, role/tags, images, captions, paragraphs, extra info fields, project order and gallery order.
- New projects, deletions, new image uploads and replacement images. Missing images show a clapper placeholder.
- YouTube and Vimeo links, local MP4/WebM gallery videos, externally hosted images and category reel links.
- Category labels and subheadings, browser title, hero/title-screen name and the in-game header role line. The old SIGNAL welcome paragraph is superseded by the title screen.
- About portrait, name, role, biography and slate; Contact rows.

Map location IDs: `narrative`, `commercial`, `reality`, `installation`, `about`, `contact`. Keep these IDs when editing the existing destinations. New guide categories are immediately available in Work index; creating another building or changing the map requires a code update. Non-guide custom/process channels, television timeslots, test bars, the old SIGNAL carousel and other CRT-specific effects do not drive the game map.

## Rollback

The old homepage is preserved in branch `archive/crt-before-backlot-2026-10-20`, at commit `fd991678b2fef974df1ff62a26be47715133df02`. Reverting the Backlot release commit restores the former homepage without erasing newer repository history. The `CNAME` file and original project media were preserved.

## Validation

```sh
node backlot/checks/routes.test.mjs
node backlot/checks/admin-compat.test.mjs
node backlot/checks/life.test.mjs
node --check backlot/app.mjs
```

The route checks cover every destination from the start and all destination pairs, collision, pause, manual override and movement at different frame rates. The crew checks cover every new prop route, timed takes, skipping and pausing, cat path collision, waiting for the player, and saved rewards. The admin checks exercise adding/relabeling/removing projects and categories, new photos, videos, metadata, missing content and filename replacement. Native Canvas renders check the pixel artwork and drawing performance.

No real publish was performed through the user's personal token during testing. Browser automation and physical iPhone touch QA remain unverified. GitHub Pages deployment is checked separately after the source push.

## Locked Decisions

Use the existing content and exact project credits. Keep photography readable inside the pixel-art world. Keep the work index accessible without walking. Preserve the custom domain and admin publishing workflow. Use the name alone as the title, with Construction Coordinator underneath. Keep the three crew discoveries optional, with sound muted by default and reduced-motion support.

## Open Questions

Physical iPhone touch feel and final visual polish; whether individual projects should eventually get bespoke sets.

## Future Ideas

Additional map areas and project-specific props. These are separate design changes, rather than content-only admin edits.

The prior [HANDOFF.md](HANDOFF.md) describes the archived CRT interface. This document describes the current homepage. The separate private Sites prototype remains an earlier design snapshot; GitHub is now the source for this live release.

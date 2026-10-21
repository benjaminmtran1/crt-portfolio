# Backlot Studio editor

`admin.html` is the same content.json + assets/ publishing tool, with a Backlot-specific editing surface. `backlot/admin.css` is isolated from the public portfolio styles. It needs no application build or runtime dependency.

## Everyday workflow

1. Open `/admin.html`. Work categories appear first, with project counts.
2. Open a project to edit title, role, short description, cover, gallery or film links. Write-ups and extra credits are optional disclosures.
3. The first project in each category is featured. Arrow buttons change the order; project search only filters the editor view.
4. About, Contact and Site identity use the same canonical fields as before.
5. Export a draft for a local backup, or publish through the existing GitHub connection. Nothing publishes while typing. Unpublished edits trigger a leave-page warning.

Import replaces the current draft only after confirmation when there are unpublished changes. Invalid files are rejected before replacing the draft. Successful import clears the previous draft's queued media, while canceled or invalid imports leave both intact. Edits are not automatically saved to browser storage.

## Field audit against the live runtime

The audit uses `backlot/content.mjs` (`normalizeContent`, `galleryFor`, `watchLinks`, `featuredProjects`) and `backlot/app.mjs` (`contentLoaded`, `openIndex`, `openProject`, `openAbout`, `openContact`). No data migration is performed.

| Existing field | Runtime use | Editor treatment |
| --- | --- | --- |
| site.pageTitle | Browser document title | Site identity |
| site.heroName | Entrance title, header, identity/accessibility text | Site identity; preserved verbatim in JSON |
| site.updatedAt | Media cache revision | Still automatically stamped only by publishing |
| SIGNAL sub | In-game header role | Site identity |
| SIGNAL label, paragraphs, carousel[].src/caption, showTestBars | Old CRT interface only | Closed Legacy fields disclosure |
| Guide label | Category/filter and mapped location name | Category settings |
| Guide sub | Location/index description | Category settings |
| Guide title | Location/index eyebrow | Category settings, relabeled Location eyebrow |
| Guide reel.kind | `none` hides category reel | Optional Category reel disclosure |
| Guide reel.src/caption | Category reel link and label | Optional Category reel disclosure |
| projects[].title | Project card, title, search and accessible media labels | Project title |
| projects[].tags | Role/credits in card, detail and search | Relabeled Your role / credits |
| projects[].desc | Short text in project detail | Short description, optional |
| projects[].image/caption | First gallery item and caption; first available photo is thumbnail | Cover media/caption |
| projects[].writeup | Paragraphs in project detail | Optional Write-up & extra details disclosure |
| projects[].meta[].k/v | Key/value project facts | Optional extra details |
| projects[].gallery[].src/caption | Photos, local MP4/WebM, external photos, YouTube/Vimeo embedded players and labels | Gallery & film links, upload/link/batch/reorder controls retained |
| projects[].time | No Backlot use | Closed Legacy fields disclosure if already present; not created for new projects |
| About label | Mapped destination label | Optional Map label disclosure |
| About sub | About headline | Relabeled About headline |
| About name/role | About identity and eyebrow | Main About fields |
| About portrait.src | Portrait | Main About media control |
| About paragraphs[] | Biography paragraphs | Biography |
| About slate[].k/v | About key/value facts | At-a-glance details disclosure |
| About title, portrait.caption | No Backlot use | Closed Legacy fields disclosure |
| Contact label | Mapped destination label | Optional Map label disclosure |
| Contact sub | Contact eyebrow | Relabeled Contact eyebrow |
| Contact rows[].k/label/href | Contact type, display text and destination | Main Contact link fields |
| Contact title, tx[].k/v, note | No Backlot use | Closed Legacy fields disclosure |
| Other hero/profile/contact sections, process title/sub/label and steps[].timecode/text/image/caption, custom title/sub/label and blocks[].kind/text/caption/src/videoKind | No mapped Backlot destination | Archive navigation, original legacy editors retained |
| Section id/type | IDs connect six physical destinations; guide type supplies Work index | Preserved; IDs not editable. New guide categories use unique IDs and appear in Work index, not as new buildings |
| Section/project/gallery ordering | Work index/filter order, featured project, gallery order | Existing ordering retained; structure controls placed away from everyday editing |
| Unknown properties, unknown section types | Potential future/legacy data | Preserved without normalization. Unsupported section type gets a read-only explanation |
| GitHub owner/repository/branch/token/remember | Existing direct GitHub Contents API workflow | Folded into Publish; unchanged localStorage keys, opt-in token behavior and GitHub request mechanics |

The actual title-screen credit remains `Construction Coordinator`; the Site identity role control labels its narrower in-game-header effect. Contact's main invitation remains runtime copy rather than pretending the unused legacy title controls it. No content.json, media, map ID, credit, authentication, permission or security setting is changed by the overhaul.

## Validation

Existing runtime regression suites remain unchanged. The new editor test uses LinkeDOM solely as a development-time DOM harness; it is not shipped to the browser:

```sh
npm install --prefix /tmp/backlot-admin-tests --cache /tmp/backlot-admin-tests/npm-cache linkedom --ignore-scripts --no-audit --no-fund
ADMIN_DOM_MODULE=/tmp/backlot-admin-tests/node_modules/linkedom node backlot/checks/admin-editor.test.mjs
node backlot/checks/admin-compat.test.mjs
```

The editor suite exercises lossless load/navigation/import/export, unknown and legacy fields, single-field-only mutation, repeated expand/collapse, reorder persistence, project/gallery CRUD, new guide categories, site/About/Contact edits, sparse legacy sections, canceled and malformed imports, label/control associations, and mocked GitHub media/content ordering, successful publish, failure/retry state and opt-in token storage. It makes no real GitHub writes and uses no real token.

Local native Chromium was unavailable because the execution sandbox disallowed its required socket. The cloud browser also could not open the local preview. Native browser visual and interaction checks are therefore separate from these DOM/data checks and must be performed against the deployed revision. Physical-phone testing is not claimed.

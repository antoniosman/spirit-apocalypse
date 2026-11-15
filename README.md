# The Spirit Apocalypse — 1.3.0

[Play](https://antoniosman.github.io/spirit-apocalypse/)

A six-episode survival story in the Spirit Universe, with 26 playable cast members, local play for 1–3 people, and 100 authored optional encounters.

New stories support solo, separated, together and three-player 2+1 starts. Each physical group has its own people, location, inventory and persistent shelters. Radio contact does not merge groups. Meeting, pooling resources, choosing a common home and separating again are real story decisions.

RELATIONSHIPS distinguishes affinity from trust and lets you inspect either direction for each playable character. Unknown people have no displayed percentage. Major choices use portraits, confirmation and a cinematic consequence before the story continues. Injuries, amputations, deaths, missing people, shelters and random outcomes persist through save/load and all six episodes.

## Saves

Autosave, three manual slots and JSON export/import are available. Previous version-1 saves remain playable with their original story engine and show an explanatory notice. Start a new story to use the independent-group campaign; existing progress is not silently reset or assigned a made-up past.

## Episode intros

The opening plays the supplied intro music from 0:54 to 1:30. The first player appears at 1:05; the other selected players follow in order. NPCs recruited into groups enter the credits from the next episode, each with the same solo portrait framing as the players. NPC credit duration adapts to fit everyone within 36 seconds, followed by the existing title reveal. Six establishing images rotate by episode without repeating an establishing image in one opening.

Use ▶ INTRO in the header or in a manual save slot, then select an episode. Replay leaves the current story, choices and save untouched. New episodes record their opening cast so later events cannot alter past intros. Older saves without recorded opening credits show the selected protagonists and explain the missing history.

## Install and updates

Use INSTALL APP; on iPhone use Safari → Share → Add to Home Screen. Browser and installed-app storage can differ; export/import transfers progress. OFFLINE READY confirms that every local portrait, cinematic image and audio asset is cached.

Updates check at launch, on returning, after reconnection and every 15 minutes. ↻ checks immediately. An update saves progress and waits for cinematics, save/load, relationships and confirmation dialogs before applying.

## Development

No dependency installation is needed. Use Node 22+ and Python 3:

```sh
node tests/engine.cjs
node tests/campaign.cjs
node tests/intro.cjs
node tests/view.cjs
python scripts/prepare-release.py --dist
python -m http.server 4173 --directory dist
```

The preparation script fingerprints assets and generates `release.js`, `version.json`, `sw.js` and `dist`. GitHub Actions runs all four test suites and publishes `dist` on pushes to `main`.

`campaign.js` owns version-2 state and deterministic outcomes; `campaign-ui.js` renders it. The original `app.js` / `season.js` engine remains for legacy saves. `campaign-validation.js` checks identity links, voting and scene caches; the shared save dialog handles both formats.

See `CHANGELOG_1_3.md`, `QA_1_3.md`, previous changelogs and QA notes, `ICON_PROMPT.md` and `ASSET_NOTES.md`. This remains a beta narrative game; automated tests do not certify every possible story combination or replace tests on physical phones.

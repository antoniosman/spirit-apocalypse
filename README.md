# The Spirit Apocalypse

Six-episode, browser-based survival story in the Spirit Universe.

[Play](https://antoniosman.github.io/spirit-apocalypse/)

Choose 1–3 local players, watch or skip the cinematic opening, and decide who survives. Save automatically, use three manual slots, or export/import a save to transfer it between devices. Install the game from the install button; on iPhone, use Safari → Share → Add to Home Screen.

The app checks for updates at launch, every 15 minutes while open, when returning to the app, and when connectivity returns. The ↻ button checks immediately. Updates save the current game and reload automatically, waiting for cinematics and open dialogs to finish. Offline assets include every portrait, cinematic image and original audio file. Local saves are separate from the asset cache and survive updates.

## Development

No package installation or build framework is required. Use Python 3 and Node 22+:

```sh
node tests/engine.cjs
python scripts/prepare-release.py --dist
python -m http.server 4173 --directory dist
```

`prepare-release.py` fingerprints runtime assets and generates `release.js`, `version.json`, and `sw.js`. Run it after editing source; `--dist` prepares the deployable game. GitHub Actions runs continuity tests, prepares these files and publishes the `dist` artifact on every push to `main`. Configure Pages to use GitHub Actions.

## This update

- Custom app icon with dedicated iOS touch icon, Android maskable icon and favicon. Generated with built-in ImageGen, based on the existing game's gold/copper eclipse branding; source is `icons/app-source.png`.
- Install instructions contain only player-facing steps.
- Automatic updates with preserved state and a manual check button.
- Stable cached scene details and RNG state across redraws, voting and save/load.
- Split-screen rescue choices with matching names, portraits and saved targets.
- Imported and automatic saves share schema/content validation. Failed storage writes report an error.
- Starting character selection preserves the previous autosave until a new game starts.
- Exiling the accused after the scripted betrayal targets the recorded suspect when present.
- Canonical character genders and Greek grammatical helpers copied from Spirit Slasher v1.26.0; all 26 cast cards display the corresponding she/her or he/him pronouns. Named dialogue and outcome text use the same metadata.

The large requirements document also describes further story expansion, separate-player starts, and a persistent shelter simulation. Those are future design work; this update audits and repairs the existing engine and does not claim to implement that entire document.

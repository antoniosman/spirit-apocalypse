# Visual and audio provenance

The existing cast portraits, title logo, city/forest images and three audio files were retained from the supplied game. The final cinematic logo-rendering branch is unchanged. No YouTube footage or audio was downloaded or embedded.

The extra opening image `assets/cinematic/clinic-dusk.webp` was created with the built-in ImageGen tool and exported to WebP. Prompt:

> Original cinematic establishing shot for a serious zombie-apocalypse interactive drama, no text no people no brands: abandoned small-town emergency clinic reception at blue hour, broken entrance glass, empty stretchers, scattered papers suggesting a sudden evacuation, one amber emergency lamp, distant fog outside, faint rain, dark forest-green and copper-gold palette, restrained film grain, atmospheric photorealistic 35mm cinematography. Very wide landscape composition 16:9, usable for slow camera pan opening credits, no gore, no creatures visible, do not imitate any specific film or TV shot.

The user supplied `intro_music_apocalypse.mp3` locally. The deployed copy, `assets/audio/intro-music-apocalypse.mp3`, is trimmed at source time 1:30; playback starts at 0:54 and ends at 1:30, for a 36-second opening. The first player credit begins at source time 1:05 (11 seconds into playback); additional selected players follow in order. Recruited NPCs join the following episode's recorded credits. No audio was downloaded from YouTube. The supplied ambient theme and death sting remain in use. The major-choice cue is synthesized locally by authored Web Audio code. This update did not independently audit the licensing history of the supplied assets.

App icon provenance remains in `ICON_PROMPT.md`. Gender/pronoun metadata remains the canonical Spirit Slasher mapping in `character-data.js`.

Version 1.3 adds three original ImageGen establishing shots, each generated separately and converted to 1600×900 WebP: `railway-platform.webp`, `flooded-underpass.webp`, and `radio-tower.webp`. Prompts requested abandoned railway platforms at misty sunrise, an empty flooded road underpass at blue hour, and a lonely wooded-ridge emergency radio tower after sunset. Shared direction: photorealistic 35mm film still, subtle grain, dark forest-green shadows and muted copper highlights, wide cinematic perspective, no people, text, logos, watermark or gore. Source generation files remain in the local Codex generated-images folder; project assets are bundled locally for offline use.

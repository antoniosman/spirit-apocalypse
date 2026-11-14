# 1.2.0 — Episode intro music and replay

- Play the user-provided intro music from source 0:54 to 1:30. The deployed audio ends at 1:30 and excludes the final nine seconds of the original file.
- Synchronize every credit to the audio clock, including buffering. The first selected player appears at source 1:05, followed by players two and three at 1:08 and 1:11 when present.
- Record opening cast per episode. NPCs recruited during an episode enter the next episode's credits; merely encountering someone does not add them. Later deaths and discoveries do not rewrite earlier intros.
- Include all eligible cast, with supporting portraits in groups of up to six, while preserving the existing title reveal.
- Add ▶ INTRO in the header and each occupied manual save slot. Choose an episode and replay without loading that slot or changing the active story, choices, random seed or saved progress.
- Explain missing historical cast in older saves and show only the selected protagonists for those historical episodes.
- Cache the new audio and intro assets for offline playback. Keep app updates pending during the replay menu and cinematic.

Validation is recorded in `QA_1_2.md`.

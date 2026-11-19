# makefun-gta6-cover
[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/devsky-66/makefun-gta6-cover/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/devsky-66/makefun-gta6-cover/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Vice Cover Maker is an offline single-page app that turns your photos into a GTA 6 style multi-panel cover: upload photos, pick one of five layouts (Hero + 3, Four-square, Full bleed, Tilted snaps, Nine-grid) and one of five tones (Sunset, Neon, Vice City, Gold, Night), drag to reposition and scroll to zoom each panel, then export a polished PNG in 1080×1080, 1080×1350 or 1920×1080. Titles use the vendored Anton display face with a neon Pacifico subtitle, plus film grain and a vignette for that Vice City glow. Everything runs locally with zero network requests — fonts and sample photos ship inside `app/`.

## Run it

```
python3 -m http.server 8000 --directory app
```

Then open http://localhost:8000 — try `?shot=cover` for a full-bleed rendered cover, or `?shot=editor` for the editor with the sample photos pre-loaded.

<sub>Entered on [make.fun](https://make.fun/?ref=n7sgwxe5&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>

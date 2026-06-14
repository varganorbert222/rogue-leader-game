# Binary game assets

This folder contains **large media only** — models (`.glb`), audio (`.wav`, `.ogg`, `.mp3`), textures (`.png`), etc.

Configuration and manifests live in [`data/`](../data/) (versioned in git). This tree is **not** versioned in git — it is packaged into a GitHub Release zip and extracted here to avoid git LFS.

## Expected layout

```
assets/
  models/ships/…
  models/props/…
  audio/sfx/…
  audio/music/…
  textures/skybox/…
```

After extracting the release zip, run `npm run start` from the repo root.

## Download release assets

See root [`README.md`](../README.md) or [`docs/ASSETS_CHECKLIST.md`](../docs/ASSETS_CHECKLIST.md):

```bash
npm run assets:fetch
```

URL: `scripts/fetch-assets.config.json`. Override: `ASSETS_ZIP_URL=… npm run assets:fetch`

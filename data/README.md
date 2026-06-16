# Runtime game data (JSON manifests & config)

Version-controlled configuration served at `/data/` by the Angular dev server and production build.

| Path | Purpose |
|------|---------|
| `manifest.json` | Ship/prop LOD paths, axes, anchors, flight stats |
| `combat.json` | Targeting, radar, player ammo defaults |
| `npc-behavior.json` | NPC state machine tuning |
| `weapons/manifest.json` | Weapon definitions, VFX profiles |
| `audio/manifest.json` | Music sets, SFX library registry |
| `audio/libraries/` | Clip playback rules (volume, cooldown, registry refs) |
| `audio/sfx/registry.json` | Auto-generated SFX file lists (`npm run audio:registry`) |
| `dev/particle-editor/` | Particle effect presets and texture catalog (dev editor) |
| `dev/lod-editor/ships/` | Per-model LOD overrides (dev editor) |
| `dev/cockpit-editor/ships/` | Per-ship cockpit overrides (dev editor) |

Binary media (GLB, WAV, PNG, …) live in `assets/` and are distributed via GitHub Release zip — run `npm run assets:fetch` (see root `README.md` or `docs/ASSETS_CHECKLIST.md`).

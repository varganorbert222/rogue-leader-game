# Audio assets

Binary SFX files live under `assets/audio/sfx/`. Manifests and clip definitions live under `data/audio/` (versioned in git).

## Folder layout

```
assets/audio/
  sfx/                    # WAV/OGG source files (release zip)
    asteroid/
    bullet/
    …
  music/                  # MP3 stems (release zip)

data/audio/
  manifest.json           # Master registry + music sets
  libraries/              # Semantic clip definitions
    sfx.json
    ui.json
  sfx/
    registry.json         # Auto-generated file lists (npm run audio:registry)
```

## Adding new sounds

1. Drop files into the matching `assets/audio/sfx/<category>/` folder (`.wav` preferred; `.ogg` / `.mp3` also work).
2. Run `npm run audio:registry` — scans `assets/audio/sfx`, writes `data/audio/sfx/registry.json`.
3. Wire semantic clip ids in `data/audio/libraries/sfx.json` (or add a `registry` key pointing at a new group).
4. Reference clip ids from weapons manifest, game events, or UI code.

## Clip groups (registry)

| Group | Folder | Pattern |
|-------|--------|---------|
| `asteroid/explosion` | asteroid/ | splash |
| `bullet/hit` | bullet/ | `_hit_` |
| `bullet/whoosh` | bullet/ | `_whoosh_` |
| `cannon/rebel` | cannon/ | `rebel_cannon_` |
| `cannon/imperial` | cannon/ | `imperial_cannon_` |
| `explosion/fighter` | explosion/ | `fighter_explosion_` |
| `projectile/missile_hit` | projectile/ | `missile_hit_` |
| `xwing/engine`, `tie_fighter/engine` | ship folders | `*_engine` |
| `xwing/inbound`, `tie_fighter/inbound` | ship folders | `*_inbound_` |
| `ui/*` | ui/ | filename stem |

## In-game wiring

- **Cannon fire / hit** — weapons manifest `audio.fire` / `audio.hit`
- **Bullet whoosh** — enemy projectile passes within ~16 units of player
- **Ship inbound** — hostile NPC closes within ~155 units while approaching
- **Fighter / asteroid explosion** — NPC destroy vs meteor destroy
- **Engine loop** — player ship id → `xwing_engine` / `tie_fighter_engine`

## Music

Export calm + combat stem pairs per mission; reference via `musicSetId` in mission JSON.

## Production

Target format: **WAV only**. The registry generator already prefers WAV when multiple formats exist for the same stem.

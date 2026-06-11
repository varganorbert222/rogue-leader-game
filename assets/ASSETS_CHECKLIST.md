# Asset drop-in checklist

Place files exactly as listed. Restart `npm run start` after adding assets.

## Ships (GLB + fire/engine empties)

- [ ] `models/ships/xwing/xwing_LOD0.glb`
- [ ] `models/ships/xwing/xwing_LOD1.glb`
- [ ] `models/ships/xwing/xwing_LOD2.glb`
- [ ] `models/ships/tie_fighter/tie_fighter_LOD0.glb`
- [ ] `models/ships/tie_fighter/tie_fighter_LOD1.glb`
- [ ] `models/ships/tie_fighter/tie_fighter_LOD2.glb`

**Ship axes** — visual export correction only (`assets/manifest.json`, does not affect flight/physics):

```json
"axes": {
  "forward": "+z",
  "right": "+x",
  "up": "+y",
  "mirror": "+x",
  "invertForwardRoll": false
}
```

| Field | Role |
|-------|------|
| `forward` / `right` / `up` | Export axis alignment (visual pivot rotation). `up` optional. |
| `mirror` | Optional — negate scale on this model-space axis. |
| `invertForwardRoll` | Optional — flip sign of cosmetic yaw-bank on visual forward roll axis. |

Axis values: `+x`, `-x`, `+y`, `-y`, `+z`, `-z`. Visual pivot only — no re-export needed.

**LOD** — per ship/prop in `assets/manifest.json` (Unity-style screen %, defaults applied when omitted):

```json
"lod": [
  "models/ships/xwing/x-wing_LOD0.glb",
  "models/ships/xwing/x-wing_LOD1.glb",
  "models/ships/xwing/x-wing_LOD2.glb"
]
```

Shorthand above = all-manual. Full config (manual + auto mix, per-level):

```json
"lod": {
  "mode": "mixed",
  "levels": [
    "models/ships/xwing/x-wing_LOD0.glb",
    "models/ships/xwing/x-wing_LOD1.glb",
    { "auto": 0.35 }
  ],
  "screenThresholds": [50, 20],
  "cullScreenPercent": 2
}
```

| Field | Role |
|-------|------|
| `mode` | `manual` / `auto` / `mixed` / `none` (default: infer from `levels` or `paths`) |
| `levels` | Per-level manual path string or `{ "auto": 0.5 }` quality (0–1) |
| `paths` | Legacy ordered manual GLB list |
| `screenThresholds` | Switch to lower LOD when screen coverage drops below each % (default: 60, 27, 12… for N levels) |
| `cullScreenPercent` | Hide mesh below this screen % (default `2`) |
| `basePath` | Single GLB for `none` or full-auto base |
| `autoQualities` | Qualities for full-auto extra levels (default `0.55, 0.3, 0.12`) |

Missing manual LOD files fall back to the last successfully loaded level. Auto LOD is generated from the last available source at mission load (preload screen shows status). `mode: "none"` loads one GLB (`basePath` / first `paths` entry) with cull only.

**Blender transform anchors** (empty objects; local +Z = muzzle / exhaust):

| Kind | Naming | Example |
|------|--------|---------|
| Engine pylon | `engine_{NN}` | `engine_01`, `engine_02` |
| Laser mount | `weapon_laser_{NN}` | `weapon_laser_01`, `weapon_laser_02` |
| Projectile mount | `weapon_projectile_{NN}` | `weapon_projectile_01` |
| Typed projectile | `weapon_{behavior}_{NN}` | `weapon_missile_01` |

All detected mounts are used automatically. Per-slot weapon/VFX overrides go in `assets/manifest.json` → `anchors.weapons` / `anchors.engines`; otherwise `defaultWeapons` applies (e.g. every `weapon_laser_*` → `rebel_laser`).

Legacy (still supported): `fire_left_01`, `engine_left`, `engine_right`.

Weapon behavior (bomb, homing missile, disabling laser, rebel/imperial visuals) is configured in `assets/weapons/manifest.json` and bound per ship slot in `assets/manifest.json`.

## Props

- [ ] `models/props/meteor/meteor_01.glb` … `meteor_05.glb` (list every variant in manifest)

```json
"meteor": {
  "variants": [
    "models/props/meteor/meteor_01.glb",
    "models/props/meteor/meteor_02.glb"
  ],
  "scale": [0.8, 2.5],
  "colliderRadius": 3.0
}
```

`variants` — explicit GLB paths; each is preloaded once, spawn picks randomly (every variant at least once per field). Omit `variants` for a single-model prop (`lod` or placeholder).

## Skybox (Asteroid Field — space)

- [ ] `textures/skybox/asteroid_field_space/px.jpg`
- [ ] `textures/skybox/asteroid_field_space/nx.jpg`
- [ ] `textures/skybox/asteroid_field_space/py.jpg`
- [ ] `textures/skybox/asteroid_field_space/ny.jpg`
- [ ] `textures/skybox/asteroid_field_space/pz.jpg`
- [ ] `textures/skybox/asteroid_field_space/nz.jpg`

## Music

- [ ] `audio/music/menu_loop.mp3`
- [ ] `audio/music/asteroid_field_combat.mp3`

## SFX (MVP minimum)

- [ ] `audio/sfx/laser_fire.mp3`
- [ ] `audio/sfx/laser_hit.mp3`
- [ ] `audio/sfx/explosion_small.mp3`
- [ ] `audio/sfx/player_damage.mp3`
- [ ] `audio/sfx/meteor_impact.mp3`
- [ ] `audio/sfx/shield_hit.mp3`
- [ ] `audio/sfx/boost.mp3`
- [ ] `audio/sfx/ui_click.mp3`
- [ ] `audio/sfx/ui_confirm.mp3`

When complete, browser console should show **no** `[Assets] missing` warnings on mission load.

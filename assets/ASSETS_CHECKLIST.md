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

- [ ] `models/props/meteor/meteor_01.glb` … `meteor_XX.glb` (numbered variants)

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

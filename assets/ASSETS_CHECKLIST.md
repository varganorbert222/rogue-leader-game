# Asset drop-in checklist

Place files exactly as listed. Restart `npm run start` after adding assets.

## Ships (GLB + fire/engine empties)

- [ ] `models/ships/xwing/xwing_LOD0.glb`
- [ ] `models/ships/xwing/xwing_LOD1.glb`
- [ ] `models/ships/xwing/xwing_LOD2.glb`
- [ ] `models/ships/tie_fighter/tie_fighter_LOD0.glb`
- [ ] `models/ships/tie_fighter/tie_fighter_LOD1.glb`
- [ ] `models/ships/tie_fighter/tie_fighter_LOD2.glb`

**Blender empties:** `fire_left_01`, `fire_right_01`, `engine_left`, `engine_right`, etc.

## Props

- [ ] `models/props/meteor/meteor_LOD0.glb`

## Skybox (Hoth space)

- [ ] `textures/skybox/hoth_space/px.jpg`
- [ ] `textures/skybox/hoth_space/nx.jpg`
- [ ] `textures/skybox/hoth_space/py.jpg`
- [ ] `textures/skybox/hoth_space/ny.jpg`
- [ ] `textures/skybox/hoth_space/pz.jpg`
- [ ] `textures/skybox/hoth_space/nz.jpg`

## Music

- [ ] `audio/music/menu_loop.mp3`
- [ ] `audio/music/hoth_space_combat.mp3`

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

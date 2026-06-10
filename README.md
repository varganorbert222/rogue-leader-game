# Rogue Leader — WebGPU flight game

Angular 19 + Babylon.js 7 monorepo. MVP mission: **Asteroid Field (Space)**.

## Requirements

- Node.js 20 LTS or newer
- npm 10+

## Quick start

```bash
cd rogue-leader-game
npm install
npm run start
```

Open http://localhost:4200

## Controls

Based on **Rogue Squadron 3D (PC)** and **Rogue Leader (GameCube)** defaults.

### Keyboard (Rogue Squadron PC)

| Key | Action |
|-----|--------|
| ↑ / ↓ / ← / → | Pitch / yaw |
| W | Thrust (accelerate) |
| S | Brake (hold — slows to minimum speed, never stops) |
| Q / E | Roll left / right |
| Space | Fire lasers |
| Alt | Secondary weapon |
| Shift | Boost |
| X | Toggle chase / cockpit camera (Rogue Leader) |
| F1–F4 or `~` | Cycle outside camera (standard / close / far) |
| Z | Drop camera |
| Page Up / Down | Chase camera distance |
| `[` / `]` | Orbit camera |
| Tab | Look around (cockpit) |
| Esc | Pause |
| M | Mute |

### Gamepad (Rogue Leader / GameCube layout)

| Control | Action |
|---------|--------|
| Left stick | Fly (pitch / yaw) |
| Z + left stick L/R | Roll |
| R trigger | Accelerate |
| L trigger | Brake (minimum speed) |
| R click (full pull) | Boost |
| A | Fire lasers |
| B | Secondary weapon |
| X | Toggle chase / cockpit |
| C-stick | Camera distance (up/down) and orbit (left/right) |
| D-pad ↓ | Drop camera |

Click **Start Game** once to unlock browser audio. Connect a gamepad before loading the mission.

## Project layout

- `frontend/` — Angular UI
- `engine/` — Babylon host, loaders, audio, VFX
- `game/` — flight, AI, missions, collision
- `assets/` — **your** models, textures, audio (see `assets/ASSETS_CHECKLIST.md`)

## Adding your assets

Copy GLB, cubemap faces, and MP3 files into `assets/` following `ASSETS_CHECKLIST.md`. Missing files use procedural placeholders and log a single console warning per asset id.

## Missions

| Id | Status |
|----|--------|
| `asteroid_field_space` | Playable MVP |
| `mission_02_hoth_surface` | Menu stub |
| `mission_03_tatooine` | Menu stub |

## Graphics

WebGPU is tried first; WebGL2 fallback is automatic. Backend shown in HUD.

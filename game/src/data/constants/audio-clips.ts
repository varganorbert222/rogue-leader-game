/** Registered SFX clip ids from assets/audio/libraries. */
export const SfxClipIds = {
  RebelCannonFire: 'rebel_cannon_fire',
  ImperialCannonFire: 'imperial_cannon_fire',
  BulletHit: 'bullet_hit',
  BulletWhoosh: 'bullet_whoosh',
  FighterExplosion: 'fighter_explosion',
  AsteroidExplosion: 'asteroid_explosion',
  MissileHit: 'missile_hit',
  ShipCrash: 'ship_crash',
  ProtonTorpedoFire: 'proton_torpedo_fire',
  WarheadWhoosh: 'warhead_whoosh',
  XwingEngine: 'xwing_engine',
  TieFighterEngine: 'tie_fighter_engine',
  XwingInbound: 'xwing_inbound',
  TieFighterInbound: 'tie_fighter_inbound',
  XwingSfoil: 'xwing_sfoil',
} as const;

export type SfxClipId = (typeof SfxClipIds)[keyof typeof SfxClipIds];

export const MusicTrackIds = {
  MenuLoop: 'menu_loop',
  AsteroidFieldCombat: 'asteroid_field_combat',
} as const;

export type MusicTrackId = (typeof MusicTrackIds)[keyof typeof MusicTrackIds];

export const UiSfxClipIds = {
  Click: 'ui_click',
  Back: 'ui_back',
  Hover: 'ui_hover',
} as const;

export type UiSfxClipId = (typeof UiSfxClipIds)[keyof typeof UiSfxClipIds];

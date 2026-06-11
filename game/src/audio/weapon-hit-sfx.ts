import { SfxClipIds, type SfxClipId } from '../constants/audio-clips';
import { isMissileHitBehavior } from '../constants/weapon-behaviors';
import type { WeaponsManifest } from '../config/weapons-manifest';

/** Resolves weapon hit SFX clip id from manifest + projectile behavior. */
export class WeaponHitSfxResolver {
  constructor(private readonly manifest: WeaponsManifest) {}

  resolve(weaponId: string, behavior?: string): SfxClipId {
    const configured = this.manifest.weapons[weaponId]?.audio?.hit;
    if (configured) return configured as SfxClipId;
    if (isMissileHitBehavior(behavior)) return SfxClipIds.MissileHit;
    return SfxClipIds.BulletHit;
  }
}

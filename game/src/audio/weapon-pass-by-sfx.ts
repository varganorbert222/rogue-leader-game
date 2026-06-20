import { SfxClipIds, type SfxClipId } from '../config/constants/audio-clips';
import { isMissileHitBehavior } from '../config/constants/weapon-behaviors';
import type { WeaponsManifest } from '../config/loaders/weapons-manifest';

export function isWarheadPassByWeapon(
  manifest: WeaponsManifest,
  weaponId: string,
): boolean {
  const def = manifest.weapons[weaponId];
  if (!def) return false;
  if (def.delivery === 'laser') return false;
  return isMissileHitBehavior(def.behavior);
}

/** Resolves weapon fire SFX clip id from manifest + projectile behavior. */
export class WeaponFireSfxResolver {
  constructor(private readonly manifest: WeaponsManifest) {}

  resolve(weaponId: string, delivery: string, behavior?: string): SfxClipId | null {
    const configured = this.manifest.weapons[weaponId]?.audio?.fire;
    if (configured) return configured as SfxClipId;

    if (weaponId === 'proton_torpedo') {
      return SfxClipIds.ProtonTorpedoFire;
    }

    if (delivery === 'projectile' && isMissileHitBehavior(behavior)) {
      return SfxClipIds.ProtonTorpedoFire;
    }

    return null;
  }
}

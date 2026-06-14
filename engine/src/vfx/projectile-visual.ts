/** Projectile mesh dimensions in meters (1 scene unit = 1 m). */
export interface ProjectileVisualConfig {
  /** Total length along the flight axis, in meters. */
  length: number;
  /** Maximum width (cross-section) at the widest point, in meters. */
  width: number;
  /** Tail width as a fraction of `width` (0–1). */
  tailWidthRatio?: number;
  /** Base emissive color (RGB 0–1). Bloom strength comes from render config. */
  emissive: [number, number, number];
}

/**
 * Smallest valid Babylon camera near plane (`Camera.minZ`).
 * Values `<= 0` are clamped to `0.1` when the projection matrix is built.
 */
export const BABYLON_MIN_CAMERA_NEAR_Z = 0.1;

/** Default chase / outside camera near plane. */
export const CHASE_CAMERA_NEAR_Z = 0.5;

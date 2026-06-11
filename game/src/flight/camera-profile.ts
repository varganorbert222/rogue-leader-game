/** Chase-camera spring tuning — tactical (sharp) → balanced → immersive (soft). */
export type CameraSpringProfileId = 'tactical' | 'balanced' | 'immersive';

export interface CameraSpringProfile {
  id: CameraSpringProfileId;
  label: { en: string; hu: string };
  positionStiffness: number;
  positionDamping: number;
  orientationStiffness: number;
  orientationDamping: number;
  /** Orientation lags behind ship turn (0 = locked, ~0.2 = heavy lag). */
  rotationLag: number;
  /** World-space position trails velocity (seconds). */
  velocityLag: number;
  /** User orbit / distance input smoothing (1/s). */
  inputResponse: number;
}

export const CAMERA_SPRING_PROFILES: Record<CameraSpringProfileId, CameraSpringProfile> = {
  tactical: {
    id: 'tactical',
    label: { en: 'Tactical', hu: 'Éles' },
    positionStiffness: 185,
    positionDamping: 23,
    orientationStiffness: 165,
    orientationDamping: 21,
    rotationLag: 0.05,
    velocityLag: 0.035,
    inputResponse: 14,
  },
  balanced: {
    id: 'balanced',
    label: { en: 'Balanced', hu: 'Kiegyensúlyozott' },
    positionStiffness: 92,
    positionDamping: 14,
    orientationStiffness: 82,
    orientationDamping: 13,
    rotationLag: 0.14,
    velocityLag: 0.095,
    inputResponse: 9,
  },
  immersive: {
    id: 'immersive',
    label: { en: 'Immersive', hu: 'Lágy' },
    positionStiffness: 48,
    positionDamping: 10,
    orientationStiffness: 44,
    orientationDamping: 9.5,
    rotationLag: 0.26,
    velocityLag: 0.17,
    inputResponse: 6,
  },
};

export const DEFAULT_CAMERA_SPRING_PROFILE: CameraSpringProfileId = 'balanced';

const PROFILE_ORDER: CameraSpringProfileId[] = ['tactical', 'balanced', 'immersive'];

export function cycleCameraSpringProfile(
  current: CameraSpringProfileId
): CameraSpringProfileId {
  const idx = PROFILE_ORDER.indexOf(current);
  return PROFILE_ORDER[(idx + 1) % PROFILE_ORDER.length];
}

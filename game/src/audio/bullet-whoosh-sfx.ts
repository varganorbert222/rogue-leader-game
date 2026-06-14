/** Registry group `bullet/whoosh` — cannon_bullet_whoosh_01..16.wav */
export const BULLET_WHOOSH_BASE_PATH = 'audio/sfx/bullet';

export const BULLET_WHOOSH_FILES = Array.from(
  { length: 16 },
  (_, index) => `cannon_bullet_whoosh_${String(index + 1).padStart(2, '0')}.wav`,
);

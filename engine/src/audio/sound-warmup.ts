import type { Sound } from '@babylonjs/core';

/** Decode audio buffers ahead of gameplay by playing silently once. */
export function warmSound(sound: Sound, timeoutMs = 8000): Promise<void> {
  if (sound.isReady()) return Promise.resolve();

  return new Promise((resolve) => {
    const previousVolume = sound.getVolume();
    const finish = () => {
      sound.stop();
      sound.setVolume(previousVolume);
      resolve();
    };

    sound.setVolume(0);
    if (!sound.isPlaying) {
      sound.play();
    }

    const deadline = performance.now() + timeoutMs;
    const poll = () => {
      if (sound.isReady() || performance.now() >= deadline) {
        finish();
        return;
      }
      requestAnimationFrame(poll);
    };
    poll();
  });
}

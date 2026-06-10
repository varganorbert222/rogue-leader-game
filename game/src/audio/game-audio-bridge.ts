import type { AudioManager } from '@rogue-leader/engine';
import type { GameEventBus } from '../events/game-events';

export class GameAudioBridge {
  constructor(
    private readonly audio: AudioManager,
    events: GameEventBus
  ) {
    events.on('WeaponFired', () => this.audio.playSfx('laser_fire'));
    events.on('ProjectileHit', () => this.audio.playSfx('laser_hit'));
    events.on('EntityDestroyed', () => this.audio.playSfx('explosion_small'));
    events.on('PlayerDamaged', () => this.audio.playSfx('player_damage'));
    events.on('MeteorImpact', () => this.audio.playSfx('meteor_impact'));
    events.on('ShieldHit', () => this.audio.playSfx('shield_hit'));
    events.on('BoostStarted', () => this.audio.playSfx('boost'));
    events.on('MissileLock', () => this.audio.playSfx('missile_lock'));
    events.on('MissileLaunched', () => this.audio.playSfx('missile_launch'));
    events.on('HarpoonAttached', () => this.audio.playSfx('harpoon_attach'));
    events.on('MissionStarted', (e) => {
      const id = (e.payload?.['musicId'] as string) ?? 'hoth_space_combat';
      this.audio.crossfadeMusic(id, 1200);
    });
    events.on('MissionEnded', () => this.audio.stopMusic(800));
    events.on('MenuOpened', () => this.audio.playMusic('menu_loop', { fadeInMs: 400 }));
  }

  applySettings(master: number, music: number, sfx: number, muted: boolean): void {
    this.audio.setMasterVolume(master);
    this.audio.setMusicVolume(music);
    this.audio.setSfxVolume(sfx);
    this.audio.setMuted(muted);
  }
}

import {
  ArcRotateCamera,
  Color4,
  Vector3,
  type ParticleSystem,
} from '@babylonjs/core';
import type { BabylonHost } from '../core/babylon-host';
import { DebugFloor } from '../render/debug-floor';
import { DevPreviewRendering } from './dev-preview-rendering';
import {
  applyEditableToParticleSystem,
  createParticleSystemFromEditable,
} from './particle-preset-factory';
import {
  buildParticleEffectHierarchy,
  cloneParticleEffect,
  type ParticleEffectEditable,
  type ParticleSystemEditable,
} from './particle-editor-types';
import type { HierarchyNode } from './hierarchy-types';

const EMITTER_POSITION = new Vector3(0, 1.2, 0);

export class ParticlePreviewScene {
  private readonly camera: ArcRotateCamera;
  private readonly floor: DebugFloor;
  private readonly devRendering = new DevPreviewRendering();
  private effect: ParticleEffectEditable | null = null;
  private systems = new Map<string, ParticleSystem>();
  private burstTimers: number[] = [];

  constructor(private readonly host: BabylonHost) {
    const scene = host.scene;
    const canvas = host.engine.getRenderingCanvas()!;

    this.camera = new ArcRotateCamera(
      'particleEditorCam',
      Math.PI / 4,
      Math.PI / 2.4,
      8,
      EMITTER_POSITION,
      scene,
    );
    this.camera.minZ = 0.05;
    this.camera.wheelPrecision = 20;
    this.camera.panningSensibility = 0;
    this.camera.attachControl(canvas, true);
    scene.activeCamera = this.camera;
    scene.clearColor = new Color4(0.11, 0.11, 0.12, 1);

    this.floor = new DebugFloor(scene, {
      center: Vector3.Zero(),
      extent: 24,
      step: 2,
      y: 0,
    });
  }

  async initRendering(): Promise<void> {
    await this.devRendering.attach(this.host, this.camera);
  }

  getCamera(): ArcRotateCamera {
    return this.camera;
  }

  getEffect(): ParticleEffectEditable | null {
    return this.effect ? cloneParticleEffect(this.effect) : null;
  }

  getHierarchy(): HierarchyNode[] {
    if (!this.effect) return [];
    return buildParticleEffectHierarchy(this.effect);
  }

  async setEffect(effect: ParticleEffectEditable): Promise<void> {
    this.stopAll();
    this.disposeSystems();
    this.effect = cloneParticleEffect(effect);

    for (const config of this.effect.systems) {
      const ps = createParticleSystemFromEditable(this.host.scene, config);
      ps.emitter = EMITTER_POSITION.clone();
      this.systems.set(config.id, ps);
    }
  }

  updateSystem(config: ParticleSystemEditable): void {
    if (!this.effect) return;
    const index = this.effect.systems.findIndex((s) => s.id === config.id);
    if (index < 0) return;

    this.effect.systems[index] = { ...config };
    const ps = this.systems.get(config.id);
    if (!ps) return;
    applyEditableToParticleSystem(ps, config, this.host.scene);
  }

  reorderSystems(systemIds: string[]): void {
    if (!this.effect) return;
    const byId = new Map(this.effect.systems.map((s) => [s.id, s]));
    this.effect.systems = systemIds
      .map((id) => byId.get(id))
      .filter((s): s is ParticleSystemEditable => !!s);
  }

  addSystem(config?: ParticleSystemEditable): string {
    if (!this.effect) return '';
    const system = config ?? {
      ...this.effect.systems[0],
      id: `ps_${Date.now()}`,
      name: `Particle System ${this.effect.systems.length + 1}`,
    };
    this.effect.systems.push(system);
    const ps = createParticleSystemFromEditable(this.host.scene, system);
    ps.emitter = EMITTER_POSITION.clone();
    this.systems.set(system.id, ps);
    return system.id;
  }

  removeSystem(systemId: string): void {
    if (!this.effect) return;
    this.effect.systems = this.effect.systems.filter((s) => s.id !== systemId);
    const ps = this.systems.get(systemId);
    if (ps) {
      ps.stop();
      ps.dispose();
      this.systems.delete(systemId);
    }
  }

  playAll(): void {
    this.stopAll();
    if (!this.effect) return;

    for (const config of this.effect.systems) {
      const ps = this.systems.get(config.id);
      if (!ps) continue;

      if (config.playMode === 'burst') {
        ps.manualEmitCount = config.manualEmitCount;
        ps.start();
        const releaseMs = Math.max(
          300,
          (config.maxLifeTime + (config.targetStopDuration || 0.2)) * 1000,
        );
        const timer = window.setTimeout(() => ps.stop(), releaseMs);
        this.burstTimers.push(timer);
      } else {
        ps.manualEmitCount = 0;
        ps.start();
      }
    }
  }

  playSystem(systemId: string): void {
    const config = this.effect?.systems.find((s) => s.id === systemId);
    const ps = this.systems.get(systemId);
    if (!config || !ps) return;

    ps.stop();
    if (config.playMode === 'burst') {
      ps.manualEmitCount = config.manualEmitCount;
      ps.start();
      const releaseMs = Math.max(
        300,
        (config.maxLifeTime + (config.targetStopDuration || 0.2)) * 1000,
      );
      const timer = window.setTimeout(() => ps.stop(), releaseMs);
      this.burstTimers.push(timer);
    } else {
      ps.manualEmitCount = 0;
      ps.start();
    }
  }

  stopAll(): void {
    for (const timer of this.burstTimers) {
      window.clearTimeout(timer);
    }
    this.burstTimers = [];
    for (const ps of this.systems.values()) {
      ps.stop();
    }
  }

  dispose(): void {
    this.stopAll();
    this.disposeSystems();
    this.floor.dispose();
    this.devRendering.dispose();
    this.camera.dispose();
  }

  private disposeSystems(): void {
    for (const ps of this.systems.values()) {
      ps.dispose();
    }
    this.systems.clear();
    this.effect = null;
  }
}

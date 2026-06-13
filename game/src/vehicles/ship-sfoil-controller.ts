import type { AnimationGroup } from '@babylonjs/core';
import {
  ShipAnimationController,
  type ShipManifestEntry,
  type ShipSfoilAbilityManifest,
} from '@rogue-leader/engine';
import { resolveShipSfoilSfx, sfoilSfxToEventPayload, type SfoilSfxPlayRequest } from '../audio/sfoil-sfx';
import type { ShipFlightController } from '../flight/ship-flight-controller';
import type { VehicleWeaponSystem } from '../combat/weapons/vehicle-weapon-system';

const DEFAULT_FOLDED_STATE = 'folded';
const DEFAULT_OPEN_STATE = 'open';
const DEFAULT_CLOSING_BOOST = 1.6;

export class ShipSfoilController {
  private readonly animation: ShipAnimationController;
  private readonly foldedState: string;
  private readonly openState: string;
  private readonly closingBoostMultiplier: number;
  readonly sfxRequest: SfoilSfxPlayRequest | null;

  private constructor(
    animation: ShipAnimationController,
    private readonly weapons: VehicleWeaponSystem,
    private readonly flight: ShipFlightController,
    ability: ShipSfoilAbilityManifest
  ) {
    this.animation = animation;
    this.foldedState = ability.foldedState ?? DEFAULT_FOLDED_STATE;
    this.openState = ability.openState ?? DEFAULT_OPEN_STATE;
    this.closingBoostMultiplier = ability.closingBoostMultiplier ?? DEFAULT_CLOSING_BOOST;
    this.sfxRequest = resolveShipSfoilSfx(ability.sfx);
    this.applyIdleState(this.animation.getState());
  }

  static tryCreate(options: {
    shipEntry: ShipManifestEntry;
    animationGroups: readonly AnimationGroup[];
    weapons: VehicleWeaponSystem;
    flight: ShipFlightController;
  }): ShipSfoilController | null {
    const ability = options.shipEntry.abilities?.sfoil;
    if (!ability) return null;

    const animationConfig = ability.animation ?? options.shipEntry.animations;
    if (!animationConfig?.transitions.length) return null;
    if (options.animationGroups.length === 0) return null;

    const animation = new ShipAnimationController(
      options.animationGroups,
      animationConfig
    );

    return new ShipSfoilController(
      animation,
      options.weapons,
      options.flight,
      ability
    );
  }

  getState(): string {
    return this.animation.getState();
  }

  isOpen(): boolean {
    return this.animation.getState() === this.openState;
  }

  isTransitioning(): boolean {
    return this.animation.isPlaying();
  }

  /** Returns true when a new transition was started. */
  requestToggle(): boolean {
    if (this.animation.isPlaying()) return false;

    const fromState = this.animation.getState();
    const targetState = fromState === this.foldedState ? this.openState : this.foldedState;
    if (!this.animation.playTransitionTo(targetState, (state) => this.onTransitionComplete(state))) {
      return false;
    }

    this.onTransitionStart(fromState, targetState);
    return true;
  }

  dispose(): void {
    this.animation.dispose();
    this.flight.setSpeedCapMultiplier(1);
  }

  private onTransitionStart(_fromState: string, toState: string): void {
    if (toState === this.foldedState) {
      this.weapons.setFireEnabled(false);
      this.flight.setSpeedCapMultiplier(this.closingBoostMultiplier);
      return;
    }

    if (toState === this.openState) {
      this.weapons.setFireEnabled(false);
      this.flight.setSpeedCapMultiplier(1);
    }
  }

  private onTransitionComplete(state: string): void {
    this.applyIdleState(state);
  }

  private applyIdleState(state: string): void {
    if (state === this.openState) {
      this.flight.setSpeedCapMultiplier(1);
      this.weapons.setFireEnabled(true);
      return;
    }

    this.flight.setSpeedCapMultiplier(1);
    this.weapons.setFireEnabled(false);
  }
}

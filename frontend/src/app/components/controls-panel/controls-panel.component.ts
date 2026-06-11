import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AXIS_ACTION_IDS,
  BUTTON_ACTION_IDS,
  CONTROL_ACTION_LABELS,
  applyCapturedBinding,
  formatGamepadButton,
  formatKeyboardCode,
  gamepadIdsMatch,
  listConnectedGamepads,
  normalizeSelectedGamepadId,
  removeGamepadButtonBinding,
  removeKeyboardBinding,
  startBindingCapture,
  wakeGamepads,
  type BindingPole,
  type ConnectedGamepadInfo,
  type AxisActionBindings,
  type ButtonActionBindings,
  type ControlActionId,
  type ControlBindingsConfig,
} from '@rogue-leader/game';
import { ControlSettingsService } from '../../services/control-settings.service';

type ControlsTab = 'keyboard' | 'gamepad';

interface CaptureTarget {
  actionId: ControlActionId;
  pole: BindingPole;
  tab: ControlsTab;
}

@Component({
  selector: 'app-controls-panel',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './controls-panel.component.html',
  styleUrl: './controls-panel.component.scss',
})
export class ControlsPanelComponent implements OnInit, OnDestroy {
  @Input() locale: 'hu' | 'en' = 'hu';
  @Output() controlsChange = new EventEmitter<ControlBindingsConfig>();

  config!: ControlBindingsConfig;
  activeTab: ControlsTab = 'keyboard';
  gamepads: ConnectedGamepadInfo[] = [];
  captureTarget: CaptureTarget | null = null;
  captureSession: { cancel(): void } | null = null;

  readonly axisActionIds = AXIS_ACTION_IDS;
  readonly buttonActionIds = BUTTON_ACTION_IDS;
  readonly actionLabels = CONTROL_ACTION_LABELS;

  private padPoll?: number;
  private readonly onPadChange = (): void => this.refreshGamepads();

  constructor(private readonly controlSettings: ControlSettingsService) {}

  ngOnInit(): void {
    this.config = this.controlSettings.reload();
    this.refreshGamepads();
    window.addEventListener('gamepadconnected', this.onPadChange);
    window.addEventListener('gamepaddisconnected', this.onPadChange);
    this.padPoll = window.setInterval(() => this.refreshGamepads(), 1000);
  }

  ngOnDestroy(): void {
    this.cancelCapture();
    window.removeEventListener('gamepadconnected', this.onPadChange);
    window.removeEventListener('gamepaddisconnected', this.onPadChange);
    if (this.padPoll !== undefined) {
      window.clearInterval(this.padPoll);
    }
  }

  get title(): string {
    return this.locale === 'hu' ? 'Irányítás' : 'Controls';
  }

  get hasGamepad(): boolean {
    return this.gamepads.length > 0;
  }

  label(actionId: ControlActionId): string {
    return this.actionLabels[actionId][this.locale];
  }

  refreshGamepads(): void {
    wakeGamepads();
    this.gamepads = listConnectedGamepads();
    if (this.activeTab === 'gamepad' && !this.hasGamepad) {
      this.activeTab = 'keyboard';
    }
  }

  setTab(tab: ControlsTab): void {
    if (tab === 'gamepad' && !this.hasGamepad) {
      return;
    }
    this.activeTab = tab;
    this.cancelCapture();
  }

  persist(): void {
    this.config = this.controlSettings.update(this.config);
    this.controlsChange.emit(this.config);
  }

  resetDefaults(): void {
    this.config = this.controlSettings.reset();
    this.controlsChange.emit(this.config);
  }

  onGamepadSelect(): void {
    this.config.gamepad.selectedGamepadId = normalizeSelectedGamepadId(
      this.config.gamepad.selectedGamepadId
    );
    this.persist();
  }

  onStickChange(): void {
    this.persist();
  }

  startCapture(actionId: ControlActionId, pole: BindingPole, tab: ControlsTab): void {
    this.cancelCapture();
    this.captureTarget = { actionId, pole, tab };
    this.captureSession = startBindingCapture(
      (binding) => {
        if (!this.captureTarget) return;
        if (binding.type === 'keyboard' && tab === 'gamepad') {
          return;
        }
        if (binding.type === 'gamepadButton' && tab === 'keyboard') {
          return;
        }
        if (binding.type === 'gamepadAxis') {
          return;
        }
        this.config = applyCapturedBinding(
          this.config,
          actionId,
          pole,
          binding
        );
        this.captureTarget = null;
        this.captureSession = null;
        this.persist();
      },
      () => {
        this.captureTarget = null;
        this.captureSession = null;
      },
      {
        allowKeyboard: tab === 'keyboard',
        allowGamepad: tab === 'gamepad',
      }
    );
  }

  cancelCapture(): void {
    this.captureSession?.cancel();
    this.captureSession = null;
    this.captureTarget = null;
  }

  isCapturing(actionId: ControlActionId, pole: BindingPole, tab: ControlsTab): boolean {
    const target = this.captureTarget;
    return (
      target?.actionId === actionId &&
      target.pole === pole &&
      target.tab === tab
    );
  }

  removeKey(actionId: ControlActionId, pole: BindingPole, code: string): void {
    this.config = removeKeyboardBinding(this.config, actionId, pole, code);
    this.persist();
  }

  removePadButton(actionId: ControlActionId, pole: BindingPole, index: number): void {
    this.config = removeGamepadButtonBinding(this.config, actionId, pole, index);
    this.persist();
  }

  formatKey(code: string): string {
    return formatKeyboardCode(code);
  }

  formatPad(index: number): string {
    return formatGamepadButton(index);
  }

  axisKeys(actionId: ControlActionId, pole: 'positive' | 'negative'): string[] {
    const axis = this.getAxis(actionId);
    if (!axis) return [];
    return pole === 'positive' ? axis.keysPositive : axis.keysNegative;
  }

  axisButtons(actionId: ControlActionId, pole: 'positive' | 'negative'): number[] {
    const axis = this.getAxis(actionId);
    if (!axis) return [];
    return pole === 'positive' ? axis.buttonsPositive : axis.buttonsNegative;
  }

  buttonKeys(actionId: ControlActionId): string[] {
    const action = this.getButton(actionId);
    return action?.keys ?? [];
  }

  buttonPads(actionId: ControlActionId): number[] {
    const action = this.getButton(actionId);
    return action?.buttons ?? [];
  }

  getAxis(actionId: ControlActionId): AxisActionBindings | null {
    if (!this.isAxis(actionId)) return null;
    return this.config[actionId] as AxisActionBindings;
  }

  getButton(actionId: ControlActionId): ButtonActionBindings | null {
    if (!this.isButton(actionId)) return null;
    return this.config[actionId] as ButtonActionBindings;
  }

  isAxis(actionId: ControlActionId): actionId is (typeof AXIS_ACTION_IDS)[number] {
    return (AXIS_ACTION_IDS as readonly ControlActionId[]).includes(actionId);
  }

  isButton(actionId: ControlActionId): actionId is (typeof BUTTON_ACTION_IDS)[number] {
    return (BUTTON_ACTION_IDS as readonly ControlActionId[]).includes(actionId);
  }

  setLeftDeadzone(percent: number): void {
    this.config.gamepad.leftStick.deadzone = percent / 100;
    this.onStickChange();
  }

  setRightDeadzone(percent: number): void {
    this.config.gamepad.rightStick.deadzone = percent / 100;
    this.onStickChange();
  }

  setTriggerDeadzone(percent: number): void {
    this.config.gamepad.triggers.deadzone = percent / 100;
    this.onStickChange();
  }

  setLeftSensitivity(scale: number): void {
    this.config.gamepad.leftStick.sensitivity = scale / 100;
    this.onStickChange();
  }

  setRightSensitivity(scale: number): void {
    this.config.gamepad.rightStick.sensitivity = scale / 100;
    this.onStickChange();
  }

  setTriggerSensitivity(scale: number): void {
    this.config.gamepad.triggers.sensitivity = scale / 100;
    this.onStickChange();
  }

  setLeftExponent(scale: number): void {
    this.config.gamepad.leftStick.exponent = scale / 100;
    this.onStickChange();
  }

  setRightExponent(scale: number): void {
    this.config.gamepad.rightStick.exponent = scale / 100;
    this.onStickChange();
  }

  setTriggerExponent(scale: number): void {
    this.config.gamepad.triggers.exponent = scale / 100;
    this.onStickChange();
  }

  savedGamepadMissing(): boolean {
    const id = this.config.gamepad.selectedGamepadId;
    if (!id) return false;
    return !this.gamepads.some((pad) => gamepadIdsMatch(id, pad.id));
  }
}

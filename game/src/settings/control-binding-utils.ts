import type {
  Binding,
  ControlActionId,
  ControlBindingsConfig,
} from './control-bindings';
import {
  AXIS_ACTION_IDS,
  BUTTON_ACTION_IDS,
  cloneControlBindings,
} from './control-bindings';

export type BindingPole = 'positive' | 'negative' | 'button';

export function isAxisAction(id: ControlActionId): boolean {
  return AXIS_ACTION_IDS.includes(id);
}

export function isButtonAction(id: ControlActionId): boolean {
  return BUTTON_ACTION_IDS.includes(id);
}

export function applyCapturedBinding(
  config: ControlBindingsConfig,
  actionId: ControlActionId,
  pole: BindingPole,
  binding: Binding
): ControlBindingsConfig {
  const next = cloneControlBindings(config);

  if (isAxisAction(actionId)) {
    const axis = next[actionId as keyof ControlBindingsConfig];
    if (typeof axis !== 'object' || !('keysPositive' in axis)) {
      return next;
    }
    if (binding.type === 'keyboard') {
      if (pole === 'positive') {
        axis.keysPositive = uniquePush(axis.keysPositive, binding.code);
      } else {
        axis.keysNegative = uniquePush(axis.keysNegative, binding.code);
      }
    } else if (binding.type === 'gamepadButton') {
      if (pole === 'positive') {
        axis.buttonsPositive = uniquePush(axis.buttonsPositive, binding.index);
      } else {
        axis.buttonsNegative = uniquePush(axis.buttonsNegative, binding.index);
      }
    }
    return next;
  }

  if (isButtonAction(actionId) && pole === 'button') {
    const button = next[actionId as keyof ControlBindingsConfig];
    if (typeof button !== 'object' || !('keys' in button)) {
      return next;
    }
    if (binding.type === 'keyboard') {
      button.keys = uniquePush(button.keys, binding.code);
    } else if (binding.type === 'gamepadButton') {
      button.buttons = uniquePush(button.buttons, binding.index);
    }
  }

  return next;
}

export function removeKeyboardBinding(
  config: ControlBindingsConfig,
  actionId: ControlActionId,
  pole: BindingPole,
  code: string
): ControlBindingsConfig {
  const next = cloneControlBindings(config);
  if (isAxisAction(actionId)) {
    const axis = next[actionId as keyof ControlBindingsConfig];
    if (typeof axis !== 'object' || !('keysPositive' in axis)) {
      return next;
    }
    if (pole === 'positive') {
      axis.keysPositive = axis.keysPositive.filter((key) => key !== code);
    } else {
      axis.keysNegative = axis.keysNegative.filter((key) => key !== code);
    }
    return next;
  }
  if (isButtonAction(actionId) && pole === 'button') {
    const button = next[actionId as keyof ControlBindingsConfig];
    if (typeof button === 'object' && 'keys' in button) {
      button.keys = button.keys.filter((key) => key !== code);
    }
  }
  return next;
}

export function removeGamepadButtonBinding(
  config: ControlBindingsConfig,
  actionId: ControlActionId,
  pole: BindingPole,
  index: number
): ControlBindingsConfig {
  const next = cloneControlBindings(config);
  if (isAxisAction(actionId)) {
    const axis = next[actionId as keyof ControlBindingsConfig];
    if (typeof axis !== 'object' || !('keysPositive' in axis)) {
      return next;
    }
    if (pole === 'positive') {
      axis.buttonsPositive = axis.buttonsPositive.filter((btn) => btn !== index);
    } else {
      axis.buttonsNegative = axis.buttonsNegative.filter((btn) => btn !== index);
    }
    return next;
  }
  if (isButtonAction(actionId) && pole === 'button') {
    const button = next[actionId as keyof ControlBindingsConfig];
    if (typeof button === 'object' && 'buttons' in button) {
      button.buttons = button.buttons.filter((btn) => btn !== index);
    }
  }
  return next;
}

function uniquePush<T>(list: T[], value: T): T[] {
  if (list.includes(value)) {
    return list;
  }
  return [...list, value];
}

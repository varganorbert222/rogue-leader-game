export interface CombatInput {
  /** Hold for continuous primary (blasters). */
  fire: boolean;
  /** One-frame pulse — secondary weapons (torpedoes, rockets) fire on press only. */
  fireSecondaryPressed: boolean;
}

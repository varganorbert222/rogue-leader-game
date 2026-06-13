export interface CombatInput {
  /** Hold for continuous primary (blasters). */
  fire: boolean;
  /** One-frame pulse — secondary weapons (torpedoes, rockets) fire on press only. */
  fireSecondaryPressed: boolean;
  /** One-frame pulse — S-foil / special ship animation toggle. */
  toggleSfoilPressed: boolean;
}

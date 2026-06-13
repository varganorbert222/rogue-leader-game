export class HealthComponent {
  constructor(
    public health: number,
    public maxHealth: number,
    public shield: number,
    public maxShield: number,
  ) {}

  applyDamage(amount: number): { hull: number; shield: number } {
    let remaining = amount;
    let shieldHit = 0;
    if (this.shield > 0) {
      shieldHit = Math.min(this.shield, remaining);
      this.shield -= shieldHit;
      remaining -= shieldHit;
    }
    const hull = Math.min(this.health, remaining);
    this.health -= hull;
    return { hull, shield: shieldHit };
  }

  isDead(): boolean {
    return this.health <= 0;
  }
}

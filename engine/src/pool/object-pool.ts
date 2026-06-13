export interface ObjectPoolOptions<T> {
  factory: () => T;
  reset?: (item: T) => void;
  destroy?: (item: T) => void;
  maxSize?: number;
}

/** Fixed-size reuse pool — avoids allocate/dispose churn for short-lived objects. */
export class ObjectPool<T> {
  private readonly available: T[] = [];
  private readonly reset?: (item: T) => void;
  private readonly destroy?: (item: T) => void;
  private readonly maxSize: number;

  constructor(private readonly factory: () => T, options: Omit<ObjectPoolOptions<T>, 'factory'> = {}) {
    this.reset = options.reset;
    this.destroy = options.destroy;
    this.maxSize = options.maxSize ?? 32;
  }

  static create<T>(options: ObjectPoolOptions<T>): ObjectPool<T> {
    return new ObjectPool(options.factory, options);
  }

  acquire(): T {
    return this.available.pop() ?? this.factory();
  }

  release(item: T): void {
    this.reset?.(item);
    if (this.available.length < this.maxSize) {
      this.available.push(item);
      return;
    }
    this.destroy?.(item);
  }

  prewarm(count: number): void {
    for (let i = 0; i < count; i++) {
      this.release(this.factory());
    }
  }

  drain(): void {
    while (this.available.length > 0) {
      const item = this.available.pop();
      if (item) this.destroy?.(item);
    }
  }

  get idleCount(): number {
    return this.available.length;
  }
}

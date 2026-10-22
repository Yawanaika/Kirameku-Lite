/**
 * Small in-process TTL cache for idempotent GET proxies (music, toolbox APIs).
 *
 * The app is single-instance by design, so a module-level Map is sufficient and
 * avoids a Redis dependency. Entries are bounded to keep memory predictable.
 */
export class TtlCache<T> {
  private readonly entries = new Map<
    string,
    { value: T; expiresAt: number }
  >();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 200,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.entries.size >= this.maxEntries) {
      // Map preserves insertion order, so the first key is the oldest.
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

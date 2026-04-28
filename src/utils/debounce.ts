export class PerKeyDebouncer {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  schedule(key: string, delayMs: number, callback: () => void): void {
    this.cancel(key);
    const timer = setTimeout(() => {
      this.timers.delete(key);
      callback();
    }, Math.max(0, delayMs));
    this.timers.set(key, timer);
  }

  cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}

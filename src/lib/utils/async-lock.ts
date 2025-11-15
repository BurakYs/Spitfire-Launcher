export default class AsyncLock {
  private queue: Array<() => void> = [];
  private locked = false;

  async lock(): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
      if (this.locked) {
        this.queue.push(() => resolve(this.getUnlock()));
      } else {
        this.locked = true;
        resolve(this.getUnlock());
      }
    });
  }

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const unlock = await this.lock();

    try {
      return await fn();
    } finally {
      unlock();
    }
  }

  private getUnlock(): () => void {
    let unlocked = false;

    return () => {
      if (unlocked) return;
      unlocked = true;

      const next = this.queue.shift();
      if (next) {
        next();
      } else {
        this.locked = false;
      }
    };
  }
}
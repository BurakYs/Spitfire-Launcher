type AddEventListenerOptions = {
  signal?: AbortSignal;
};

export default class EventEmitter<EventMap extends Record<string, any>> {
  private listeners = new Map<keyof EventMap, Array<(data: any) => void>>();

  on<T extends keyof EventMap>(name: T, listener: (data: EventMap[T]) => void, options?: AddEventListenerOptions) {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, []);
    }

    const listeners = this.listeners.get(name)!;
    listeners.push(listener);

    options?.signal?.addEventListener('abort', () => {
      this.off(name, listener);
    });
  }

  off<T extends keyof EventMap>(name: T, listener: (data: EventMap[T]) => void) {
    const listeners = this.listeners.get(name);
    if (!listeners?.length) return;

    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  emit<T extends keyof EventMap>(eventName: T, data: EventMap[T]) {
    const listeners = this.listeners.get(eventName);
    if (!listeners?.length) return;

    for (let i = 0; i < listeners.length; i++) {
      listeners[i](data);
    }
  }

  waitForEvent<T extends keyof EventMap>(name: T, validate?: (data: EventMap[T]) => boolean, timeout = 5000) {
    return new Promise<EventMap[T]>((resolve, reject) => {
      const listener = (data: EventMap[T]) => {
        if (!validate || validate(data)) {
          clearTimeout(timeoutId);
          this.off(name, listener);
          resolve(data);
        }
      };

      const timeoutId = setTimeout(() => {
        this.off(name, listener);
        reject(new Error(`Timeout waiting for event: ${String(name)}`));
      }, timeout);

      this.on(name, listener);
    });
  }

  protected removeAllListeners() {
    this.listeners.clear();
  }
}

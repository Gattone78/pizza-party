export type Unsubscribe = () => void;

/** Tiny typed event emitter. `Events` maps event name to payload type. */
export class Emitter<Events extends object> {
  private handlers: { [K in keyof Events]?: Set<(payload: Events[K]) => void> } = {};

  on<K extends keyof Events>(type: K, handler: (payload: Events[K]) => void): Unsubscribe {
    const set = (this.handlers[type] ??= new Set());
    set.add(handler);
    return () => set.delete(handler);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    this.handlers[type]?.forEach((handler) => handler(payload));
  }

  clear(): void {
    this.handlers = {};
  }
}

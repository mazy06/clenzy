import type { BookingEventMap, BookingEventName } from './types';

type Listener<T> = (data: T) => void;

/**
 * Lightweight typed EventEmitter (~200 bytes minified).
 * Zero dependencies.
 */
export class EventEmitter {
  private listeners = new Map<string, Set<Listener<unknown>>>();

  on<E extends BookingEventName>(event: E, fn: Listener<BookingEventMap[E]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn as Listener<unknown>);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(fn as Listener<unknown>);
    };
  }

  off<E extends BookingEventName>(event: E, fn: Listener<BookingEventMap[E]>): void {
    this.listeners.get(event)?.delete(fn as Listener<unknown>);
  }

  protected emit<E extends BookingEventName>(event: E, data: BookingEventMap[E]): void {
    this.listeners.get(event)?.forEach((fn) => {
      try {
        fn(data);
      } catch (err) {
        console.error(`[ClenzyBooking] Error in "${event}" listener:`, err);
      }
    });
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

/** Limite les lectures du planning par onglet, sans laisser les buffers saturer l'API. */
export class BaitlyPlanningReadQueue {
  private active = 0;
  private pending: { start: () => void; cancel: () => void; signal?: AbortSignal }[] = [];
  constructor(private readonly limit = 4) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('Limite de lectures invalide');
  }

  run<T>(signal: AbortSignal | undefined, read: () => Promise<T>): Promise<T> {
    const abortError = () => signal?.reason ?? new DOMException('Lecture annulée', 'AbortError');
    if (signal?.aborted) return Promise.reject(abortError());
    return new Promise<T>((resolve, reject) => {
      const entry = {
        signal,
        start: () => {
          signal?.removeEventListener('abort', entry.cancel);
          this.active++;
          Promise.resolve().then(() => {
            if (signal?.aborted) throw abortError();
            return read();
          }).then(resolve, reject).finally(() => { this.active--; this.drain(); });
        },
        cancel: () => {
          this.pending = this.pending.filter((item) => item !== entry);
          signal?.removeEventListener('abort', entry.cancel);
          reject(abortError());
        },
      };
      signal?.addEventListener('abort', entry.cancel, { once: true });
      this.pending.push(entry);
      this.drain();
    });
  }

  private drain() {
    while (this.active < this.limit && this.pending.length) this.pending.shift()!.start();
  }
}

export const baitlyPlanningReadQueue = new BaitlyPlanningReadQueue();

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import {
  resetConnectedObjectsInvalidation,
  scheduleConnectedObjectsInvalidation,
} from './invalidateConnectedObjects';

function fakeClient() {
  return { invalidateQueries: vi.fn().mockResolvedValue(undefined) } as unknown as QueryClient;
}

describe('scheduleConnectedObjectsInvalidation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetConnectedObjectsInvalidation();
  });

  afterEach(() => {
    resetConnectedObjectsInvalidation();
    vi.useRealTimers();
  });

  it("n'invalide qu'une fois pour tout un parc d'appareils", () => {
    const qc = fakeClient();

    // Un écran réel : 93 cartes qui se montent quasi simultanément.
    for (let i = 0; i < 93; i += 1) {
      scheduleConnectedObjectsInvalidation(qc);
    }
    vi.advanceTimersByTime(400);

    expect(qc.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['connected-objects'] });
  });

  it("n'invalide pas avant la fin de la fenêtre", () => {
    const qc = fakeClient();

    scheduleConnectedObjectsInvalidation(qc);
    vi.advanceTimersByTime(399);

    expect(qc.invalidateQueries).not.toHaveBeenCalled();
  });

  it('rouvre une fenêtre après la précédente', () => {
    const qc = fakeClient();

    scheduleConnectedObjectsInvalidation(qc);
    vi.advanceTimersByTime(400);
    scheduleConnectedObjectsInvalidation(qc);
    vi.advanceTimersByTime(400);

    expect(qc.invalidateQueries).toHaveBeenCalledTimes(2);
  });
});

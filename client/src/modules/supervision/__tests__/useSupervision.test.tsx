// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSupervision } from '../core/useSupervision';
import { MockSupervisionProvider } from '../provider/MockSupervisionProvider';

describe('useSupervision', () => {
  it('passe de loading à live une fois le snapshot chargé', async () => {
    const provider = new MockSupervisionProvider('1', { latencyMs: 0 });
    const { result, unmount } = renderHook(() => useSupervision(() => provider, ['1']));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('live'));
    expect(result.current.snapshot?.agents).toHaveLength(5);
    unmount();
  });

  it('applique la validation au snapshot (file décrémente)', async () => {
    const provider = new MockSupervisionProvider('1', { latencyMs: 0 });
    const { result, unmount } = renderHook(() => useSupervision(() => provider, ['1']));
    await waitFor(() => expect(result.current.status).toBe('live'));
    const before = result.current.snapshot!.pending.length;
    const id = result.current.snapshot!.pending[0].id;
    await act(async () => {
      await result.current.actions.validatePending(id);
    });
    await waitFor(() => expect(result.current.snapshot!.pending.length).toBe(before - 1));
    unmount();
  });

  it('bascule hors-ligne puis revient en direct à la reconnexion', async () => {
    const provider = new MockSupervisionProvider('1', { latencyMs: 0 });
    const { result, unmount } = renderHook(() => useSupervision(() => provider, ['1']));
    await waitFor(() => expect(result.current.status).toBe('live'));

    act(() => provider.simulateConnection(false));
    await waitFor(() => expect(result.current.status).toBe('offline'));

    act(() => provider.simulateConnection(true));
    await waitFor(() => expect(result.current.status).toBe('live'));
    unmount();
  });
});

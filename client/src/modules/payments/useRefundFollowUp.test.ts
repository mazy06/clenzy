import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useRefundFollowUp } from './useRefundFollowUp';

const api = vi.hoisted(() => ({ getById: vi.fn() }));
vi.mock('../../services/api/interventionsApi', () => ({ interventionsApi: api }));
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('waits for canonical Baitly confirmation and stops polling confirmed missions', async () => {
  const confirmed = vi.fn();
  api.getById.mockResolvedValueOnce({ paymentStatus: 'PAID' }).mockResolvedValue({ paymentStatus: 'REFUNDED' });
  renderHook(() => useRefundFollowUp([364], confirmed));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(confirmed).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(confirmed).toHaveBeenCalledExactlyOnceWith([364]);
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(api.getById).toHaveBeenCalledTimes(2);
});

it('continues after a read failure and handles several refunds independently', async () => {
  const confirmed = vi.fn();
  api.getById.mockImplementation((id: number) => id === 1 ? Promise.resolve({ paymentStatus: 'REFUNDED' }) : Promise.reject(new Error('network')));
  renderHook(() => useRefundFollowUp([1, 2], confirmed));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(confirmed).toHaveBeenCalledExactlyOnceWith([1]);
  api.getById.mockResolvedValue({ paymentStatus: 'REFUNDED' });
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(confirmed).toHaveBeenLastCalledWith([2]);
  expect(api.getById).toHaveBeenCalledTimes(3);
});

it('ignores a response after leaving Finance and removes its timer', async () => {
  const confirmed = vi.fn();
  let resolve!: (value: { paymentStatus: string }) => void;
  api.getById.mockImplementation(() => new Promise(done => { resolve = done; }));
  const { unmount } = renderHook(() => useRefundFollowUp([364], confirmed));
  unmount();
  await act(async () => { resolve({ paymentStatus: 'REFUNDED' }); await vi.advanceTimersByTimeAsync(60000); });
  expect(confirmed).not.toHaveBeenCalled();
  expect(api.getById).toHaveBeenCalledTimes(1);
});

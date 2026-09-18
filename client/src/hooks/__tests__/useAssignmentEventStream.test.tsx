import React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { useAssignmentEventStream } from '../useAssignmentEventStream';

const invalidate = vi.hoisted(() => vi.fn());
vi.mock('../invalidateMissionWorkflow', () => ({ invalidateMissionWorkflow: invalidate }));
vi.mock('../../keycloak', () => ({ getAccessToken: () => 'session-token' }));
vi.mock('../../config/api', () => ({ buildApiUrl: (path: string) => '/api' + path }));
const wrapper = ({ children }: { children: React.ReactNode }) =>
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('opens one stream, coalesces fragmented events and never polls while idle', async () => {
  vi.useFakeTimers();
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start: controller => { stream = controller; } });
  const fetch = vi.fn().mockResolvedValue({ ok: true, body });
  vi.stubGlobal('fetch', fetch);
  const { unmount } = renderHook(() => useAssignmentEventStream('user:org'), { wrapper });
  await act(async () => { await Promise.resolve(); });
  await act(async () => { vi.advanceTimersByTime(250); });
  expect(invalidate).toHaveBeenCalledTimes(1);
  const encoder = new TextEncoder();
  await act(async () => {
    stream.enqueue(encoder.encode('event: assign'));
    stream.enqueue(encoder.encode('ment\r\ndata: {}\r\n\r\nevent: assignment\ndata: {}\n\n'));
    await Promise.resolve(); await Promise.resolve();
  });
  await act(async () => { vi.advanceTimersByTime(250); });
  expect(invalidate).toHaveBeenCalledTimes(2);
  await act(async () => { vi.advanceTimersByTime(10 * 60_000); });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(invalidate).toHaveBeenCalledTimes(2);
  unmount();
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  stream.close();
});

it('does not subscribe without an authenticated session', () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  renderHook(() => useAssignmentEventStream(null), { wrapper });
  expect(fetch).not.toHaveBeenCalled();
});

it('reconnects after transport failure and cancels reconnection on unmount', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockRejectedValue(new Error('offline')); vi.stubGlobal('fetch', fetch);
  const { unmount } = renderHook(() => useAssignmentEventStream('user:org'), { wrapper });
  await act(async () => { await Promise.resolve(); });
  await act(async () => { vi.advanceTimersByTime(2000); await Promise.resolve(); });
  expect(fetch).toHaveBeenCalledTimes(2);
  unmount();
  await act(async () => { vi.advanceTimersByTime(60_000); });
  expect(fetch).toHaveBeenCalledTimes(2);
});

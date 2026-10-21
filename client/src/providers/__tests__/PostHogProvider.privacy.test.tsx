import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ user: null as any, loading: false, pathname: '/properties/PRIVATE',
  actor: vi.fn(), setActor: vi.fn(), capture: vi.fn(), enabled: false, listener: undefined as undefined | (() => void) }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user, loading: mocks.loading }) }));
vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: mocks.pathname }) }));
vi.mock('../../config/runtimeConfig', () => ({ runtimeEnvOr: () => 'staging' }));
vi.mock('../../services/baitlyTelemetryPrivacy', async importOriginal => ({
  ...await importOriginal<typeof import('../../services/baitlyTelemetryPrivacy')>(), baitlyAnalyticsActor: mocks.actor,
}));
vi.mock('../../services/baitlyAnalytics', () => ({
  baitlyAnalytics: { capture: mocks.capture }, setBaitlyAnalyticsActor: mocks.setActor,
  getBaitlyAnalytics: () => undefined, withBaitlyAnalytics: vi.fn(),
  isBaitlyAnalyticsEnabled: () => mocks.enabled,
  subscribeBaitlyAnalytics: (listener: () => void) => { mocks.listener = listener; return () => { mocks.listener = undefined; }; },
}));
import { usePostHogIdentify, usePostHogPageTracking } from '../PostHogProvider';

beforeEach(() => { vi.clearAllMocks(); mocks.user = null; mocks.loading = false; mocks.enabled = false; });

describe('Telemetry identity lifecycle', () => {
  it('does not restore an old identity when hashing finishes after account switch', async () => {
    let resolveOld!: (value: any) => void;
    const oldHash = new Promise(resolve => { resolveOld = resolve; });
    mocks.actor.mockReturnValueOnce(oldHash).mockResolvedValueOnce({ id: 'new-hash', organization: 'new-org' });
    mocks.user = { id: 'old-id', organizationId: 1, email: 'PRIVATE', fullName: 'PRIVATE' };
    const { rerender } = renderHook(() => usePostHogIdentify());
    mocks.user = { id: 'new-id', organizationId: 2, email: 'PRIVATE' }; rerender();
    await waitFor(() => expect(mocks.setActor).toHaveBeenLastCalledWith({ id: 'new-hash', organization: 'new-org' }));
    await act(async () => { resolveOld({ id: 'old-hash', organization: 'old-org' }); });
    expect(mocks.setActor).not.toHaveBeenCalledWith({ id: 'old-hash', organization: 'old-org' });
    expect(mocks.actor).toHaveBeenCalledWith('new-id', '2', 'staging');
    expect(JSON.stringify(mocks.actor.mock.calls)).not.toContain('PRIVATE');
  });

  it('clears identity on logout and has no raw-ID fallback on hash failure', async () => {
    mocks.actor.mockRejectedValueOnce(new Error('No WebCrypto'));
    mocks.user = { id: 'private-id', organizationId: 1 };
    const { rerender } = renderHook(() => usePostHogIdentify());
    await act(async () => {});
    expect(mocks.setActor.mock.calls.every(([actor]) => actor === undefined)).toBe(true);
    mocks.user = null; rerender();
    expect(mocks.setActor).toHaveBeenLastCalledWith(undefined);
  });

  it('emits a static page after consent changes without leaking the pathname', () => {
    renderHook(() => usePostHogPageTracking());
    expect(mocks.capture).not.toHaveBeenCalled();
    mocks.enabled = true; act(() => mocks.listener?.());
    expect(mocks.capture).toHaveBeenCalledWith('page_viewed', { page_name: 'properties_detail' });
    expect(JSON.stringify(mocks.capture.mock.calls)).not.toContain('PRIVATE');
  });
});

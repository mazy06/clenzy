import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import type { PostHog } from 'posthog-js';

vi.mock('../../config/runtimeConfig', () => ({
  runtimeEnv: () => 'phc_offline_public_fixture', runtimeEnvOr: () => 'https://analytics.example.invalid',
}));

const actor = { id: 'bt_' + 'a'.repeat(64), organization: 'bt_' + 'b'.repeat(64) };
let online: boolean;
let delivered: string[];
let sdk: PostHog;
let analytics: typeof import('../baitlyAnalytics');
let lateResponse: Promise<Response> | undefined;
let beaconDescriptor: PropertyDescriptor | undefined;
const beaconFixture = vi.fn(() => true);
const fetchFixture = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
  if (options?.signal?.aborted) throw new DOMException('Fixture request aborted', 'AbortError');
  if (lateResponse) return lateResponse;
  if (!online) throw new TypeError('Failed to fetch');
  delivered.push(String(url));
  return new Response('{}', { status: 200 });
});

beforeEach(async () => {
  vi.resetModules();
  online = true;
  delivered = [];
  lateResponse = undefined;
  fetchFixture.mockClear();
  beaconFixture.mockClear();
  beaconDescriptor = Object.getOwnPropertyDescriptor(navigator, 'sendBeacon');
  Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: beaconFixture });
  // The real SDK captures fetch at module evaluation. Never send to a live project.
  vi.stubGlobal('fetch', fetchFixture);
  // Use the SDK's synchronous gzip fallback; native compression workers use real time.
  vi.stubGlobal('CompressionStream', undefined);
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  vi.doMock('posthog-js', async () => {
    const actual = await vi.importActual<typeof import('posthog-js')>('posthog-js');
    class FixturePostHog extends actual.PostHog {
      constructor() { super(); sdk = this; }
    }
    // Also exercise the pre-fix implementation, which used the default singleton.
    return { ...actual, PostHog: FixturePostHog, default: new FixturePostHog() };
  });
  analytics = await import('../baitlyAnalytics');
  analytics.setBaitlyAnalyticsActor(actor);
  analytics.setBaitlyAnalyticsConsent(true);
  await analytics.startBaitlyAnalytics();
  await waitFor(() => expect(analytics.getBaitlyAnalytics()).toBeDefined());
  fetchFixture.mockClear();
  delivered = [];
  vi.useFakeTimers();
});

afterEach(() => {
  analytics?.setBaitlyAnalyticsConsent(false);
  sdk?.shutdown();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.doUnmock('posthog-js');
  if (beaconDescriptor) Object.defineProperty(navigator, 'sendBeacon', beaconDescriptor);
  else Reflect.deleteProperty(navigator, 'sendBeacon');
});

async function queueOfflineEvent() {
  online = false;
  window.dispatchEvent(new Event('offline'));
  expect(sdk.get_distinct_id()).toBe(actor.id);
  const observedCapture = vi.spyOn(sdk, 'capture');
  analytics.baitlyAnalytics.capture('page_viewed', { page_name: 'settings' });
  expect(observedCapture.mock.results.at(-1)?.value).toBeDefined();
  await vi.advanceTimersByTimeAsync(100);
  expect(fetchFixture).toHaveBeenCalled();
  expect(delivered).toHaveLength(0);
}

async function reconnect() {
  online = true;
  window.dispatchEvent(new Event('online'));
  await vi.advanceTimersByTimeAsync(120_000);
}

describe('Baitly consent withdrawal with real SDK network retries', () => {
  it('retries an offline event while consent remains valid (positive control)', async () => {
    await queueOfflineEvent();
    await reconnect();
    expect(delivered).toHaveLength(1);
  });

  it('does not deliver an offline event after consent is withdrawn', async () => {
    await queueOfflineEvent();
    analytics.setBaitlyAnalyticsConsent(false);
    await reconnect();
    expect(delivered).toHaveLength(0);
  });

  it('does not revive the old retry when the same account consents again', async () => {
    await queueOfflineEvent();
    analytics.setBaitlyAnalyticsConsent(false);
    analytics.setBaitlyAnalyticsConsent(true);
    await analytics.startBaitlyAnalytics();
    await reconnect();
    expect(delivered).toHaveLength(0);
    analytics.baitlyAnalytics.capture('page_viewed', { page_name: 'dashboard' });
    await vi.advanceTimersByTimeAsync(100);
    expect(delivered).toHaveLength(1);
  });

  it('does not send the previous actor retry after an organization switch', async () => {
    await queueOfflineEvent();
    analytics.setBaitlyAnalyticsActor({ id: 'bt_' + 'c'.repeat(64), organization: 'bt_' + 'd'.repeat(64) });
    analytics.setBaitlyAnalyticsConsent(true);
    await analytics.startBaitlyAnalytics();
    await reconnect();
    expect(delivered).toHaveLength(0);
  });

  it('does not flush revoked events through sendBeacon during page teardown', async () => {
    await queueOfflineEvent();
    analytics.setBaitlyAnalyticsConsent(false);
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    await reconnect();
    expect(beaconFixture).not.toHaveBeenCalled();
    expect(delivered).toHaveLength(0);
  });

  it('blocks retries from an old request that fails after a renewed agreement', async () => {
    let reply!: (response: Response) => void;
    lateResponse = new Promise(resolve => { reply = resolve; });
    analytics.baitlyAnalytics.capture('page_viewed', { page_name: 'settings' });
    await vi.advanceTimersByTimeAsync(100);
    expect(fetchFixture).toHaveBeenCalledOnce();
    const originalSignal = fetchFixture.mock.calls[0][1]?.signal;
    analytics.setBaitlyAnalyticsConsent(false);
    expect(originalSignal?.aborted).toBe(true);
    analytics.setBaitlyAnalyticsConsent(true);
    await analytics.startBaitlyAnalytics();
    lateResponse = undefined;
    reply(new Response('{}', { status: 503 }));
    await vi.advanceTimersByTimeAsync(180_000);
    expect(delivered).toHaveLength(0);
    analytics.baitlyAnalytics.capture('page_viewed', { page_name: 'dashboard' });
    await vi.advanceTimersByTimeAsync(100);
    expect(delivered).toHaveLength(1);
  });
});

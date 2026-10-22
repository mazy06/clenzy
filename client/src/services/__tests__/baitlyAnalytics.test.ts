import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ key: '', imports: vi.fn(), init: vi.fn(), capture: vi.fn(),
  identify: vi.fn(), reset: vi.fn(), opt_in_capturing: vi.fn(), opt_out_capturing: vi.fn() }));
vi.mock('../../config/runtimeConfig', () => ({ runtimeEnv: () => mocks.key, runtimeEnvOr: (_: string, fallback: string) => fallback }));
vi.mock('posthog-js', () => {
  mocks.imports();
  return { default: mocks };
});
const actor = { id: 'bt_' + 'a'.repeat(64), organization: 'bt_' + 'b'.repeat(64) };
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); mocks.key = ''; });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function allowed() {
  mocks.key = 'public-test-key';
  const analytics = await import('../baitlyAnalytics');
  analytics.setBaitlyAnalyticsActor(actor);
  analytics.setBaitlyAnalyticsConsent(true);
  await analytics.startBaitlyAnalytics();
  return analytics;
}

describe('Baitly analytics consent and privacy', () => {
  it('does not load SDK or queue pre-consent events even when a key exists', async () => {
    mocks.key = 'public-test-key';
    const analytics = await import('../baitlyAnalytics');
    analytics.setBaitlyAnalyticsActor(actor);
    analytics.baitlyAnalytics.capture('onboarding_completed');
    await analytics.startBaitlyAnalytics();
    expect(mocks.init).not.toHaveBeenCalled(); expect(mocks.imports).not.toHaveBeenCalled();
    analytics.setBaitlyAnalyticsConsent(true);
    await analytics.startBaitlyAnalytics(); mocks.init.mock.calls[0][1].loaded();
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it('does not load SDK without a key, pseudonym or when DNT is enabled', async () => {
    const analytics = await import('../baitlyAnalytics');
    analytics.setBaitlyAnalyticsActor(actor); analytics.setBaitlyAnalyticsConsent(true);
    await analytics.startBaitlyAnalytics(); expect(mocks.init).not.toHaveBeenCalled();
    mocks.key = 'public-test-key';
    analytics.setBaitlyAnalyticsActor(undefined); analytics.setBaitlyAnalyticsConsent(true);
    await analytics.startBaitlyAnalytics(); expect(mocks.init).not.toHaveBeenCalled();
    vi.stubGlobal('navigator', { doNotTrack: '1' });
    analytics.setBaitlyAnalyticsActor(actor); analytics.setBaitlyAnalyticsConsent(true);
    await analytics.startBaitlyAnalytics(); expect(mocks.init).not.toHaveBeenCalled();
  });

  it('initializes once, disables automatic capture, and filters both calls and SDK enrichment', async () => {
    const analytics = await allowed();
    analytics.baitlyAnalytics.capture('reservation_cancelled', { reservationId: 42, reason: 'Guest passport PRIVATE' });
    await analytics.startBaitlyAnalytics();
    expect(mocks.init).toHaveBeenCalledOnce();
    const options = mocks.init.mock.calls[0][1];
    expect(options).toMatchObject({ autocapture: false, capture_pageview: false, capture_pageleave: false,
      capture_exceptions: false, capture_performance: false, disable_session_recording: true,
      persistence: 'memory', disable_persistence: true, request_batching: false });
    options.loaded();
    expect(mocks.identify).toHaveBeenCalledWith(actor.id);
    expect(mocks.capture).toHaveBeenCalledWith('reservation_cancelled', {});
    const sent = options.before_send({ uuid: 'id', event: 'reservation_cancelled',
      properties: { distinct_id: actor.id, reason: 'PRIVATE', $current_url: 'https://host/?token=PRIVATE',
        $set: { email: 'PRIVATE' }, reservationId: 42 }, $set_once: { name: 'PRIVATE' } });
    expect(JSON.stringify(sent)).not.toContain('PRIVATE');
    expect(sent.properties).toMatchObject({ distinct_id: actor.id, $groups: { organization: actor.organization } });
    expect(options.before_send({ uuid: 'id', event: '$snapshot', properties: { distinct_id: actor.id } })).toBeNull();
  });

  it('revocation and tenant switch drop old queued and already enriched events', async () => {
    const analytics = await allowed();
    analytics.baitlyAnalytics.capture('onboarding_completed');
    analytics.setBaitlyAnalyticsConsent(false);
    mocks.init.mock.calls[0][1].loaded();
    expect(mocks.capture).not.toHaveBeenCalled();
    expect(mocks.opt_out_capturing).toHaveBeenCalled();
    expect(analytics.getBaitlyAnalytics()).toBeUndefined();
    expect(mocks.init.mock.calls[0][1].before_send({ uuid: 'id', event: 'onboarding_completed', properties: { distinct_id: actor.id } })).toBeNull();
  });

  it('reset on logout prevents new events being attached to previous account', async () => {
    const analytics = await allowed(); mocks.init.mock.calls[0][1].loaded();
    analytics.setBaitlyAnalyticsActor({ id: 'bt_' + 'c'.repeat(64), organization: 'bt_' + 'd'.repeat(64) });
    analytics.baitlyAnalytics.capture('invoice_issued', { invoiceId: 22 });
    expect(mocks.reset).toHaveBeenCalledWith(true);
    expect(mocks.capture).not.toHaveBeenCalled();
    analytics.setBaitlyAnalyticsConsent(true);
    await analytics.startBaitlyAnalytics();
    expect(mocks.init.mock.calls[0][1].before_send({ uuid: 'id', event: 'invoice_issued', properties: { distinct_id: actor.id } })).toBeNull();
  });

  it('bounds the queue and isolates SDK failures from business operations', async () => {
    const analytics = await allowed();
    for (let i = 0; i < 250; i++) analytics.baitlyAnalytics.capture('invoice_issued');
    mocks.init.mock.calls[0][1].loaded(); expect(mocks.capture).toHaveBeenCalledTimes(200);
    mocks.capture.mockImplementationOnce(() => { throw new Error('SDK offline'); });
    expect(() => analytics.baitlyAnalytics.capture('invoice_issued')).not.toThrow();
  });

  it('does not flush an old tenant queue if consent is renewed before the loaded callback', async () => {
    const analytics = await allowed();
    analytics.baitlyAnalytics.capture('reservation_created', { nights: 99 });
    analytics.setBaitlyAnalyticsActor({ id: 'bt_' + 'c'.repeat(64), organization: 'bt_' + 'd'.repeat(64) });
    analytics.setBaitlyAnalyticsConsent(true);
    analytics.baitlyAnalytics.capture('reservation_created', { nights: 2 });
    mocks.init.mock.calls[0][1].loaded();
    expect(mocks.capture).toHaveBeenCalledExactlyOnceWith('reservation_created', { nights: 2 });
    expect(mocks.identify).toHaveBeenLastCalledWith('bt_' + 'c'.repeat(64));
  });

  it('can retry a failed initialization without replaying stale events', async () => {
    mocks.init.mockImplementationOnce(() => { throw new Error('SDK offline'); });
    const analytics = await allowed();
    await analytics.startBaitlyAnalytics();
    mocks.init.mock.calls.at(-1)![1].loaded();
    analytics.baitlyAnalytics.capture('invoice_issued');
    expect(mocks.capture).toHaveBeenCalledExactlyOnceWith('invoice_issued', {});
  });
});

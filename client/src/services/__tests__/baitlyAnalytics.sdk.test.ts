import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('../../config/runtimeConfig', () => ({
  runtimeEnv: () => 'phc_test_public_key', runtimeEnvOr: () => 'https://example.invalid',
}));
afterEach(() => { vi.unstubAllGlobals(); });

describe('Baitly privacy with the installed PostHog SDK', () => {
  it('keeps the ingestion token but strips automatically enriched URLs and private properties', async () => {
    // Install before importing SDK: its transport captures fetch at module evaluation.
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const analytics = await import('../baitlyAnalytics');
    analytics.setBaitlyAnalyticsActor({ id: 'bt_' + 'a'.repeat(64), organization: 'bt_' + 'b'.repeat(64) });
    analytics.setBaitlyAnalyticsConsent(true);
    await analytics.startBaitlyAnalytics();
    await waitFor(() => expect(analytics.getBaitlyAnalytics()).toBeDefined());
    const sdk = analytics.getBaitlyAnalytics()!;
    expect(sdk.config.disable_persistence).toBe(true);
    expect(Object.keys(localStorage).map(key => localStorage.getItem(key)).join(' ')).not.toContain('bt_' + 'a'.repeat(64));
    expect(document.cookie).not.toContain('bt_' + 'a'.repeat(64));
    const captured = sdk.capture('reservation_created', {
      nights: 3, amount: 999, guestEmail: 'PRIVATE', $current_url: 'https://host/?token=PRIVATE',
      $set: { name: 'PRIVATE' }, $referrer: 'https://PRIVATE',
    });
    expect(captured).toBeDefined();
    expect(captured?.properties.token).toBe('phc_test_public_key');
    expect(captured?.properties.nights).toBe(3);
    expect(JSON.stringify(captured)).not.toContain('PRIVATE');
    expect(captured?.properties.$process_person_profile).toBe(false);
    expect(sdk.capture('$snapshot', { document: 'PRIVATE' })).toBeUndefined();
    analytics.setBaitlyAnalyticsConsent(false);
    expect(sdk.capture('reservation_created', { nights: 5 })).toBeUndefined();
    expect(fetch.mock.calls.every(([url]) => !String(url).includes('PRIVATE'))).toBe(true);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { baitlyAnalyticsActor, baitlyAnalyticsProperties, baitlyPostHogBeforeSend,
  baitlySentryBeforeSend, baitlyTelemetryScreen } from '../baitlyTelemetryPrivacy';

describe('Baitly outbound privacy boundary', () => {
  it('pseudonyms differ between tenants and environments and contain no raw identity', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const a = await baitlyAnalyticsActor('private@example.com', '42', 'staging');
    expect(a.id).toMatch(/^bt_[0-9a-f]{64}$/);
    expect(JSON.stringify(a)).not.toContain('private@example.com');
    expect(a).toEqual(await baitlyAnalyticsActor('private@example.com', '42', 'staging'));
    expect(a.id).not.toBe((await baitlyAnalyticsActor('private@example.com', '43', 'staging')).id);
    expect(a.id).not.toBe((await baitlyAnalyticsActor('private@example.com', '42', 'production')).id);
    vi.unstubAllGlobals();
  });

  it('uses static screens even with names, IDs and access tokens in the URL', () => {
    expect(baitlyTelemetryScreen('/properties/private-name/edit?token=SECRET#passport')).toBe('properties_edit');
    expect(baitlyTelemetryScreen('/login?email=PRIVATE')).toBeUndefined();
    expect(baitlyTelemetryScreen('/verify-key/SECRET')).toBeUndefined();
  });

  it('drops free text, money, resource IDs and unknown event names', () => {
    expect(baitlyAnalyticsProperties('reservation_created', {
      channel: 'booking', nights: 4, amount: 999, propertyId: 42, email: 'PRIVATE', notes: { code: 'PRIVATE' },
    })).toEqual({ channel: 'booking', nights: 4 });
    expect(baitlyAnalyticsProperties('PRIVATE', {})).toBeNull();
  });

  it('rejects unsolicited SDK events and profiles at the last gate', () => {
    const actor = { id: 'bt_' + 'a'.repeat(64), organization: 'bt_' + 'b'.repeat(64) };
    expect(baitlyPostHogBeforeSend({ uuid: 'id', event: '$identify', properties: { distinct_id: actor.id, email: 'PRIVATE' } }, actor, 'test')).toBeNull();
    expect(baitlyPostHogBeforeSend({ uuid: 'id', event: 'invoice_issued', properties: { distinct_id: 'old-account' } }, actor, 'test')).toBeNull();
  });

  it('Sentry retains location of failure while removing private strings throughout the event', () => {
    const hint = { attachments: [{ filename: 'private.pdf', data: 'PRIVATE' }] };
    const clean = baitlySentryBeforeSend({
      event_id: 'id', level: 'error', message: 'PRIVATE', user: { email: 'PRIVATE' },
      request: { url: 'https://example.com/?token=PRIVATE', data: 'PRIVATE', headers: { Cookie: 'PRIVATE' } },
      breadcrumbs: [{ message: 'PRIVATE' }], extra: { iban: 'PRIVATE' }, contexts: { react: { componentStack: 'PRIVATE' } },
      tags: { guest: 'PRIVATE', request_id: 'PRIVATE' }, fingerprint: ['PRIVATE'],
      exception: { values: [{ type: 'TypeError', value: 'PRIVATE',
        stacktrace: { frames: [{ filename: 'https://app.baitly.fr/assets/index-abc.js?token=PRIVATE',
          lineno: 42, colno: 7, vars: { passport: 'PRIVATE' }, context_line: 'PRIVATE', abs_path: 'PRIVATE' }] } }] },
    }, hint);
    expect(JSON.stringify(clean)).not.toContain('PRIVATE');
    expect(clean.exception?.values?.[0]).toMatchObject({ type: 'TypeError', stacktrace: { frames: [{ filename: '/assets/index-abc.js', lineno: 42, colno: 7 }] } });
    expect(hint.attachments).toEqual([]);
  });
});

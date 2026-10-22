import { afterEach, describe, expect, it } from 'vitest';
import * as Sentry from '@sentry/react';
import { baitlySentryOptions, reportBaitlyApiFailure } from '../baitlySentry';

afterEach(async () => { await Sentry.close(1000); });

describe('Baitly Sentry real SDK with local transport', () => {
  it('enables error handlers while excluding automatic private-content integrations', () => {
    const options = baitlySentryOptions();
    expect(options).toMatchObject({ defaultIntegrations: false, tracesSampleRate: 0,
      replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0, enableLogs: false, sendDefaultPii: false });
    expect(options.beforeSendTransaction?.({} as any, {})).toBeNull();
    expect(options.beforeBreadcrumb?.({ message: 'PRIVATE' }, {})).toBeNull();
    expect((options.integrations as Sentry.Integration[]).map(integration => integration.name)).toContain('GlobalHandlers');
  });

  it('detects an exception and serializes only safe fields without contacting Sentry', async () => {
    const envelopes: unknown[] = [];
    Sentry.init({ ...baitlySentryOptions(), dsn: 'https://public@example.invalid/1',
      transport: () => ({ send: async envelope => { envelopes.push(envelope); return { statusCode: 200 }; }, flush: async () => true }) });
    const error = new TypeError('PRIVATE passport IBAN guest@example.com');
    error.stack = 'TypeError: PRIVATE\n at save (https://app.baitly.fr/assets/index-abc.js:42:7)';
    const eventId = Sentry.captureException(error, { extra: { accessCode: 'PRIVATE' },
      user: { email: 'PRIVATE' }, attachments: [{ filename: 'private.pdf', data: 'PRIVATE' }] });
    await Sentry.flush(1000);
    expect(envelopes).toHaveLength(1);
    const json = JSON.stringify(envelopes);
    expect(json).toContain(eventId);
    expect(json).toContain('TypeError');
    expect(json).toContain('/assets/index-abc.js');
    expect(json).not.toContain('PRIVATE');
    expect(json).not.toContain('guest@example.com');
  });

  it('API failure is detectable while business validation is not reported as an incident', async () => {
    const envelopes: unknown[] = [];
    Sentry.init({ ...baitlySentryOptions(), dsn: 'https://public@example.invalid/1',
      transport: () => ({ send: async envelope => { envelopes.push(envelope); return { statusCode: 200 }; }, flush: async () => true }) });
    reportBaitlyApiFailure('POST', '/payments/private-guest?code=PRIVATE', 400);
    reportBaitlyApiFailure('POST', '/payments/private-guest?code=PRIVATE', 503, 'afae05bd-c110-48a4-a062-9f5320e410c0');
    await Sentry.flush(1000);
    expect(envelopes).toHaveLength(1);
    const json = JSON.stringify(envelopes);
    expect(json).toContain('BaitlyApiError'); expect(json).toContain('503');
    expect(json).toContain('afae05bd-c110-48a4-a062-9f5320e410c0');
    expect(json).not.toContain('PRIVATE'); expect(json).not.toContain('private-guest');
  });

  it('retains repeated API failures so volume alerts can detect an incident', async () => {
    const envelopes: unknown[] = [];
    Sentry.init({ ...baitlySentryOptions(), dsn: 'https://public@example.invalid/1',
      transport: () => ({ send: async envelope => { envelopes.push(envelope); return { statusCode: 200 }; }, flush: async () => true }) });
    reportBaitlyApiFailure('POST', '/payments/1', 503);
    reportBaitlyApiFailure('POST', '/payments/2', 503);
    await Sentry.flush(1000);
    expect(envelopes).toHaveLength(2);
    expect(JSON.stringify(envelopes)).toContain('baitly-api');
  });
});

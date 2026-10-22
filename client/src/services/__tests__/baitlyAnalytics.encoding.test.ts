import { afterEach, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { CompressionStream as NativeCompressionStream, TransformStream } from 'node:stream/web';
import { gunzipSync } from 'node:zlib';
import type { PostHog } from 'posthog-js';

vi.mock('../../config/runtimeConfig', () => ({
  runtimeEnv: () => 'phc_encoding_public_fixture', runtimeEnvOr: () => 'https://analytics.example.invalid',
}));

const instances: PostHog[] = [];
let analytics: typeof import('../baitlyAnalytics');
afterEach(async () => {
  analytics?.setBaitlyAnalyticsConsent(false);
  for (const instance of instances) await instance.shutdown();
  vi.unstubAllGlobals();
  vi.doUnmock('posthog-js');
});

it('cancels native asynchronous encoding before transport, even after renewed consent', async () => {
  let encodingGate = Promise.resolve();
  const encodingStarted = vi.fn();
  class ControlledCompressionStream {
    writable;
    readable;
    constructor() {
      const gate = encodingGate;
      const native = new NativeCompressionStream('gzip');
      this.writable = native.writable;
      this.readable = native.readable.pipeThrough(new TransformStream({
        async transform(chunk, controller) { await gate; controller.enqueue(chunk); },
      }));
      encodingStarted();
    }
  }
  const delivered: string[] = [];
  let blocked = 0;
  const fetchFixture = vi.fn(async (_url: unknown, options: RequestInit) => {
    if (options.signal?.aborted) {
      blocked++;
      throw new DOMException('Fixture request aborted', 'AbortError');
    }
    expect(options.credentials).toBe('omit');
    expect(options.referrerPolicy).toBe('no-referrer');
    expect(options.keepalive).toBe(false);
    const payload = gunzipSync(Buffer.from(options.body as ArrayBuffer)).toString();
    expect(payload).not.toContain('PRIVATE_FIXTURE');
    delivered.push(payload);
    return new Response('{}', { status: 200 });
  });
  vi.stubGlobal('fetch', fetchFixture);
  // Node 22's native Response returns buffers from outside jsdom's realm.
  // Browsers use one realm here; copy the native bytes without changing gzip.
  vi.stubGlobal('Response', class extends Response {
    async blob() {
      const blob = await super.blob();
      const read = blob.arrayBuffer.bind(blob);
      blob.arrayBuffer = async () => Uint8Array.from(new Uint8Array(await read())).buffer;
      return blob;
    }
  });
  vi.stubGlobal('CompressionStream', ControlledCompressionStream);
  vi.doMock('posthog-js', async () => {
    const actual = await vi.importActual<typeof import('posthog-js')>('posthog-js');
    return { ...actual, PostHog: class extends actual.PostHog {
      constructor() { super(); instances.push(this); }
    } };
  });
  analytics = await import('../baitlyAnalytics');
  analytics.setBaitlyAnalyticsActor({ id: 'bt_' + 'a'.repeat(64), organization: 'bt_' + 'b'.repeat(64) });
  analytics.setBaitlyAnalyticsConsent(true);
  await analytics.startBaitlyAnalytics();
  expect(analytics.isBaitlyAnalyticsEnabled()).toBe(true);
  await waitFor(() => expect(analytics.getBaitlyAnalytics()).toBeDefined());
  analytics.baitlyAnalytics.capture('page_viewed', { page_name: 'settings', email: 'PRIVATE_FIXTURE' });
  await waitFor(() => expect(encodingStarted).toHaveBeenCalledOnce());
  await waitFor(() => expect(fetchFixture).toHaveBeenCalledOnce());
  if (fetchFixture.mock.settledResults[0]?.type === 'rejected') throw fetchFixture.mock.settledResults[0].value;
  await waitFor(() => expect(delivered).toHaveLength(1));

  let release!: () => void;
  encodingGate = new Promise(resolve => { release = resolve; });
  analytics.baitlyAnalytics.capture('page_viewed', { page_name: 'planning', email: 'PRIVATE_FIXTURE' });
  await waitFor(() => expect(encodingStarted).toHaveBeenCalledTimes(2));
  expect(fetchFixture).toHaveBeenCalledOnce();
  analytics.setBaitlyAnalyticsConsent(false);
  analytics.setBaitlyAnalyticsConsent(true);
  await analytics.startBaitlyAnalytics();
  encodingGate = Promise.resolve();
  release();
  await waitFor(() => expect(blocked).toBe(1));
  expect(delivered).toHaveLength(1);
  analytics.baitlyAnalytics.capture('page_viewed', { page_name: 'dashboard' });
  await waitFor(() => expect(delivered).toHaveLength(2));
  expect(delivered.join(' ')).not.toContain('planning');
  expect(delivered[1]).toContain('dashboard');
});

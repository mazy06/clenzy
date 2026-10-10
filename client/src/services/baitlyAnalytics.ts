import type { PostHog } from 'posthog-js';
import { runtimeEnv, runtimeEnvOr } from '../config/runtimeConfig';

let client: PostHog | undefined;
let loading: Promise<void> | undefined;
const pending: Array<(sdk: PostHog) => void> = [];

export function getBaitlyAnalytics(): PostHog | undefined { return client; }

/** Bounded, memory-only queue while the optional SDK waits for startup. */
export function withBaitlyAnalytics(action: (sdk: PostHog) => void): void {
  if (!runtimeEnv('VITE_POSTHOG_KEY')) return;
  if (client) { action(client); return; }
  if (pending.length < 200) pending.push(action);
}

export function startBaitlyAnalytics(): Promise<void> {
  const key = runtimeEnv('VITE_POSTHOG_KEY');
  if (!key) return Promise.resolve();
  if (loading) return loading;
  loading = import('posthog-js').then(({ default: sdk }) => {
    sdk.init(key, {
      api_host: runtimeEnvOr('VITE_POSTHOG_HOST', 'https://eu.i.posthog.com'),
      person_profiles: 'identified_only',
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      // Baitly displays guest PII and access codes: preserve complete replay masking.
      mask_all_text: true,
      mask_all_element_attributes: true,
      session_recording: { recordCrossOriginIframes: false, maskAllInputs: true, maskTextSelector: '*' },
      persistence: 'localStorage+cookie',
      advanced_disable_flags: true,
      loaded: () => {
        client = sdk;
        pending.splice(0).forEach(action => action(sdk));
      },
    });
  }).catch(() => {
    // Optional analytics must not prevent the application from starting.
    pending.length = 0;
    loading = undefined;
  });
  return loading;
}

/** Small facade preserves synchronous capture call sites without importing the SDK. */
export const baitlyAnalytics = {
  capture: (...args: Parameters<PostHog['capture']>) => withBaitlyAnalytics(sdk => { sdk.capture(...args); }),
  identify: (...args: Parameters<PostHog['identify']>) => withBaitlyAnalytics(sdk => { sdk.identify(...args); }),
  group: (...args: Parameters<PostHog['group']>) => withBaitlyAnalytics(sdk => { sdk.group(...args); }),
};

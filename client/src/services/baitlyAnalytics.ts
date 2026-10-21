import type { PostHog } from 'posthog-js';
import { runtimeEnv, runtimeEnvOr } from '../config/runtimeConfig';
import { baitlyAnalyticsProperties, baitlyPostHogBeforeSend, isBaitlyPseudonym, type BaitlyAnalyticsActor } from './baitlyTelemetryPrivacy';

let client: PostHog | undefined;
let loading: Promise<void> | undefined;
const pending: Array<(sdk: PostHog) => void> = [];
let consent = false;
let actor: BaitlyAnalyticsActor | undefined;
let generation = 0;
const listeners = new Set<() => void>();

export function isBaitlyAnalyticsEnabled(): boolean {
  return consent && !!actor && !!runtimeEnv('VITE_POSTHOG_KEY')
    && (typeof navigator === 'undefined' || navigator.doNotTrack !== '1');
}

export function subscribeBaitlyAnalytics(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Session-only gate. Call only from a validated consent flow, never from an env flag. */
export function setBaitlyAnalyticsConsent(granted: boolean): void {
  consent = granted === true;
  if (!isBaitlyAnalyticsEnabled()) {
    generation++;
    pending.length = 0;
    try { client?.reset(true); client?.opt_out_capturing(); } catch { /* Optional SDK cannot break logout. */ }
  } else {
    void startBaitlyAnalytics();
  }
  listeners.forEach(listener => listener());
}

/** Switching account or tenant revokes the previous session's choice and queued work. */
export function setBaitlyAnalyticsActor(next: BaitlyAnalyticsActor | undefined): void {
  if (actor?.id === next?.id && actor?.organization === next?.organization) return;
  setBaitlyAnalyticsConsent(false);
  actor = next && isBaitlyPseudonym(next.id) && isBaitlyPseudonym(next.organization) ? next : undefined;
  listeners.forEach(listener => listener());
}

export function getBaitlyAnalyticsActor(): BaitlyAnalyticsActor | undefined { return actor; }

export function getBaitlyAnalytics(): PostHog | undefined { return isBaitlyAnalyticsEnabled() ? client : undefined; }

/** Bounded, memory-only queue while the optional SDK waits for startup. */
export function withBaitlyAnalytics(action: (sdk: PostHog) => void): void {
  if (!isBaitlyAnalyticsEnabled()) return;
  const current = generation;
  const guarded = (sdk: PostHog) => {
    if (current !== generation || !isBaitlyAnalyticsEnabled()) return;
    try { action(sdk); } catch { /* Monitoring is best effort, never a business failure. */ }
  };
  if (client) { guarded(client); return; }
  if (pending.length < 200) pending.push(guarded);
}

export function startBaitlyAnalytics(): Promise<void> {
  const key = runtimeEnv('VITE_POSTHOG_KEY');
  if (!key || !isBaitlyAnalyticsEnabled()) return Promise.resolve();
  if (client) {
    try { client.opt_in_capturing({ captureEventName: false }); client.identify(actor!.id); } catch { /* Optional. */ }
    return Promise.resolve();
  }
  if (loading) return loading;
  loading = import('posthog-js').then(({ default: sdk }) => {
    if (!isBaitlyAnalyticsEnabled()) { loading = undefined; return; }
    sdk.init(key, {
      api_host: runtimeEnvOr('VITE_POSTHOG_HOST', 'https://eu.i.posthog.com'),
      person_profiles: 'identified_only',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_dead_clicks: false,
      capture_heatmaps: false,
      capture_performance: false,
      capture_exceptions: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_product_tours: true,
      disable_web_experiments: true,
      disable_external_dependency_loading: true,
      ip: false,
      respect_dnt: true,
      // Baitly displays guest PII and access codes: preserve complete replay masking.
      mask_all_text: true,
      mask_all_element_attributes: true,
      session_recording: { recordCrossOriginIframes: false, maskAllInputs: true, maskTextSelector: '*' },
      persistence: 'memory',
      disable_persistence: true,
      opt_out_capturing_by_default: true,
      opt_out_persistence_by_default: true,
      request_batching: false,
      advanced_disable_flags: true,
      before_send: event => isBaitlyAnalyticsEnabled() ? baitlyPostHogBeforeSend(event, actor, key) : null,
      loaded: () => {
        client = sdk;
        if (!isBaitlyAnalyticsEnabled()) {
          sdk.opt_out_capturing(); sdk.reset(true); loading = undefined; return;
        }
        sdk.opt_in_capturing({ captureEventName: false });
        sdk.identify(actor!.id);
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
  capture: (event: string, props?: Record<string, unknown>) => {
    const safe = baitlyAnalyticsProperties(event, props);
    if (safe) withBaitlyAnalytics(sdk => { sdk.capture(event, safe); });
  },
};

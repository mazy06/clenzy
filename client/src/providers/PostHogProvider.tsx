import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { baitlyAnalytics as posthog, getBaitlyAnalytics, withBaitlyAnalytics,
  isBaitlyAnalyticsEnabled, setBaitlyAnalyticsActor, subscribeBaitlyAnalytics } from '../services/baitlyAnalytics';
import { baitlyAnalyticsActor, baitlyTelemetryScreen } from '../services/baitlyTelemetryPrivacy';
import { useAuth } from '../hooks/useAuth';

import { runtimeEnvOr } from '../config/runtimeConfig';
// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Configuration alone never grants consent. */
function isActive(): boolean {
  return isBaitlyAnalyticsEnabled();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. User identification
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PostHog user identification hook.
 * Builds an organization-scoped pseudonym, without names, email or raw IDs.
 *
 * Call this once in App.tsx after authentication.
 */
export function usePostHogIdentify() {
  const { user, loading } = useAuth();

  useLayoutEffect(() => {
    let cancelled = false;
    setBaitlyAnalyticsActor(undefined);
    if (!loading && user?.id && user.organizationId != null) {
      // Bind to the deployment as well: legacy staging may still declare VITE_ENV=production.
      // The origin is hashed locally, never emitted as an analytics property.
      const deployment = JSON.stringify([runtimeEnvOr('VITE_ENV', 'production'), window.location.origin]);
      void baitlyAnalyticsActor(String(user.id), String(user.organizationId), deployment)
        .then(actor => { if (!cancelled) setBaitlyAnalyticsActor(actor); })
        .catch(() => { /* No raw-ID fallback when WebCrypto is unavailable. */ });
    }
    return () => { cancelled = true; setBaitlyAnalyticsActor(undefined); };
  }, [user?.id, user?.organizationId, loading]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Page view tracking (named events)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tracks named page views on route changes.
 * Emits only a static screen name. Autocapture and automatic pageviews are off.
 *
 * Call this once in App.tsx.
 */
export function usePostHogPageTracking() {
  const location = useLocation();

  useEffect(() => {
    const track = () => {
      if (!isActive()) return;
      const page = baitlyTelemetryScreen(location.pathname);
      if (page) posthog.capture('page_viewed', { page_name: page });
    };
    track();
    return subscribeBaitlyAnalytics(track);
  }, [location.pathname]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Feature flags
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PostHog feature flag helpers.
 * Wraps posthog feature flag methods with a safe guard if PostHog is not initialized.
 *
 * Usage:
 *   if (featureFlags.isEnabled('new-dashboard')) { ... }
 *   const variant = featureFlags.getVariant('pricing-experiment');
 */
export const featureFlags = {
  /** Check if a feature flag is enabled for the current user. */
  isEnabled: (flagKey: string): boolean => {
    if (!isActive()) return false;
    return getBaitlyAnalytics()?.isFeatureEnabled(flagKey) ?? false;
  },

  /** Get the variant value of a multi-variant feature flag. */
  getVariant: (flagKey: string): string | boolean | undefined => {
    if (!isActive()) return undefined;
    return getBaitlyAnalytics()?.getFeatureFlag(flagKey);
  },

  /** Subscribe to a feature flag change (e.g., after remote evaluation). */
  onFlag: (flagKey: string, callback: (value: string | boolean) => void): void => {
    if (!isActive()) return;
    withBaitlyAnalytics(sdk => {
      sdk.onFeatureFlags(() => {
        const value = sdk.getFeatureFlag(flagKey);
        if (value !== undefined) callback(value);
      });
    });
  },

  /** Get all active feature flags for the current user (for debugging). */
  getAll: (): Record<string, string | boolean> => {
    if (!isActive()) return {};
    return getBaitlyAnalytics()?.featureFlags?.getFlagVariants?.() ?? {};
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Event tracking (domain events + funnels)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PostHog event tracking helper.
 * Provides type-safe wrappers around posthog.capture() for common Baitly events.
 *
 * Includes domain events (reservation, intervention, key code, invoice)
 * and funnel events (onboarding, check-in flow, key exchange flow).
 */
export const trackEvent = {
  // ─── Domain events ──────────────────────────────────────────────────────
  reservationCreated: (props: { channel?: string; amount?: number; nights?: number; propertyId?: number }) => {
    posthog.capture('reservation_created', props);
  },
  reservationCancelled: (props: { reservationId: number; reason?: string }) => {
    posthog.capture('reservation_cancelled', props);
  },
  interventionScheduled: (props: { type: string; teamId?: number; propertyId?: number; estimatedCost?: number }) => {
    posthog.capture('intervention_scheduled', props);
  },
  interventionCompleted: (props: { interventionId: number; type: string }) => {
    posthog.capture('intervention_completed', props);
  },
  keyCodeGenerated: (props: { provider: string; method: string; pointId?: number }) => {
    posthog.capture('key_code_generated', props);
  },
  invoiceGenerated: (props: { amount?: number; type: string; reservationId?: number }) => {
    posthog.capture('invoice_generated', props);
  },
  invoiceIssued: (props: { invoiceId: number }) => {
    posthog.capture('invoice_issued', props);
  },
  propertyCreated: (props: { propertyId?: number; type?: string }) => {
    posthog.capture('property_created', props);
  },
  messageTemplateSent: (props: { templateId?: number; channel: string; propertyId?: number }) => {
    posthog.capture('message_template_sent', props);
  },

  // ─── Feature usage ──────────────────────────────────────────────────────
  featureUsed: (featureName: string, props?: Record<string, unknown>) => {
    posthog.capture('feature_used', { feature_name: featureName, ...props });
  },
  dashboardTabViewed: (tabName: string) => {
    posthog.capture('dashboard_tab_viewed', { tab_name: tabName });
  },
  settingsChanged: (section: string) => {
    posthog.capture('settings_changed', { section });
  },

  // ─── Funnel: Onboarding ─────────────────────────────────────────────────
  // inscription → confirm → first property → first reservation
  onboardingStep: (props: { step: string; completed: boolean }) => {
    posthog.capture('onboarding_step', props);
  },
  onboardingCompleted: () => {
    posthog.capture('onboarding_completed');
  },

  // ─── Funnel: Check-in flow ──────────────────────────────────────────────
  // reservation → message envoyé → guest code reçu
  checkInMessageSent: (props: { reservationId: number; channel: string; hasAccessCode: boolean }) => {
    posthog.capture('checkin_message_sent', props);
  },

  // ─── Funnel: Key exchange ───────────────────────────────────────────────
  // config point → generate code → key collected
  keyExchangePointConfigured: (props: { provider: string; pointId?: number }) => {
    posthog.capture('key_exchange_point_configured', props);
  },
  keyExchangeCodeUsed: (props: { pointId: number; codeId: number }) => {
    posthog.capture('key_exchange_code_used', props);
  },

  // ─── Funnel: iCal sync ─────────────────────────────────────────────────
  icalImported: (props: { propertyId: number; reservationCount: number; source: string }) => {
    posthog.capture('ical_imported', props);
  },

  // ─── Funnel: Smart lock ─────────────────────────────────────────────────
  smartLockConfigured: (props: { deviceId: number; propertyId: number }) => {
    posthog.capture('smart_lock_configured', props);
  },

  // ─── Noise monitoring ───────────────────────────────────────────────────
  noiseDeviceConfigured: (props: { type: 'minut' | 'clenzy'; propertyId: number }) => {
    posthog.capture('noise_device_configured', props);
  },
  noiseAlertTriggered: (props: { propertyId: number; level: number }) => {
    posthog.capture('noise_alert_triggered', props);
  },
};

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import posthog from 'posthog-js';
import { useAuth } from '../hooks/useAuth';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns true if PostHog was initialized (key is present). */
function isActive(): boolean {
  return !!import.meta.env.VITE_POSTHOG_KEY;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. User identification
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PostHog user identification hook.
 * Identifies the current user in PostHog with their metadata
 * (role, organization, subscription plan) for analytics segmentation.
 *
 * Call this once in App.tsx after authentication.
 */
export function usePostHogIdentify() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user || !isActive()) return;

    posthog.identify(user.id, {
      email: user.email,
      name: user.fullName || user.username,
      role: user.platformRole || user.roles?.[0],
      organization_id: user.organizationId,
      organization_name: user.organizationName,
      plan: user.forfait,
    });

    // Set organization as a group for B2B analytics
    if (user.organizationId) {
      posthog.group('organization', String(user.organizationId), {
        name: user.organizationName,
        plan: user.forfait,
      });
    }
  }, [user, loading]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Page view tracking (named events)
// ═══════════════════════════════════════════════════════════════════════════════

/** Maps route patterns to readable page names for PostHog events. */
const PAGE_NAMES: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/planning': 'planning',
  '/reservations': 'reservations',
  '/properties': 'properties',
  '/interventions': 'interventions',
  '/calendar': 'calendar',
  '/billing': 'billing',
  '/reports': 'reports',
  '/teams': 'teams',
  '/users': 'users',
  '/settings': 'settings',
  '/tarification': 'tarification',
  '/documents': 'documents',
  '/channels': 'channels',
  '/channels/reviews': 'reviews',
  '/dynamic-pricing': 'dynamic_pricing',
  '/promotions': 'promotions',
  '/accounting': 'accounting',
  '/owner-portal': 'owner_portal',
  '/automation-rules': 'automation_rules',
  '/portfolios': 'portfolios',
  '/profile': 'profile',
  '/notifications': 'notifications',
  '/contact': 'contact',
};

/**
 * Resolves a pathname to a named page for analytics.
 * Handles both exact matches and parameterized routes.
 */
function resolvePageName(pathname: string): string | null {
  // Exact match
  if (PAGE_NAMES[pathname]) return PAGE_NAMES[pathname];

  // Parameterized routes: /properties/42 → properties_detail, /properties/42/edit → properties_edit
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length >= 2) {
    const base = `/${segments[0]}`;
    if (PAGE_NAMES[base]) {
      const suffix = segments.length >= 3 && segments[2] === 'edit' ? 'edit' : 'detail';
      // Skip numeric-only segments (IDs)
      if (/^\d+$/.test(segments[1])) {
        return `${PAGE_NAMES[base]}_${suffix}`;
      }
      // Named sub-routes: /properties/new
      if (segments[1] === 'new') return `${PAGE_NAMES[base]}_create`;
    }
  }

  return null;
}

/**
 * Tracks named page views on route changes.
 * Emits `$pageview` (already handled by autocapture) PLUS a named event
 * like `page_viewed` with `{ page_name: "dashboard" }` for easy funnel building.
 *
 * Call this once in App.tsx.
 */
export function usePostHogPageTracking() {
  const location = useLocation();
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    if (!isActive()) return;

    const { pathname } = location;

    // Avoid duplicate tracking on the same path
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;

    const pageName = resolvePageName(pathname);
    if (pageName) {
      posthog.capture('page_viewed', {
        page_name: pageName,
        page_path: pathname,
      });
    }
  }, [location]);
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
    return posthog.isFeatureEnabled(flagKey) ?? false;
  },

  /** Get the variant value of a multi-variant feature flag. */
  getVariant: (flagKey: string): string | boolean | undefined => {
    if (!isActive()) return undefined;
    return posthog.getFeatureFlag(flagKey);
  },

  /** Subscribe to a feature flag change (e.g., after remote evaluation). */
  onFlag: (flagKey: string, callback: (value: string | boolean) => void): void => {
    if (!isActive()) return;
    posthog.onFeatureFlags(() => {
      const value = posthog.getFeatureFlag(flagKey);
      if (value !== undefined) callback(value);
    });
  },

  /** Get all active feature flags for the current user (for debugging). */
  getAll: (): Record<string, string | boolean> => {
    if (!isActive()) return {};
    return posthog.featureFlags?.getFlagVariants?.() ?? {};
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Event tracking (domain events + funnels)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PostHog event tracking helper.
 * Provides type-safe wrappers around posthog.capture() for common Clenzy events.
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

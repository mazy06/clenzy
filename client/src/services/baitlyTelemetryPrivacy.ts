import type { ErrorEvent, EventHint } from '@sentry/react';
import type { CaptureResult } from 'posthog-js';

const PAGE_NAMES: Record<string, string> = {
  dashboard: 'dashboard', planning: 'planning', reservations: 'reservations',
  properties: 'properties', interventions: 'interventions', calendar: 'calendar',
  billing: 'billing', reports: 'reports', teams: 'teams', users: 'users',
  settings: 'settings', tarification: 'tarification', documents: 'documents',
  channels: 'channels', 'dynamic-pricing': 'dynamic_pricing', promotions: 'promotions',
  accounting: 'accounting', 'owner-portal': 'owner_portal', 'automation-rules': 'automation_rules',
  portfolios: 'portfolios', profile: 'profile', notifications: 'notifications',
  contact: 'contact', quotes: 'quotes', messaging: 'messaging', prospection: 'prospection',
};

/** Only static screen names leave the browser, never paths, hashes or query strings. */
export function baitlyTelemetryScreen(pathname: string): string | undefined {
  const [base, child, action] = pathname.split(/[?#]/)[0].split('/').filter(Boolean);
  if (!Object.prototype.hasOwnProperty.call(PAGE_NAMES, base)) return undefined;
  const page = PAGE_NAMES[base];
  if (!page) return undefined;
  if (!child) return page;
  if (base === 'channels' && child === 'reviews') return 'reviews';
  return `${page}_${child === 'new' ? 'create' : action === 'edit' ? 'edit' : 'detail'}`;
}

export const BAITLY_API_AREAS = ['reservations', 'payments', 'invoices', 'quotes', 'interventions',
  'properties', 'documents', 'channels', 'channex', 'messaging', 'auth', 'other'] as const;
export function baitlyApiArea(endpoint: string): string {
  const base = endpoint.split(/[?#]/)[0].split('/').filter(Boolean)[0];
  return BAITLY_API_AREAS.includes(base as typeof BAITLY_API_AREAS[number]) ? base : 'other';
}

export interface BaitlyAnalyticsActor { id: string; organization: string }
export const isBaitlyPseudonym = (value: unknown): value is string =>
  typeof value === 'string' && /^bt_[0-9a-f]{64}$/.test(value);

/** Pseudonymisation, not anonymisation. Missing WebCrypto means no identification. */
export async function baitlyAnalyticsActor(user: string, organization: string, environment: string): Promise<BaitlyAnalyticsActor> {
  const hash = async (kind: string, parts: string[]) => {
    const bytes = new TextEncoder().encode(JSON.stringify(['baitly-telemetry-v1', environment, kind, ...parts]));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return 'bt_' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  };
  return { id: await hash('user', [organization, user]), organization: await hash('organization', [organization]) };
}

const eventNames = new Set(['page_viewed', 'reservation_created', 'reservation_cancelled',
  'intervention_scheduled', 'intervention_completed', 'key_code_generated', 'invoice_generated',
  'invoice_issued', 'property_created', 'message_template_sent', 'feature_used', 'dashboard_tab_viewed',
  'settings_changed', 'onboarding_step', 'onboarding_completed', 'checkin_message_sent',
  'key_exchange_point_configured', 'key_exchange_code_used', 'ical_imported',
  'smart_lock_configured', 'noise_device_configured', 'noise_alert_triggered', 'api_request_failed']);
const screens = new Set([...Object.values(PAGE_NAMES), 'reviews'].flatMap(page =>
  [page, `${page}_create`, `${page}_detail`, `${page}_edit`]));
const channels = new Set(['airbnb', 'booking', 'vrbo', 'expedia', 'direct', 'ical', 'email', 'sms', 'whatsapp', 'other']);

/** Unknown/free-text/financial/entity fields are discarded, including SDK enrichment. */
export function baitlyAnalyticsProperties(event: string, props: Record<string, unknown> = {}): Record<string, unknown> | null {
  if (!eventNames.has(event)) return null;
  const safe: Record<string, unknown> = {};
  if (event === 'page_viewed' && typeof props.page_name === 'string' && screens.has(props.page_name)) safe.page_name = props.page_name;
  if (event === 'api_request_failed') {
    if (BAITLY_API_AREAS.includes(props.api_area as typeof BAITLY_API_AREAS[number])) safe.api_area = props.api_area;
    if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(String(props.method))) safe.method = props.method;
    if (typeof props.status_code === 'number' && (props.status_code === 0 || (props.status_code >= 500 && props.status_code <= 599))) safe.status_code = props.status_code;
  }
  if (typeof props.channel === 'string' && channels.has(props.channel)) safe.channel = props.channel;
  if (typeof props.completed === 'boolean') safe.completed = props.completed;
  for (const key of ['nights', 'reservationCount']) {
    const value = props[key];
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 10000) safe[key] = value;
  }
  return safe;
}

/** The last gate also strips automatic URLs, referrers, profiles and SDK super-properties. */
export function baitlyPostHogBeforeSend(event: CaptureResult | null, actor: BaitlyAnalyticsActor | undefined,
  projectToken: string): CaptureResult | null {
  if (!event || !actor || !projectToken || event.properties.distinct_id !== actor.id) return null;
  const props = baitlyAnalyticsProperties(event.event, event.properties);
  if (!props) return null;
  return { uuid: event.uuid, event: event.event, timestamp: event.timestamp,
    properties: { ...props, token: projectToken, distinct_id: actor.id, $groups: { organization: actor.organization },
      $geoip_disable: true, $process_person_profile: false } };
}

const errorTypes = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError',
  'URIError', 'EvalError', 'AggregateError', 'BaitlyApiError']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Keep diagnosis (type, compiled asset, line, status), never arbitrary exception text. */
export function baitlySentryBeforeSend(event: ErrorEvent, hint: EventHint): ErrorEvent {
  if (hint.attachments) hint.attachments = [];
  const tags: Record<string, string> = {};
  const screen = typeof location === 'undefined' ? undefined : baitlyTelemetryScreen(location.pathname);
  if (screen) tags.screen = screen;
  const source = event.tags ?? {};
  if (BAITLY_API_AREAS.includes(source.api_area as typeof BAITLY_API_AREAS[number])) tags.api_area = String(source.api_area);
  if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(String(source.method))) tags.method = String(source.method);
  if (/^(0|5\d\d)$/.test(String(source.http_status))) tags.http_status = String(source.http_status);
  if (typeof source.request_id === 'string' && uuid.test(source.request_id)) tags.request_id = source.request_id;
  return {
    type: undefined, event_id: event.event_id, timestamp: event.timestamp, platform: 'javascript',
    environment: ['production', 'staging', 'development', 'test'].includes(event.environment ?? '') ? event.environment : undefined,
    release: /^baitly@(?:[0-9a-f]{7,40}|\d+\.\d+\.\d+(?:[-.][A-Za-z0-9.-]+)?)$/.test(event.release ?? '') ? event.release : undefined,
    level: event.level,
    message: 'Baitly application error (private details withheld)', tags,
    ...(event.exception?.values?.some(error => error.type === 'BaitlyApiError') ? {
      fingerprint: ['baitly-api', tags.api_area ?? 'other', tags.method ?? 'unknown', tags.http_status ?? 'unknown'],
    } : {}),
    exception: { values: event.exception?.values?.slice(-8).map(exception => ({
      type: errorTypes.has(exception.type ?? '') ? exception.type : 'Error',
      value: 'Private error details withheld',
      mechanism: { type: 'generic', handled: exception.mechanism?.handled ?? false },
      stacktrace: { frames: exception.stacktrace?.frames?.slice(-40).map(frame => {
        const asset = frame.filename?.split(/[?#]/)[0].match(/\/assets\/([a-zA-Z0-9._-]+\.js)$/)?.[1];
        return { filename: asset ? `/assets/${asset}` : undefined,
          lineno: frame.lineno, colno: frame.colno, in_app: frame.in_app };
      }) },
    })) },
  };
}

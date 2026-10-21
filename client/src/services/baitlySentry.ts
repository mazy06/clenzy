import * as Sentry from '@sentry/react';
import { runtimeEnv, runtimeEnvOr } from '../config/runtimeConfig';
import { baitlyApiArea, baitlySentryBeforeSend } from './baitlyTelemetryPrivacy';
import { baitlyAnalytics } from './baitlyAnalytics';

export function baitlySentryOptions(): NonNullable<Parameters<typeof Sentry.init>[0]> {
  const environment = runtimeEnvOr('VITE_ENV', 'production');
  const version = import.meta.env.VITE_APP_VERSION;
  return {
    dsn: runtimeEnv('VITE_SENTRY_DSN'),
    environment: ['production', 'staging', 'development', 'test'].includes(environment) ? environment : 'unknown',
    release: typeof version === 'string' && /^[a-zA-Z0-9._-]{1,80}$/.test(version) ? `baitly@${version}` : undefined,
    sendDefaultPii: false,
    sendClientReports: false,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    enableLogs: false,
    defaultIntegrations: false,
    integrations: [Sentry.inboundFiltersIntegration(), Sentry.globalHandlersIntegration()],
    beforeSend: baitlySentryBeforeSend,
    beforeSendTransaction: () => null,
    beforeSendLog: () => null,
    beforeSendMetric: () => null,
    beforeBreadcrumb: () => null,
  };
}

/** Expected 4xx/abort are not incidents. No response body, headers, URL or thrown text. */
export function reportBaitlyApiFailure(method: string, endpoint: string, status: number, requestId?: string | null): void {
  if (status !== 0 && (status < 500 || status > 599)) return;
  const apiArea = baitlyApiArea(endpoint);
  try {
    const error = new Error('Baitly API request failed');
    error.name = 'BaitlyApiError';
    const validRequestId = requestId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId);
    Sentry.captureException(error, { tags: { api_area: apiArea, method,
      http_status: String(status), ...(validRequestId ? { request_id: requestId } : {}) } });
    baitlyAnalytics.capture('api_request_failed', { api_area: apiArea, method, status_code: status });
  } catch { /* A failed monitoring SDK must not change the API result. */ }
}

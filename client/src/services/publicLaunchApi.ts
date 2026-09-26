import { runtimeEnvOr } from '../config/runtimeConfig';
import type { AcquisitionContext } from './publicAcquisitionContext';

export interface PublicLaunchStatus {
  registrationsPaused: boolean;
  launchAt: string | null;
  launchTimeZone: string;
}

export interface WaitlistResult {
  alreadyRegistered: boolean;
  position: number;
}

export class LaunchApiError extends Error {
  constructor(public status: number) {
    super(`Launch request failed (${status})`);
  }
}

const base = runtimeEnvOr(
  'VITE_API_URL',
  runtimeEnvOr('VITE_API_BASE_URL', 'http://localhost:8084'),
)
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

export const publicLaunchApi = {
  async status(signal?: AbortSignal): Promise<PublicLaunchStatus> {
    const response = await fetch(`${base}/api/public/waitlist/launch`, {
      signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new LaunchApiError(response.status);
    const data = await response.json();
    if (
      !data ||
      typeof data.registrationsPaused !== 'boolean' ||
      typeof data.launchTimeZone !== 'string' ||
      !(
        data.launchAt === null ||
        (typeof data.launchAt === 'string' &&
          Number.isFinite(Date.parse(data.launchAt)))
      )
    ) {
      throw new LaunchApiError(502);
    }
    try {
      new Intl.DateTimeFormat('en', { timeZone: data.launchTimeZone });
    } catch {
      throw new LaunchApiError(502);
    }
    return data;
  },
  async subscribe(
    email: string,
    language: string,
    context: AcquisitionContext = {},
  ): Promise<WaitlistResult> {
    const response = await fetch(`${base}/api/public/waitlist`, {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        source: [`baitly-prelaunch-${language}`, context.plan, context.market]
          .filter(Boolean)
          .join('-'),
        propertyCount: context.properties?.toString(),
      }),
    });
    if (!response.ok) throw new LaunchApiError(response.status);
    const data = await response.json();
    if (
      !data ||
      typeof data.alreadyRegistered !== 'boolean' ||
      typeof data.position !== 'number'
    ) {
      throw new LaunchApiError(502);
    }
    return data;
  },
};

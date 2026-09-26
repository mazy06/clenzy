import { runtimeEnvOr } from '../../src/config/runtimeConfig';

export type ContactSubject = 'contact' | 'demo' | 'migration' | 'privacy';
export interface ContactRequest {
  plan?: string;
  market?: string;
  name: string;
  email: string;
  subject: ContactSubject;
  message: string;
  language: string;
  properties: string;
  tool: string;
  website: string;
}
export class ContactApiError extends Error {
  constructor(public status: number) {
    super('Contact request could not be confirmed');
  }
}
const base = runtimeEnvOr(
  'VITE_API_URL',
  runtimeEnvOr('VITE_API_BASE_URL', 'http://localhost:8084'),
)
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

/** Private destination stays on the server. The public form only submits the visitor's request. */
export async function submitContact(request: ContactRequest): Promise<void> {
  const response = await fetch(`${base}/api/public/support`, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...request, source: 'baitly-site' }),
  });
  if (!response.ok) throw new ContactApiError(response.status);
  const result = await response.json();
  if (result?.status !== 'success') throw new ContactApiError(502);
}

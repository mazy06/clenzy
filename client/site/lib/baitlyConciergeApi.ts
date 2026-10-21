import { runtimeEnvOr } from '../../src/config/runtimeConfig';
import { ownerCriteria,ownerCriteriaParams,type BaitlyOwnerCriteria } from '../../src/services/baitlyOwnerCriteria';

const origin = runtimeEnvOr('VITE_API_URL', runtimeEnvOr('VITE_API_BASE_URL', 'http://localhost:8084')).replace(/\/+$/, '').replace(/\/api$/, '');
const base = `${origin}/api/public/baitly-catalog/profiles`;
export interface BaitlyConciergeProfile {
  id: string; name: string; organization?: string; city?: string; bio?: string;
  role: string; coverUrl?: string; managementServices: string[]; managementFeePct?: number | null;
  properties: Array<{ id: string; name: string; city?: string; photos: string[] }>;
}
export class BaitlyInquiryError extends Error { constructor(public status: number) { super('Inquiry unavailable'); } }
async function read<T>(response: Response): Promise<T> {
  if (!response.ok) throw new BaitlyInquiryError(response.status);
  return response.json();
}
export const conciergePhotoUrl = (path: string) => path.startsWith('/api/') ? origin + path : path;
/** Keep declared campaign attribution through the directory, without forwarding arbitrary parameters. */
export function conciergeProfilePath(id: string,language: string,search: string) {
  const outgoing=ownerCriteriaParams(ownerCriteria(search),language,search);
  if(!new URLSearchParams(search).has('propertyType'))outgoing.delete('propertyType');
  return `/conciergeries/${encodeURIComponent(id)}?${outgoing}`;
}
export interface BaitlyConciergeMatch extends Omit<BaitlyConciergeProfile,'properties'> { cityEvidence?: 'PROFILE_CITY' | 'PUBLIC_HOME_CITY'; countryConfirmed: boolean }
export interface BaitlyConciergeResults { content: BaitlyConciergeMatch[]; totalElements: number; page: number; size: number }
export const baitlyConciergeApi = {
  matches(criteria: BaitlyOwnerCriteria,page: number,signal: AbortSignal): Promise<BaitlyConciergeResults> {
    const params=ownerCriteriaParams(criteria,'fr');params.delete('lang');params.delete('propertyType');params.set('page',String(page));
    return fetch(`${base}/matches?${params}`,{ signal,credentials:'omit' }).then(read<BaitlyConciergeResults>);
  },
  list: (signal: AbortSignal): Promise<BaitlyConciergeProfile[]> => fetch(`${base}?role=CONCIERGE`, { signal, credentials: 'omit' }).then(read<BaitlyConciergeProfile[]>),
  detail: (id: string, signal: AbortSignal): Promise<BaitlyConciergeProfile> => fetch(`${base}/${encodeURIComponent(id)}`, { signal, credentials: 'omit' }).then(read<BaitlyConciergeProfile>),
  async submit(id: string, payload: Record<string, unknown>): Promise<void> {
    const response = await fetch(`${base}/${encodeURIComponent(id)}/inquiries`, {
      method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000), body: JSON.stringify(payload),
    });
    const receipt = await read<{ status: string }>(response);
    if (receipt.status !== 'RECEIVED') throw new BaitlyInquiryError(502);
  },
};

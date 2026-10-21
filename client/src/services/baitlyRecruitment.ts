/** Stable category codes already used by the provider catalogue. */
export const BAITLY_RECRUITMENT_TRADES = ['CLEANING','LAUNDRY','KEYS','MAINTENANCE','EXTERIOR','POOL','PHOTOGRAPHY','OTHER'] as const;
export interface BaitlyRecruitmentPage {
  id?: string; published: boolean; recipientName: string; title: string; city: string;
  countryCode?: string; description?: string; services: string[];
}
export function recruitmentUrl(id: string,language: string) {
  return `https://baitly.fr/recrutement/${encodeURIComponent(id)}?lang=${['fr','en','ar'].includes(language)?language:'fr'}`;
}

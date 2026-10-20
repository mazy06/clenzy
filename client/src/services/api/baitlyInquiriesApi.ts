import apiClient from '../apiClient';
export interface BaitlyInquiry {
  id: number; prospect_id: number; profile_id: string; purpose: string; name: string; email: string;
  phone?: string; city: string; property_type: string; message?: string; reply_channel: string;
  utm_source?: string; utm_medium?: string; utm_campaign?: string; referrer_host?: string;
  needs_review: boolean; status: string; created_at: string;
  country_code?: string; requested_services?: string[]; max_management_fee_pct?: number;
  recruitment_title?:string; application_services?:string[]; application_availability?:string;
}
export interface BaitlyPublication {
  id?: string; name?: string; city?: string; bio?: string; networkPublished?: boolean;
  bookingDomain?: string; avatarUrl?: string; propertyIds?: number[]; managementServices?: string[];
  hideLastName?: boolean; publishFinancialPerformance?: boolean; managementFeePct?: number;
}
export const baitlyInquiriesApi = {
  list: (page: number, contactId?: number) => apiClient.get<{ content: BaitlyInquiry[]; totalElements: number }>('/prospect-inquiries',{ params: { page,contactId } }),
  status: (id: number,status: string) => apiClient.patch<void>(`/prospect-inquiries/${id}`,{ status }),
  publication: () => apiClient.get<{ available: boolean; profile: BaitlyPublication }>('/prospect-inquiries/publication'),
  publish: (profile: BaitlyPublication) => apiClient.put<BaitlyPublication>('/prospect-inquiries/publication',{
    published: !!profile.networkPublished, name: profile.name, city: profile.city || null, bio: profile.bio || null,
    bookingUrl: profile.bookingDomain || null, avatarUrl: profile.avatarUrl || null,
    propertyIds: profile.propertyIds ?? [], managementServices: profile.managementServices ?? [],
    seekingManagement: false, hideLastName: !!profile.hideLastName, publishFinancialPerformance: !!profile.publishFinancialPerformance,
    managementFeePct: profile.managementFeePct ?? null,
  }),
};

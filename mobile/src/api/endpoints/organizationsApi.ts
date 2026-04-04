import { apiClient } from '../apiClient';

export interface OrganizationDto {
  id: number;
  name: string;
  slug?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  logoUrl?: string;
  subscriptionPlan?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  joinedAt: string;
}

export interface InviteMemberRequest {
  email: string;
  role: string;
}

export const organizationsApi = {
  getCurrent() {
    return apiClient.get<OrganizationDto>('/organizations/current');
  },

  getMembers(orgId: number) {
    return apiClient.get<OrganizationMember[]>(`/organizations/${orgId}/members`);
  },

  inviteMember(orgId: number, request: InviteMemberRequest) {
    return apiClient.post<void>(`/organizations/${orgId}/invitations`, request);
  },

  removeMember(orgId: number, memberId: number) {
    return apiClient.delete(`/organizations/${orgId}/members/${memberId}`);
  },
};

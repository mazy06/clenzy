import apiClient from '../apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OrganizationMemberDto {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  roleInOrg: string;
  joinedAt: string;
}

export interface ChangeRoleRequest {
  role: string;
}

// ─── API ────────────────────────────────────────────────────────────────────

export const organizationMembersApi = {
  /**
   * Lister les membres d'une organisation
   */
  list(orgId: number) {
    return apiClient.get<OrganizationMemberDto[]>(`/organizations/${orgId}/members`);
  },

  /**
   * Changer le role d'un membre dans l'organisation
   */
  changeRole(orgId: number, memberId: number, role: string) {
    return apiClient.put<OrganizationMemberDto>(
      `/organizations/${orgId}/members/${memberId}/role`,
      { role } as ChangeRoleRequest,
    );
  },

  /**
   * Retirer un membre de l'organisation
   */
  remove(orgId: number, memberId: number) {
    return apiClient.delete(`/organizations/${orgId}/members/${memberId}`);
  },
};

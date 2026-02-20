import apiClient from '../apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface InvitationDto {
  id: number;
  organizationId: number;
  organizationName: string;
  invitedEmail: string;
  roleInvited: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  invitedByName: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string;
  invitationLink?: string;
}

export interface SendInvitationRequest {
  email: string;
  role?: string;
}

export interface AcceptInvitationRequest {
  token: string;
}

// ─── API ────────────────────────────────────────────────────────────────────

export const invitationsApi = {
  /**
   * Obtenir les infos d'une invitation (public, pas de JWT requis)
   */
  getInfo(token: string) {
    return apiClient.get<InvitationDto>('/invitations/info', {
      params: { token },
      skipAuth: true,
    });
  },

  /**
   * Accepter une invitation (JWT requis)
   */
  accept(token: string) {
    return apiClient.post<InvitationDto>('/invitations/accept', { token } as AcceptInvitationRequest);
  },

  /**
   * Envoyer une invitation (ADMIN/MANAGER)
   */
  send(orgId: number, data: SendInvitationRequest) {
    return apiClient.post<InvitationDto>(`/organizations/${orgId}/invitations`, data);
  },

  /**
   * Lister les invitations d'une organisation (ADMIN/MANAGER)
   */
  list(orgId: number) {
    return apiClient.get<InvitationDto[]>(`/organizations/${orgId}/invitations`);
  },

  /**
   * Annuler une invitation (ADMIN/MANAGER)
   */
  cancel(orgId: number, invitationId: number) {
    return apiClient.delete(`/organizations/${orgId}/invitations/${invitationId}`);
  },

  /**
   * Renvoyer une invitation (ADMIN/MANAGER)
   */
  resend(orgId: number, invitationId: number) {
    return apiClient.post<InvitationDto>(
      `/organizations/${orgId}/invitations/${invitationId}/resend`
    );
  },
};

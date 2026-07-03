import apiClient from '../apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OwnerPropertySummary {
  propertyId: number;
  propertyName: string;
  revenue: number;
  occupancyRate: number;
  reservationCount: number;
}

export interface OwnerDashboard {
  ownerId: number;
  totalProperties: number;
  activeReservations: number;
  totalRevenue: number;
  totalCommissions: number;
  netRevenue: number;
  averageOccupancy: number;
  averageRating: number;
  revenueByMonth: Record<string, number>;
  properties: OwnerPropertySummary[];
}

export interface StatementLine {
  date: string;
  description: string;
  propertyName: string;
  type: string;
  amount: number;
  commission: number;
  net: number;
}

export interface OwnerStatement {
  ownerId: number;
  ownerName: string;
  periodStart: string;
  periodEnd: string;
  totalRevenue: number;
  totalCommissions: number;
  totalExpenses: number;
  netAmount: number;
  lines: StatementLine[];
}

// Lien public Constellation Propriétaire (campagne X9)
export interface OwnerPortalLink {
  id: number;
  url: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
}

// ─── API ────────────────────────────────────────────────────────────────────

export const ownerPortalApi = {
  async getDashboard(ownerId: number): Promise<OwnerDashboard> {
    return apiClient.get<OwnerDashboard>(`/owner-portal/dashboard/${ownerId}`);
  },

  async createConstellationLink(ownerId: number): Promise<OwnerPortalLink> {
    return apiClient.post<OwnerPortalLink>(`/owner-portal/constellation-links/${ownerId}`, {});
  },

  async listConstellationLinks(ownerId: number): Promise<OwnerPortalLink[]> {
    return apiClient.get<OwnerPortalLink[]>(`/owner-portal/constellation-links/${ownerId}`);
  },

  async revokeConstellationLink(linkId: number): Promise<void> {
    return apiClient.post<void>(`/owner-portal/constellation-links/${linkId}/revoke`, {});
  },

  async getBranding(): Promise<{ logoUrl: string | null; primaryColor: string | null }> {
    return apiClient.get(`/owner-portal/branding`);
  },

  async updateBranding(logoUrl: string, primaryColor: string): Promise<{ logoUrl: string | null; primaryColor: string | null }> {
    return apiClient.put(`/owner-portal/branding`, { logoUrl, primaryColor });
  },

  async getStatement(
    ownerId: number,
    from: string,
    to: string,
    ownerName: string,
  ): Promise<OwnerStatement> {
    return apiClient.get<OwnerStatement>(`/owner-portal/statement/${ownerId}`, {
      params: { from, to, ownerName },
    });
  },
};

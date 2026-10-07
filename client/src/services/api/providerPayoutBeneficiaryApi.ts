import apiClient from '../apiClient';

export interface ProviderPayoutChoice {
  organizationId: number | null;
  organizationName: string | null;
  selected: boolean;
  locked: boolean;
  selectedAt: string | null;
}

export const providerPayoutBeneficiaryApi = {
  choice: (missionId: number) => apiClient.get<ProviderPayoutChoice>(`/interventions/${missionId}/payout-beneficiary`),
  selectOrganization: (missionId: number, organizationId: number) =>
    apiClient.put<ProviderPayoutChoice>(`/interventions/${missionId}/payout-beneficiary`, { organizationId }),
};

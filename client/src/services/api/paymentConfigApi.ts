import apiClient from '../apiClient';
import type { PaymentMethodConfig, PaymentMethodConfigUpdate, PaymentProviderType } from '../../types/payment';

export const paymentConfigApi = {
  async getConfigs(): Promise<PaymentMethodConfig[]> {
    return apiClient.get<PaymentMethodConfig[]>('/payment-configs');
  },

  async updateConfig(providerType: PaymentProviderType, data: PaymentMethodConfigUpdate): Promise<PaymentMethodConfig> {
    return apiClient.put<PaymentMethodConfig>(`/payment-configs/${providerType}`, data);
  },

  async getDefaults(countryCode: string): Promise<string[]> {
    return apiClient.get<string[]>(`/payment-configs/defaults/${countryCode}`);
  },
};

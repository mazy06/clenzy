import apiClient from '../apiClient';
import type { SplitConfiguration, SplitRatios } from '../../types/payment';

export const splitConfigApi = {
  async getConfigs(): Promise<SplitConfiguration[]> {
    return apiClient.get<SplitConfiguration[]>('/split-configs');
  },

  async getCurrentRatios(): Promise<SplitRatios> {
    return apiClient.get<SplitRatios>('/split-configs/current-ratios');
  },

  async create(data: Omit<SplitConfiguration, 'id'>): Promise<SplitConfiguration> {
    return apiClient.post<SplitConfiguration>('/split-configs', data);
  },

  async update(id: number, data: Partial<SplitConfiguration>): Promise<SplitConfiguration> {
    return apiClient.put<SplitConfiguration>(`/split-configs/${id}`, data);
  },

  async remove(id: number): Promise<void> {
    return apiClient.delete(`/split-configs/${id}`);
  },
};

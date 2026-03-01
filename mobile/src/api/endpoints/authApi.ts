import { apiClient } from '../apiClient';
import { API_CONFIG } from '@/config/api';

export const authApi = {
  getMe() {
    return apiClient.get(API_CONFIG.ENDPOINTS.ME);
  },

  syncPermissions(userId: string) {
    return apiClient.post(API_CONFIG.ENDPOINTS.PERMISSIONS_SYNC, { userId });
  },

  registerDevice(fcmToken: string, platform: 'ios' | 'android') {
    return apiClient.post(API_CONFIG.ENDPOINTS.DEVICE_REGISTER, { fcmToken, platform });
  },

  unregisterDevice(fcmToken: string) {
    return apiClient.delete(`${API_CONFIG.ENDPOINTS.DEVICE_UNREGISTER}/${fcmToken}`);
  },
};

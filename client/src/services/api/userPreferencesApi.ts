import apiClient from '../apiClient';

export interface UserPreferencesDto {
  timezone: string;
  currency: string;
  language: string;
  /** Mode d'affichage UI : 'light' | 'dark' | 'auto'. */
  themeMode: string;
  notifyEmail: boolean;
  notifyPush: boolean;
  notifySms: boolean;
}

const userPreferencesApi = {
  getMyPreferences(): Promise<UserPreferencesDto> {
    return apiClient.get<UserPreferencesDto>('/user-preferences/me');
  },

  updateMyPreferences(data: Partial<UserPreferencesDto>): Promise<UserPreferencesDto> {
    return apiClient.put<UserPreferencesDto>('/user-preferences/me', data);
  },
};

export default userPreferencesApi;

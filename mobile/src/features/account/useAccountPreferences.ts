import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore, type AppLanguage, type ThemeMode } from '@/store/settingsStore';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { useBaitlyDataMode } from '@/config/baitlyDataMode';

interface Preferences { themeMode: 'auto' | 'light' | 'dark'; language: string }
export function useAccountPreferences() {
  const scope = useBaitlyScope();
  const cache = useQueryClient();
  const authenticated = useAuthStore(s => s.isAuthenticated);
  const mode = useBaitlyDataMode(s => s.mode);
  const queryKey = [...scope, 'account-preferences'];
  const query = useQuery({ queryKey, enabled: authenticated && mode === 'real', retry: false,
    queryFn: ({ signal }) => apiClient.get<Preferences>('/user-preferences/me', { signal }) });
  useEffect(() => {
    if (mode !== 'real' || !query.data) return;
    const settings = useSettingsStore.getState();
    const theme = query.data.themeMode;
    if (['auto', 'light', 'dark'].includes(theme)) settings.setThemeMode(theme === 'auto' ? 'system' : theme);
    if (['fr', 'en'].includes(query.data.language)) settings.setLanguage(query.data.language as AppLanguage);
  }, [query.data, mode]);
  async function save(patch: { themeMode?: ThemeMode; language?: AppLanguage }) {
    if (mode === 'real' && authenticated) {
      const result = await apiClient.put<Preferences>('/user-preferences/me', {
        ...patch, ...(patch.themeMode ? { themeMode: patch.themeMode === 'system' ? 'auto' : patch.themeMode } : {}),
      });
      cache.setQueryData(queryKey, result);
    } else {
      const settings = useSettingsStore.getState();
      if (patch.themeMode) settings.setThemeMode(patch.themeMode);
      if (patch.language) settings.setLanguage(patch.language);
    }
  }
  return { query, save };
}

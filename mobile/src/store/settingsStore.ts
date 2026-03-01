import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import i18n from '@/i18n/config';

const storage = createMMKV({ id: 'settings-store' });

export type ThemeMode = 'system' | 'light' | 'dark';
export type AppLanguage = 'fr' | 'en';

interface SettingsState {
  themeMode: ThemeMode;
  language: AppLanguage;

  setThemeMode: (mode: ThemeMode) => void;
  setLanguage: (lang: AppLanguage) => void;
  hydrate: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  themeMode: 'system',
  language: 'fr',

  setThemeMode: (mode) => {
    storage.set('theme_mode', mode);
    set({ themeMode: mode });
  },

  setLanguage: (lang) => {
    storage.set('language', lang);
    i18n.changeLanguage(lang);
    set({ language: lang });
  },

  hydrate: () => {
    try {
      const themeMode = (storage.getString('theme_mode') as ThemeMode) || 'system';
      const language = (storage.getString('language') as AppLanguage) || 'fr';

      // Sync i18n language
      if (language !== i18n.language) {
        i18n.changeLanguage(language);
      }

      set({ themeMode, language });
    } catch {
      // Corrupted storage, start fresh with defaults
    }
  },
}));

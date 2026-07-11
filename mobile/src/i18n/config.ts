import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import fr from './locales/fr.json';
import en from './locales/en.json';
import ar from './locales/ar.json';

const resources = {
  fr: { translation: fr },
  en: { translation: en },
  // Traductions arabes complètes (Moteur Ménage 4B). NOTE : le support du
  // layout RTL (I18nManager.forceRTL, miroir des écrans) est HORS scope —
  // seules les chaînes sont traduites.
  ar: { translation: ar },
};

// Detect device language, default to French
const deviceLanguage = Localization.getLocales()[0]?.languageCode || 'fr';
const supportedLanguage = deviceLanguage.startsWith('fr')
  ? 'fr'
  : deviceLanguage.startsWith('ar')
    ? 'ar'
    : 'en';

i18n.use(initReactI18next).init({
  resources,
  lng: supportedLanguage,
  fallbackLng: 'fr',
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

export default i18n;

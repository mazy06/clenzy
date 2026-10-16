import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import fr from './locales/fr.json';
import en from './locales/en.json';
import ar from './locales/ar.json';
import { mobileV1 } from './mobileV1';

const resources = {
  fr: { translation: fr, mobileV1: mobileV1.fr },
  en: { translation: en, mobileV1: mobileV1.en },
  // Les surfaces Baitly adaptent les alignements à i18n.dir().
  // La navigation native suit la direction du système.
  ar: { translation: ar, mobileV1: mobileV1.ar },
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

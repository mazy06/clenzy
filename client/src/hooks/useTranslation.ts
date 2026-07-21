import { useTranslation as useI18nTranslation } from 'react-i18next';
import storageService, { STORAGE_KEYS } from '../services/storageService';

export const useTranslation = () => {
  const { t, i18n } = useI18nTranslation();

  const changeLanguage = (lng: 'fr' | 'en' | 'ar') => {
    storageService.setItem(STORAGE_KEYS.LANGUAGE, lng);
    // changeLanguage est asynchrone (chunk de locale chargé en lazy) : ne
    // basculer la direction du document qu'une fois les ressources prêtes,
    // sinon le layout passerait en RTL avec les textes encore en ancienne
    // langue le temps du fetch.
    void i18n.changeLanguage(lng).then(() => {
      document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = lng;
    });
  };

  const currentLanguage = i18n.language || 'fr';

  return {
    t,
    changeLanguage,
    currentLanguage,
    isFrench: currentLanguage === 'fr',
    isEnglish: currentLanguage === 'en',
    isArabic: currentLanguage === 'ar',
  };
};

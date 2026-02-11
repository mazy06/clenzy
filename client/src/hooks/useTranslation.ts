import { useTranslation as useI18nTranslation } from 'react-i18next';
import storageService, { STORAGE_KEYS } from '../services/storageService';

export const useTranslation = () => {
  const { t, i18n } = useI18nTranslation();

  const changeLanguage = (lng: 'fr' | 'en') => {
    i18n.changeLanguage(lng);
    storageService.setItem(STORAGE_KEYS.LANGUAGE, lng);
  };

  const currentLanguage = i18n.language || 'fr';

  return {
    t,
    changeLanguage,
    currentLanguage,
    isFrench: currentLanguage === 'fr',
    isEnglish: currentLanguage === 'en',
  };
};

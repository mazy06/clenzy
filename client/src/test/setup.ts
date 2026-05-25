import '@testing-library/jest-dom';

// Initialise i18next pour que les composants qui appellent `t('key')` retournent
// les traductions reelles (FR par defaut) plutot que la cle brute. Sans cela,
// les assertions sur du texte traduit (ex: "WiFi" au lieu de "WIFI") echouent.
import i18n from '../i18n/config';

// Force la langue FR dans les tests — jsdom a `navigator.language === 'en-US'`
// par defaut, ce qui ferait basculer le LanguageDetector vers EN et casserait
// les assertions ecrites en francais.
i18n.changeLanguage('fr');

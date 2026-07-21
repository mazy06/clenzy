import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';

// Polyfill window.matchMedia : jsdom ne l'implemente pas mais plusieurs hooks
// (useThemeMode, useMediaQuery MUI, prefers-reduced-motion) l'utilisent au
// boot. Sans ca, ces hooks throw "matchMedia is not a function" en test.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),     // deprecated mais utilise par certains polyfills MUI
      removeListener: vi.fn(),  // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  });
}

// Initialise i18next pour que les composants qui appellent `t('key')` retournent
// les traductions reelles (FR par defaut) plutot que la cle brute. Sans cela,
// les assertions sur du texte traduit (ex: "WiFi" au lieu de "WIFI") echouent.
import i18n, { i18nInitPromise } from '../i18n/config';

// L'init i18next est asynchrone (locales chargees en lazy via import dynamique,
// resolu nativement par Vitest) : on attend que les ressources soient pretes
// avant les tests, sinon t('key') retournerait la cle brute.
await i18nInitPromise;

// Force la langue FR dans les tests — jsdom a `navigator.language === 'en-US'`
// par defaut, ce qui ferait basculer le LanguageDetector vers EN et casserait
// les assertions ecrites en francais.
await i18n.changeLanguage('fr');

// Reset l'instance i18n entre chaque test : un test qui change la langue
// (changeLanguage('en')) ne doit pas polluer les tests suivants (A5).
// Cleanup localStorage utilise par i18next-browser-languagedetector pour
// les memes raisons (la cle i18nextLng persiste sinon).
beforeEach(async () => {
  if (i18n.language !== 'fr') {
    // Await necessaire : le retour en FR peut recharger des ressources (async)
    await i18n.changeLanguage('fr');
  }
  try {
    window.localStorage.removeItem('i18nextLng');
  } catch {
    // localStorage indisponible en certains envs jsdom — ignore
  }
});

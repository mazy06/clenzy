import i18n from 'i18next';
import type { BackendModule, ReadCallback, ResourceKey } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// ─── Chargement LAZY des locales (audit perf 2026-07-21) ─────────────────────
// Les 3 fichiers fr/en/ar (~818 KB bruts) étaient importés statiquement et
// finissaient dans le chunk d'entrée. Le backend inline ci-dessous charge la
// locale active via un import dynamique : le pattern littéral
// `./locales/${lng}.json` fait générer par Rollup UN chunk par locale, chargé
// uniquement quand la langue est demandée (langue détectée au boot, ou
// fallback fr, ou switch utilisateur).
const lazyLocaleBackend: BackendModule = {
  type: 'backend',
  init: () => {
    // rien à initialiser — les imports dynamiques se suffisent
  },
  read: (lng: string, _ns: string, callback: ReadCallback) => {
    import(`./locales/${lng}.json`)
      .then((module) => callback(null, module.default as ResourceKey))
      .catch((error) => callback(error as Error, false));
  },
};

// Promesse d'init exposée pour main.tsx (attendre les ressources de la langue
// initiale AVANT le premier render — zéro flash de clés brutes) et pour les
// setups de test.
export const i18nInitPromise = i18n
  .use(lazyLocaleBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'fr',
    // Borne les imports dynamiques aux locales réellement embarquées : une
    // valeur localStorage exotique (ex. 'de', 'en-US') ne tente pas de charger
    // un chunk inexistant.
    supportedLngs: ['fr', 'en', 'ar'],
    // 'en-US' détecté par le navigateur → charge 'en' (pas de fichier régional).
    load: 'languageOnly',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    pluralSeparator: '_',
    contextSeparator: '_',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;

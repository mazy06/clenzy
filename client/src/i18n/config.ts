import i18n from 'i18next';
import type { BackendModule, ReadCallback, ResourceKey } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

/**
 * Départ anticipé posé par `index.html` : la locale détectée part au tout
 * début du document, en parallèle du chunk d'entrée.
 */
interface BootLocale {
  lng: string;
  version: string;
  promise: Promise<unknown>;
}

declare global {
  interface Window {
    __baitlyLocale?: BootLocale;
  }
}

// ─── Chargement des locales ──────────────────────────────────────────────────
//
// Les trois fichiers fr/en/ar (~1,1 Mo bruts) ont été successivement importés
// statiquement (tout dans le chunk d'entrée), puis chargés par import dynamique
// (un chunk par langue). Ce second état réglait le poids mais pas l'ORDRE : le
// chunk de locale ne pouvait partir qu'une fois le chunk d'entrée reçu et
// exécuté, et `main.tsx` bloque le premier rendu dessus — donc rien n'était
// peint pendant ce second aller-retour, mis bout à bout avec le premier.
//
// Les fichiers vivent désormais dans `public/`, servis en JSON plat :
//   - `index.html` lance la requête AVANT le chunk d'entrée, les deux
//     descendent ensemble ;
//   - `JSON.parse` remplace le parse d'un module JS de 300 Ko ;
//   - le fichier se cache indépendamment du hash du bundle (busting par le
//     paramètre `?v=` — cf. le plugin d'empreinte dans vite.config.ts).
const lazyLocaleBackend: BackendModule = {
  type: 'backend',
  init: () => {
    // rien à initialiser — le fetch se suffit
  },
  read: (lng: string, _ns: string, callback: ReadCallback) => {
    const boot = typeof window !== 'undefined' ? window.__baitlyLocale : undefined;
    const version = boot?.version ? `?v=${encodeURIComponent(boot.version)}` : '';

    const load = () =>
      fetch(`/locales/${lng}.json${version}`).then((r) => {
        if (!r.ok) throw new Error(`locale ${lng} HTTP ${r.status}`);
        return r.json() as Promise<unknown>;
      });

    // La langue demandée est presque toujours celle qu'`index.html` a devinée :
    // on réutilise SA promesse plutôt que d'en lancer une seconde. Un changement
    // de langue en cours de session part sur un fetch normal.
    //
    // Le `catch` n'est pas décoratif : une promesse rejetée le reste. Sans lui,
    // i18next qui redemande la même langue après un échec réseau recevrait
    // éternellement le PREMIER échec, et l'app resterait sur ses clés brutes
    // jusqu'au rechargement. Le repli refait une vraie requête.
    const payload = boot && boot.lng === lng ? boot.promise.catch(load) : load();

    payload
      .then((data) => callback(null, data as ResourceKey))
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
    // Borne les requêtes aux locales réellement embarquées : une valeur
    // localStorage exotique (ex. 'de', 'en-US') ne va pas chercher un fichier
    // inexistant. Ces règles sont RECOPIÉES dans le script de départ anticipé
    // d'index.html — les changer ici demande de les changer là-bas.
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

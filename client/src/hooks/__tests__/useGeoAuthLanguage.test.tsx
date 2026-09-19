import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import i18n from '../../i18n/config';
import { useGeoAuthLanguage } from '../useGeoAuthLanguage';

/**
 * Quelle langue voit un visiteur qui n'a pas encore de compte.
 *
 * <p>Trois signaux se disputent la reponse — son choix explicite, la langue de
 * son navigateur, le pays de son IP — et aucun test ne les departageait. Un
 * arabophone connecte depuis la France recevait un ecran francais sans recours,
 * et rien dans la suite ne le signalait.</p>
 */

const SESSION_COUNTRY_KEY = 'clenzy_auth_geo_country';
const SESSION_CHOICE_KEY = 'clenzy_auth_lang_choice';

/** Remplace `navigator.languages`, que jsdom expose en lecture seule. */
function setBrowserLanguages(languages: string[]) {
  Object.defineProperty(window.navigator, 'languages', {
    value: languages, configurable: true,
  });
  Object.defineProperty(window.navigator, 'language', {
    value: languages[0] ?? 'fr-FR', configurable: true,
  });
}

/** Repond a ipapi.co ; tout autre appel (locales) garde le stub d'origine. */
function stubGeo(countryCode: string | null) {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('ipapi.co')) {
      return countryCode === null
        ? Promise.reject(new Error('geoloc indisponible'))
        : Promise.resolve(new Response(JSON.stringify({ country_code: countryCode }), {
            status: 200, headers: { 'content-type': 'application/json' },
          }));
    }
    return original(input, init);
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

let restoreFetch: (() => void) | null = null;

beforeEach(async () => {
  sessionStorage.clear();
  setBrowserLanguages(['fr-FR']);
  await i18n.changeLanguage('fr');
});

afterEach(() => {
  restoreFetch?.();
  restoreFetch = null;
  cleanup();
  vi.restoreAllMocks();
});

describe('Langue des pages publiques', () => {
  it('suit la langue du navigateur, meme quand l’IP dit autre chose', async () => {
    // Le cas du rapport : navigateur en arabe, connexion depuis la France.
    setBrowserLanguages(['ar-MA', 'fr-FR']);
    restoreFetch = stubGeo('FR');

    const { result } = renderHook(() => useGeoAuthLanguage());

    await waitFor(() => expect(result.current.language).toBe('ar'));
    expect(i18n.language).toBe('ar');
    expect(result.current.isRtl).toBe(true);
  });

  it('retient la premiere langue RECONNUE, pas la premiere declaree', async () => {
    // `normalizeLanguage` ramenerait 'es' sur le francais : il faut poursuivre
    // la liste jusqu'a une langue que le produit parle vraiment.
    setBrowserLanguages(['es-ES', 'ar']);
    restoreFetch = stubGeo('FR');

    const { result } = renderHook(() => useGeoAuthLanguage());

    await waitFor(() => expect(result.current.language).toBe('ar'));
  });

  it('retombe sur le pays quand le navigateur ne parle aucune des trois langues', async () => {
    setBrowserLanguages(['es-ES']);
    restoreFetch = stubGeo('SA');

    const { result } = renderHook(() => useGeoAuthLanguage());

    await waitFor(() => expect(result.current.language).toBe('ar'));
    expect(sessionStorage.getItem(SESSION_COUNTRY_KEY)).toBe('SA');
  });

  it('ne touche a rien quand navigateur et geoloc sont muets', async () => {
    setBrowserLanguages(['es-ES']);
    restoreFetch = stubGeo(null); // ad-blocker, hors-ligne, timeout

    renderHook(() => useGeoAuthLanguage());

    // Laisse la promesse rejetee se resoudre avant de conclure.
    await act(async () => { await Promise.resolve(); });
    expect(i18n.language).toBe('fr');
  });

  it('fait primer le choix explicite sur les deux detections', async () => {
    setBrowserLanguages(['ar-MA']);
    restoreFetch = stubGeo('SA');

    const { result } = renderHook(() => useGeoAuthLanguage());
    await waitFor(() => expect(result.current.language).toBe('ar'));

    await act(async () => { result.current.chooseLanguage('en'); });

    await waitFor(() => expect(i18n.language).toBe('en'));
    expect(result.current.language).toBe('en');
    expect(sessionStorage.getItem(SESSION_CHOICE_KEY)).toBe('en');
  });

  it('garde le choix explicite en quittant la page', async () => {
    // Sans cela, passer du login aux CGU rendrait la langue detectee : le
    // visiteur qui vient de choisir l'arabe le perdrait au premier clic.
    setBrowserLanguages(['fr-FR']);
    restoreFetch = stubGeo('FR');

    const { result, unmount } = renderHook(() => useGeoAuthLanguage());
    await act(async () => { result.current.chooseLanguage('ar'); });
    await waitFor(() => expect(i18n.language).toBe('ar'));

    unmount();

    await act(async () => { await Promise.resolve(); });
    expect(i18n.language).toBe('ar');
  });

  it('reprend le choix de la session au montage suivant', async () => {
    sessionStorage.setItem(SESSION_CHOICE_KEY, 'ar');
    setBrowserLanguages(['fr-FR']);
    restoreFetch = stubGeo('FR');

    const { result } = renderHook(() => useGeoAuthLanguage());

    await waitFor(() => expect(result.current.language).toBe('ar'));
    expect(i18n.language).toBe('ar');
  });

  it('ignore une valeur de session qui n’est pas une langue du produit', async () => {
    sessionStorage.setItem(SESSION_CHOICE_KEY, 'de');
    setBrowserLanguages(['ar-MA']);
    restoreFetch = stubGeo('FR');

    const { result } = renderHook(() => useGeoAuthLanguage());

    await waitFor(() => expect(result.current.language).toBe('ar'));
  });
});

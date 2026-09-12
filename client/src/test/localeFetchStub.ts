import fr from '../../public/locales/fr.json';
import en from '../../public/locales/en.json';
import ar from '../../public/locales/ar.json';

/**
 * Sert les traductions depuis le disque, sous jsdom.
 *
 * <p>Les locales sont servies en production par une requete HTTP
 * (`/locales/<lng>.json`), pour qu'elles partent en parallele du chunk d'entree
 * plutot qu'a sa suite. Il n'y a pas de serveur dans la suite de tests : ce
 * stub intercepte CES URL-la, et uniquement celles-la, en laissant passer tout
 * le reste vers le `fetch` d'origine (que les tests remplacent parfois
 * eux-memes — on le relit donc a chaque appel).</p>
 *
 * <p>Charge avant `setup.ts`, qui attend l'init i18next.</p>
 */
const BUNDLES: Record<string, unknown> = { fr, en, ar };

const original = globalThis.fetch;

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const match = /\/locales\/(fr|en|ar)\.json/.exec(url);
  if (match) {
    return Promise.resolve(
      new Response(JSON.stringify(BUNDLES[match[1]]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }
  return original(input, init);
}) as typeof fetch;

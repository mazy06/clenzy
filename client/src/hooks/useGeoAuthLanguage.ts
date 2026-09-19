import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCountryDefaults } from '../utils/countryDefaults';
import type { AppLanguage } from '../utils/localeDate';

const SESSION_COUNTRY_KEY = 'clenzy_auth_geo_country';

/**
 * Langue choisie A LA MAIN par le visiteur sur une page publique.
 *
 * <p>La geolocalisation devine, elle ne decide pas : un arabophone qui se
 * connecte depuis la France voyait un ecran francais sans aucun moyen d'en
 * sortir. Ce choix prime donc sur la detection, et tient pour toute la session
 * — sinon passer du login aux CGU le perdrait a chaque navigation.</p>
 *
 * <p>En session et non en local : c'est un choix de consultation, pas une
 * preference de compte. Celle-ci est posee apres connexion, depuis les
 * parametres.</p>
 */
const SESSION_CHOICE_KEY = 'clenzy_auth_lang_choice';

const LANGUAGES: readonly AppLanguage[] = ['fr', 'en', 'ar'];

/**
 * Langue du NAVIGATEUR, si elle fait partie des trois que parle le produit.
 *
 * <p>C'est le signal le plus direct dont on dispose : l'utilisateur a lui-meme
 * regle son systeme. Le pays, lui, est une deduction — un arabophone a Paris a
 * une IP francaise, et l'ecran lui parlait francais sans recours.</p>
 *
 * <p>On parcourt {@code navigator.languages} dans l'ordre de preference declare
 * et on retient la premiere entree reconnue : un navigateur regle sur
 * `['es-ES', 'ar']` doit donner l'arabe, pas le repli francais de
 * {@link normalizeLanguage}, qui ramene TOUT inconnu sur `fr`.</p>
 */
function browserLanguage(): AppLanguage | null {
  const declared = typeof navigator === 'undefined'
    ? []
    : [...(navigator.languages ?? []), navigator.language];
  for (const tag of declared) {
    const base = (tag ?? '').toLowerCase().split('-')[0];
    if (LANGUAGES.includes(base as AppLanguage)) return base as AppLanguage;
  }
  return null;
}

function readChoice(): AppLanguage | null {
  try {
    const stored = sessionStorage.getItem(SESSION_CHOICE_KEY);
    return LANGUAGES.includes(stored as AppLanguage) ? (stored as AppLanguage) : null;
  } catch {
    // Navigation privee, stockage bloque : on retombe sur la detection.
    return null;
  }
}

/**
 * Override la langue UI sur les pages d'auth/inscription/legal en fonction de
 * la geolocalisation IP de l'utilisateur — IGNORE ses preferences i18n.
 *
 * <p>Ordre de decision, du plus fort au plus faible :</p>
 * <ol>
 *   <li><b>Choix explicite</b> du visiteur (selecteur de langue) — tient la session</li>
 *   <li><b>Langue du navigateur</b>, si c'est fr, en ou ar</li>
 *   <li><b>Pays de l'IP</b> : pays arabe → arabe, France/Maghreb → francais, sinon anglais</li>
 *   <li>A defaut, la langue en place n'est pas touchee</li>
 * </ol>
 *
 * <p><b>Pourquoi different du {@code useGeoDetection} global</b> : ce dernier
 * skip si l'utilisateur a deja une preference, et persiste son resultat en
 * localStorage. Les pages d'auth fonctionnent differemment : un user marocain
 * qui ouvre le lien d'inscription envoye par email doit voir la page en
 * francais meme s'il a (par ex.) son browser en anglais.</p>
 *
 * <p><b>Restore au unmount</b> : quand l'user quitte la page (navigate vers
 * le PMS apres login), on restore la langue user originale pour ne pas
 * polluer ses preferences. Cleanup garanti via effet React.</p>
 *
 * <p><b>Cache session</b> : le country code detecte est stocke en
 * sessionStorage — evite de refrapper ipapi.co a chaque navigation entre
 * pages auth (Login -> Inscription -> CGU).</p>
 *
 * <p><b>Fail-safe</b> : si l'API geoloc echoue (timeout, rate limit, hors-ligne),
 * la langue d'origine est conservee. Pas de blocage du rendu.</p>
 *
 * @returns isRtl : true si la langue detectee est l'arabe (utile pour le
 *   theme MUI : direction RTL + font Tajawal).
 */
export function useGeoAuthLanguage(): {
  isRtl: boolean;
  detectedLanguage: string | null;
  /** Langue effectivement affichee — a refleter dans le selecteur. */
  language: AppLanguage;
  /** Choix explicite du visiteur : prime sur la detection, tient la session. */
  chooseLanguage: (language: AppLanguage) => void;
} {
  const { i18n } = useTranslation();
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  // `chosen` pilote le rendu du selecteur ; la ref sert aux fermetures qui
  // vivent plus longtemps que le rendu — la reponse geoloc arrive jusqu'a 5 s
  // apres le montage, et le nettoyage lit l'etat au demontage.
  const [chosen, setChosen] = useState<AppLanguage | null>(() => readChoice());
  const chosenRef = useRef<AppLanguage | null>(chosen);

  useEffect(() => {
    // Sauvegarde la langue initiale pour restore au unmount
    const originalLanguage = i18n.language;
    let cancelled = false;
    let abortTimeoutId: ReturnType<typeof setTimeout> | undefined;

    const applyGeoLanguage = async () => {
      // 0. Un choix explicite bat la detection — y compris un choix pose
      //    pendant que la requete geoloc etait en vol.
      const choice = chosenRef.current;
      if (choice) {
        if (i18n.language !== choice) await i18n.changeLanguage(choice);
        return;
      }

      // 1. La langue du navigateur bat le pays quand elle est reconnue.
      //
      //    Ordre assume, et il renverse la regle d'origine (« le pays decide,
      //    meme si le navigateur dit autre chose ») : le pays repond a « d'ou
      //    se connecte cette personne », la question posee est « que lit-elle ».
      //    Un hote marocain en voyage, un arabophone installe en France : le
      //    navigateur le sait, l'adresse IP l'ignore. Le pays reste le repli
      //    lorsque le navigateur ne declare aucune des trois langues.
      const fromBrowser = browserLanguage();
      if (fromBrowser) {
        setDetectedLanguage(fromBrowser);
        if (i18n.language !== fromBrowser) await i18n.changeLanguage(fromBrowser);
        return;
      }

      // 2. Cache session : si on a deja detecte pendant cette session, reuse
      let countryCode = sessionStorage.getItem(SESSION_COUNTRY_KEY);

      if (!countryCode) {
        // 3. Premier appel : fetch ipapi.co avec timeout 5s
        try {
          const controller = new AbortController();
          abortTimeoutId = setTimeout(() => controller.abort(), 5000);
          const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
          clearTimeout(abortTimeoutId);
          if (!response.ok) return;
          const data = await response.json();
          countryCode = data?.country_code ?? null;
          if (countryCode) {
            sessionStorage.setItem(SESSION_COUNTRY_KEY, countryCode);
          }
        } catch {
          // Geoloc fail (timeout, network, ad-blocker) : on garde la langue UI actuelle
          return;
        }
      }

      if (cancelled || !countryCode || chosenRef.current) return;

      // 4. Map country → langue (reuse la table existante countryDefaults)
      const defaults = getCountryDefaults(countryCode);
      const detected = defaults.language;
      setDetectedLanguage(detected);

      // 5. Override i18n SI different de la langue actuelle
      if (i18n.language !== detected) {
        await i18n.changeLanguage(detected);
      }
    };

    void applyGeoLanguage();

    // 5. Cleanup : restore la langue user d'origine quand on quitte la page auth.
    //    Sans ca, la nav vers le PMS apres login garderait la langue geo-detected
    //    a la place de la preference user.
    return () => {
      cancelled = true;
      if (abortTimeoutId) clearTimeout(abortTimeoutId);
      // Un choix explicite ne se defait pas en quittant la page : le visiteur
      // qui passe le login en arabe doit retrouver l'arabe a l'ecran suivant.
      if (chosenRef.current) return;
      if (i18n.language !== originalLanguage) {
        void i18n.changeLanguage(originalLanguage);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run only on mount (intentional — i18n est stable, on capture la langue initiale)

  const chooseLanguage = useCallback(
    (language: AppLanguage) => {
      chosenRef.current = language;
      setChosen(language);
      try {
        sessionStorage.setItem(SESSION_CHOICE_KEY, language);
      } catch {
        // Stockage indisponible : le choix vaut au moins pour cette page.
      }
      void i18n.changeLanguage(language);
    },
    [i18n],
  );

  const language = (chosen ?? detectedLanguage ?? i18n.language ?? 'fr') as AppLanguage;
  const isRtl = useMemo(() => language === 'ar', [language]);

  return { isRtl, detectedLanguage, language, chooseLanguage };
}

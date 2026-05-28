import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCountryDefaults } from '../utils/countryDefaults';

const SESSION_COUNTRY_KEY = 'clenzy_auth_geo_country';

/**
 * Override la langue UI sur les pages d'auth/inscription/legal en fonction de
 * la geolocalisation IP de l'utilisateur — IGNORE ses preferences i18n.
 *
 * <p>Logique business :</p>
 * <ul>
 *   <li>IP dans un pays arabe (SA, AE, EG, etc.) → arabe</li>
 *   <li>IP en France ou Maghreb (MA, TN, DZ) → francais</li>
 *   <li>IP ailleurs → anglais</li>
 * </ul>
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
export function useGeoAuthLanguage(): { isRtl: boolean; detectedLanguage: string | null } {
  const { i18n } = useTranslation();
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);

  useEffect(() => {
    // Sauvegarde la langue initiale pour restore au unmount
    const originalLanguage = i18n.language;
    let cancelled = false;

    const applyGeoLanguage = async () => {
      // 1. Cache session : si on a deja detecte pendant cette session, reuse
      let countryCode = sessionStorage.getItem(SESSION_COUNTRY_KEY);

      if (!countryCode) {
        // 2. Premier appel : fetch ipapi.co avec timeout 5s
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
          clearTimeout(timeout);
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

      if (cancelled || !countryCode) return;

      // 3. Map country → langue (reuse la table existante countryDefaults)
      const defaults = getCountryDefaults(countryCode);
      const detected = defaults.language;
      setDetectedLanguage(detected);

      // 4. Override i18n SI different de la langue actuelle
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
      if (i18n.language !== originalLanguage) {
        void i18n.changeLanguage(originalLanguage);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run only on mount (intentional — i18n est stable, on capture la langue initiale)

  const isRtl = useMemo(
    () => (detectedLanguage ?? i18n.language) === 'ar',
    [detectedLanguage, i18n.language]
  );

  return { isRtl, detectedLanguage };
}

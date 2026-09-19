/**
 * Langue active, lue sur le singleton i18next.
 *
 * <p>Vit à part de `localeDate` pour garder celui-ci PUR : `localeDate` ne
 * connaît que les langues qu'on lui passe, ce qui le rend testable sans monter
 * i18next. Ici, on assume le singleton.</p>
 *
 * <h3>Quand s'en servir — et quand ne pas</h3>
 * <p>Pour les fonctions de formatage appelées <b>hors React</b> : mappers de
 * colonnes, constantes de listes, helpers de module. Leur faire descendre la
 * langue en paramètre aurait demandé de la traîner dans une centaine de
 * signatures.</p>
 *
 * <p><b>Contrepartie.</b> Lire un singleton n'abonne à rien : un composant
 * mémoïsé qui ne dépend que de ses props ne se repeint pas au changement de
 * langue, et garde ses dates dans l'ancienne jusqu'au rendu suivant. Dans un
 * composant, préférer `useDateFormat()` — qui, lui, abonne.</p>
 */
import i18n from '../i18n/config';
import { intlLocale, intlLocaleGregorian, normalizeLanguage, type AppLanguage } from './localeDate';

/** Langue de l'application active, normalisée. */
export function activeLanguage(): AppLanguage {
  return normalizeLanguage(i18n.language);
}

/**
 * Étiquette `Intl` de la langue active — calendrier hégirien compris en arabe.
 *
 * <p>À passer comme premier argument de `toLocaleDateString` &amp; consorts là
 * où le jeu d'options est propre au site d'appel et n'a pas d'équivalent
 * nommé dans `localeDate`.</p>
 */
export function activeIntlLocale(): string {
  return intlLocale(i18n.language);
}

/**
 * Étiquette `Intl` de la langue active, mais **toujours grégorienne**.
 *
 * <p>Pour les séries agrégées par mois civil côté serveur : la langue suit
 * l'utilisateur, le découpage reste celui des données.</p>
 */
export function activeIntlLocaleGregorian(): string {
  return intlLocaleGregorian(i18n.language);
}

import i18n from '../i18n/config';

/**
 * Message de validation resolu AU MOMENT de la validation, pas au chargement du
 * module : les schemas zod sont figes au demarrage, la langue de l'utilisateur
 * ne l'est pas. Le libelle francais reste le repli.
 */
export const vm = (key: string, fallback: string) => ({
  error: () => i18n.t(key, fallback) as string,
});

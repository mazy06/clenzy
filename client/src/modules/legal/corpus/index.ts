import { normalizeLanguage } from '../../../utils/localeDate';
import type { LegalDoc, LegalSlug } from './types';
import { LEGAL_DOCS_FR } from './fr';
import { LEGAL_DOCS_EN } from './en';
import { LEGAL_DOCS_AR } from './ar';

export type { LegalBlock, LegalDoc, LegalSlug } from './types';
export { LEGAL_SLUGS } from './types';

/**
 * Corpus juridique unique, servi au PMS comme a la landing.
 *
 * <p>Les deux applications portaient chacune leur texte. Ils se contredisaient
 * sur le droit applicable (francais d'un cote, marocain de l'autre), sur
 * l'editeur, sur l'autorite de controle et sur le role RGPD — et c'est le
 * brouillon du PMS que la case obligatoire de l'inscription faisait accepter.
 * Une seule source, donc, rendue partout.</p>
 */
const BY_LANGUAGE: Record<'fr' | 'en' | 'ar', LegalDoc[]> = {
  fr: LEGAL_DOCS_FR,
  en: LEGAL_DOCS_EN,
  ar: LEGAL_DOCS_AR,
};

/** Les trois documents dans la langue demandee. */
export function legalDocs(language: string | undefined | null): LegalDoc[] {
  return BY_LANGUAGE[normalizeLanguage(language)];
}

/**
 * Un document par son slug.
 *
 * <p>Le slug est le meme dans les trois langues : changer de langue ne change
 * pas d'URL, et un lien partage reste valide quelle que soit la langue de
 * celui qui l'ouvre.</p>
 */
export function getLegalDoc(
  slug: string | undefined,
  language: string | undefined | null,
): LegalDoc | undefined {
  return legalDocs(language).find((doc) => doc.slug === slug);
}

/** Slug du document qu'un utilisateur accepte a l'inscription. */
export const TERMS_SLUG: LegalSlug = 'cgv';

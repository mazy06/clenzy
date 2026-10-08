/**
 * Forme du corpus juridique, commune aux trois langues.
 *
 * <p>La STRUCTURE est identique d'une langue a l'autre — memes documents, memes
 * blocs, dans le meme ordre. Seul le texte change. C'est ce qui permet a la
 * suite de tests de verifier qu'aucune traduction n'a perdu un article en
 * route : un document juridique ampute ne se voit pas a la lecture d'un ecran.</p>
 */
export interface LegalBlock {
  id?: string;
  heading: string;
  paragraphs?: string[];
  list?: string[];
  table?: { headers: string[]; rows: string[][] };
}

export interface LegalDoc {
  /** Segment d'URL, IDENTIQUE dans les trois langues (`/legal/cgv`). */
  slug: string;
  title: string;
  intro: string;
  /** Date de derniere modification, en toutes lettres dans la langue du texte. */
  updated: string;
  blocks: LegalBlock[];
}

/** Les trois documents, dans l'ordre ou le pied de page les presente. */
export const LEGAL_SLUGS = ['mentions-legales', 'confidentialite', 'cgv'] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];

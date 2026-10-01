import type { LegalArticle } from './types';

/** Content only: country, source references and publication dates stay shared. */
export type ArabicArticle = Pick<
  LegalArticle,
  'title' | 'description' | 'scope' | 'facts' | 'checklist' | 'faq'
> & {
  imageAlt: string;
  sections: Omit<LegalArticle['sections'][number], 'sources'>[];
};

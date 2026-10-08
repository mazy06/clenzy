import { MOROCCO_ARTICLES } from './morocco';
import { FRANCE_ARTICLES } from './france';
import { SAUDI_ARTICLES } from './saudiArabia';
import { localizeArticle } from './localization';
import type { LegalArticle, LegalCountry } from './types';
export * from './types';
export {
  localizeArticle,
  articleLanguage,
  ARTICLE_LANGUAGES,
  legalSourceLabel,
} from './localization';
export const LEGAL_ARTICLES: LegalArticle[] = [
  ...MOROCCO_ARTICLES,
  ...FRANCE_ARTICLES,
  ...SAUDI_ARTICLES,
];
export { LEGAL_COUNTRIES, legalCountry, guidePath } from './countries';
export const legalArticle = (slug?: string, language = 'fr') => {
  const article = LEGAL_ARTICLES.find((a) => a.slug === slug);
  return article ? localizeArticle(article, language) : undefined;
};
export const articlesForCountry = (country: LegalCountry, language = 'fr') =>
  LEGAL_ARTICLES.filter((a) => a.country === country).map((a) =>
    localizeArticle(a, language),
  );
export const articlePath = (article: LegalArticle) =>
  `/ressources/blog/${article.slug}`;
export const articleSources = (article: LegalArticle) => [
  ...new Set(article.sections.flatMap((s) => s.sources)),
];
export const articleReadingMinutes = (article: LegalArticle) =>
  Math.max(
    1,
    Math.ceil(
      [
        article.description,
        article.scope,
        ...article.sections.flatMap((s) => [s.title, ...s.paragraphs]),
        ...article.checklist,
        ...article.faq.flatMap((f) => [f.q, f.a]),
      ]
        .join(' ')
        .split(/\s+/).length / 200,
    ),
  );

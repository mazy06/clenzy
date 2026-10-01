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
export const LEGAL_COUNTRIES = [
  {
    code: 'MA',
    slug: 'maroc',
    name: { fr: 'Maroc', en: 'Morocco', ar: 'المغرب' },
    scope: {
      fr: 'Hébergement chez l’habitant et obligations transversales des hébergements touristiques.',
      en: 'Homestays and cross-cutting obligations for tourist accommodation.',
      ar: 'الإيواء لدى الساكن والالتزامات المشتركة للإيواء السياحي.',
    },
  },
  {
    code: 'FR',
    slug: 'france',
    name: { fr: 'France', en: 'France', ar: 'فرنسا' },
    scope: {
      fr: 'Meublés de tourisme, résidences principales et secondaires. Les règles locales sont précisées dans chaque dossier.',
      en: 'Tourist rentals, main and second homes. Local conditions are identified in each guide.',
      ar: 'المساكن السياحية الرئيسية والثانوية، مع توضيح الشروط المحلية في كل دليل.',
    },
  },
  {
    code: 'SA',
    slug: 'arabie-saoudite',
    name: { fr: 'Arabie saoudite', en: 'Saudi Arabia', ar: 'السعودية' },
    scope: {
      fr: 'Unités de séjour privées. Règlement publié au journal officiel Umm Al-Qura le 11 septembre 2026.',
      en: 'Private hospitality units. Regulation published in Umm Al-Qura on 11 September 2026.',
      ar: 'وحدات الضيافة الخاصة. اللائحة المنشورة في أم القرى بتاريخ 11 سبتمبر 2026.',
    },
  },
] as const;
export const legalCountry = (value?: string | null) =>
  LEGAL_COUNTRIES.find((c) => c.code === value || c.slug === value);
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
export const guidePath = (country: LegalCountry) =>
  `/ressources/obligations/${legalCountry(country)!.slug}`;
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

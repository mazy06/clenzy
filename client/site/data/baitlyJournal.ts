import {
  BAITLY_RESOURCE_MESSAGES,
  type ResourceMessages,
} from '../lib/messages/baitlyResources';
import { LEGAL_MESSAGES } from '../lib/messages/baitlyLegal';
import type { SiteLanguage } from '../lib/siteLanguage';
import {
  LEGAL_ARTICLES,
  localizeArticle,
  articleLanguage,
  articlePath,
  articleReadingMinutes,
  legalCountry,
  type LegalCountry,
  type LegalTopic,
} from './legal';
import { legalArticleImage } from './legal/articleImages';

const PRACTICAL_ARTICLES = [
  {
    id: 'article-1',
    topic: 'revenus',
    image: '/articles/reservations-directes.webp',
  },
  {
    id: 'article-2',
    topic: 'voyageurs',
    image: '/articles/experience-voyageur-extras.webp',
  },
  {
    id: 'article-3',
    topic: 'exploitation',
    image: '/articles/rotation-menage.webp',
  },
] as const;

export const JOURNAL_ARTICLE_COUNT =
  LEGAL_ARTICLES.length + PRACTICAL_ARTICLES.length;

export interface JournalArticle {
  id: string;
  href: string;
  title: string;
  description: string;
  image: string;
  country?: LegalCountry;
  countryLabel: string;
  topic: LegalTopic | 'revenus';
  topicLabel: string;
  language: SiteLanguage;
  readingMinutes: number;
  searchText: string;
  reading?: ResourceMessages['blog']['articles'][number];
}

/** One catalog feeds the visible journal, its search and its public HTML. */
export function journalArticles(language: SiteLanguage): JournalArticle[] {
  const m = LEGAL_MESSAGES[language];
  return [
    ...PRACTICAL_ARTICLES.map((entry, index): JournalArticle => {
      const reading = BAITLY_RESOURCE_MESSAGES[language].blog.articles[index];
      const text = [
        reading.title,
        reading.intro,
        ...reading.sections.flatMap((s) => [s.title, s.copy]),
        reading.takeaway,
      ].join(' ');
      return {
        ...entry,
        href: `/ressources/blog#${entry.id}`,
        title: reading.title,
        description: reading.intro,
        countryLabel: m.all,
        topicLabel: m.topics[entry.topic],
        language,
        readingMinutes: Math.max(1, Math.ceil(text.split(/\s+/).length / 200)),
        searchText: `${text} ${reading.category} ${m.topics[entry.topic]}`,
        reading,
      };
    }),
    ...LEGAL_ARTICLES.map((article) => localizeArticle(article, language)).map(
      (article): JournalArticle => ({
        id: article.slug,
        href: articlePath(article),
        title: article.title,
        description: article.description,
        image: legalArticleImage(article.slug).thumbnail,
        country: article.country,
        countryLabel: legalCountry(article.country)!.name[
          articleLanguage(language)
        ],
        topic: article.topic,
        topicLabel:
          LEGAL_MESSAGES[articleLanguage(language)].topics[article.topic],
        language: articleLanguage(language),
        readingMinutes: articleReadingMinutes(article),
        searchText: [
          article.title,
          article.description,
          article.country,
          legalCountry(article.country)!.name[language],
          m.topics[article.topic],
          ...article.facts.map((f) => `${f.value} ${f.label}`),
          ...article.sections.flatMap((s) => [s.title, ...s.paragraphs]),
          ...(language !== 'fr'
            ? [article.guide[language].title, article.guide[language].copy]
            : []),
        ].join(' '),
      }),
    ),
  ];
}

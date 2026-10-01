import type { SiteLanguage } from '../../lib/siteLanguage';
import { LEGAL_MESSAGES } from '../../lib/messages/baitlyLegal';
import { canonicalUrl } from '../../lib/siteSeo';
import { ARABIC_ARTICLES } from './localization';
import { legalArticleImage } from './articleImages';
import { journalArticles } from '../baitlyJournal';
import { journalStaticHtml } from './journalStatic';
import { BAITLY_RESOURCE_MESSAGES } from '../../lib/messages/baitlyResources';
import {
  LEGAL_ARTICLES,
  articleLanguage,
  localizeArticle,
  legalSourceLabel,
  LEGAL_COUNTRIES,
  LEGAL_REVIEWED_AT,
  LEGAL_SOURCES,
  articlePath,
  articleSources,
  articlesForCountry,
  guidePath,
  legalArticle,
  legalCountry,
  type LegalArticle,
} from './index';

const ORIGIN = 'https://baitly.fr';
const e = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]!,
  );
const sourceLink = (id: string, language: SiteLanguage) =>
  `[${legalSourceLabel(id, language)}](${LEGAL_SOURCES[id].url})`;
const sourceHtml = (id: string, language: SiteLanguage) =>
  `<a href="${e(LEGAL_SOURCES[id].url)}">${e(legalSourceLabel(id, language))}</a>`;
const link = (path: string, title: string) =>
  `<a href="${e(path)}">${e(title)}</a>`;
const localizedPath = (path: string, language: SiteLanguage) => {
  const [base, hash] = path.split('#');
  return `${base}${language === 'fr' ? '' : `?lang=${language}`}${hash ? `#${hash}` : ''}`;
};
const articleMarkdown = (a: LegalArticle, language: SiteLanguage) => {
  const m = LEGAL_MESSAGES[language];
  return (
    [
      `# ${a.title}`,
      a.description,
      `${m.byline} · ${m.reviewed} ${LEGAL_REVIEWED_AT}`,
      `## ${m.audience}\n\n${a.scope}`,
      `## ${m.summary}\n\n${a.facts.map((f) => `- ${f.value} : ${f.label}`).join('\n')}`,
      ...a.sections.map(
        (s) =>
          `## ${s.title}\n\n${s.paragraphs.join('\n\n')}\n\n${s.sources.map((id) => sourceLink(id, language)).join(' · ')}`,
      ),
      `## ${m.actions}\n\n${a.checklist.map((t) => `- ${t}`).join('\n')}`,
      ...a.faq.map((f) => `## ${f.q}\n\n${f.a}`),
      `## ${m.sourcesMethod}\n\n${m.methodCopy}\n\n${articleSources(a)
        .map((id) => sourceLink(id, language))
        .join('\n\n')}`,
      `[${m.countryGuide} · ${legalCountry(a.country)!.name[language]}](${localizedPath(guidePath(a.country), language)})`,
    ].join('\n\n') + '\n'
  );
};

/** The same verified corpus feeds readers, Markdown negotiation and HTML crawlers. */
export function legalDocuments(
  language: SiteLanguage,
): Map<string, string> {
  const m = LEGAL_MESSAGES[language];
  const docs = new Map<string, string>();
  for (const country of LEGAL_COUNTRIES) {
    const articles = articlesForCountry(country.code, language);
    docs.set(
      guidePath(country.code),
      [
        `# ${m.eyebrow} · ${country.name[language]}`,
        m.intro,
        `${m.scope} : ${country.scope[language]}`,
        `${m.reviewed} ${LEGAL_REVIEWED_AT}`,
        ...articles.map(
          (a) =>
            `## ${language === 'fr' ? a.title : a.guide[language].title}\n\n${language === 'fr' ? a.description : a.guide[language].copy}\n\n${language !== 'en' ? a.facts.map((f) => `- ${f.value} : ${f.label}`).join('\n') : ''}\n\n[${language === 'en' ? m.readFr : m.read}](${localizedPath(articlePath(a), articleLanguage(language))})\n\n${articleSources(
              a,
            )
              .map((id) => sourceLink(id, language))
              .join('\n\n')}`,
        ),
        `## ${m.method}\n\n${m.methodCopy}`,
      ].join('\n\n') + '\n',
    );
  }
  docs.set(
    '/ressources/obligations',
    [
      `# ${m.title.replace('\n', ' ')}`,
      m.intro,
      ...LEGAL_COUNTRIES.map(
        (c) =>
          `[${c.name[language]}](${guidePath(c.code)}?lang=${language})\n\n${c.scope[language]}`,
      ),
      docs.get(guidePath('MA'))!.replace(/^# .+\n\n/, ''),
    ].join('\n\n'),
  );
  docs.set(
    '/ressources/blog',
    [
      `# ${m.journalTitle.replace('\n', ' ')}`,
      m.journalIntro,
      m.french,
      ...journalArticles(language).map((a) =>
        [
          `## [${a.title}](${localizedPath(a.href, a.language)})\n\n${a.description}`,
          ...(a.reading
            ? [
                ...a.reading.sections.map(
                  (s) => `### ${s.title}\n\n${s.copy}`,
                ),
                `### ${BAITLY_RESOURCE_MESSAGES[language].blog.takeaway}\n\n${a.reading.takeaway}`,
              ]
            : []),
        ].join('\n\n'),
      ),
    ]
      .filter(Boolean)
      .join('\n\n') + '\n',
  );
  for (const article of LEGAL_ARTICLES)
    docs.set(
      articlePath(article),
      articleMarkdown(
        localizeArticle(article, language),
        articleLanguage(language),
      ),
    );
  return docs;
}

export function legalStructuredData(
  path: string,
  language: SiteLanguage,
): Record<string, unknown>[] | undefined {
  const article = legalArticle(
    path.startsWith('/ressources/blog/')
      ? path.split('/').pop()
      : undefined,
    language,
  );
  const isGuide =
    path === '/ressources/obligations' ||
    path.startsWith('/ressources/obligations/');
  if (!article && !isGuide && path !== '/ressources/blog') return undefined;
  const contentLanguage = article ? articleLanguage(language) : language;
  const m = LEGAL_MESSAGES[contentLanguage];
  const country = legalCountry(path.split('/').pop());
  const url = canonicalUrl(path, contentLanguage);
  const name =
    article?.title ??
    (isGuide
      ? `${m.eyebrow}${country ? ` · ${country.name[language]}` : ''}`
      : m.journal);
  const crumbs = [
    { name: 'Baitly', item: canonicalUrl('/', contentLanguage) },
    {
      name: article
        ? m.journal
        : { fr: 'Ressources', en: 'Resources', ar: 'الموارد' }[language],
      item: canonicalUrl(
        article ? '/ressources/blog' : '/ressources',
        contentLanguage,
      ),
    },
    { name, item: url },
  ];
  return [
    article
      ? {
          '@context': 'https://schema.org',
          '@type': 'Article',
          '@id': url + '#article',
          mainEntityOfPage: url,
          headline: article.title,
          description: article.description,
          image: ORIGIN + legalArticleImage(article.slug).src,
          inLanguage: contentLanguage,
          dateModified: LEGAL_REVIEWED_AT,
          author: {
            '@type': 'Organization',
            name: m.byline,
            url: canonicalUrl('/ressources/blog', contentLanguage),
          },
          publisher: {
            '@type': 'Organization',
            name: 'Baitly',
            url: ORIGIN,
          },
          about: {
            '@type': 'Country',
            name: legalCountry(article.country)!.name[contentLanguage],
          },
          citation: articleSources(article).map(
            (id) => LEGAL_SOURCES[id].url,
          ),
          isAccessibleForFree: true,
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name,
          url,
          inLanguage: language,
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: (isGuide
              ? articlesForCountry(country?.code ?? 'MA', language).map(
                  (a) => ({
                    title: a.title,
                    href: localizedPath(
                      articlePath(a),
                      articleLanguage(language),
                    ),
                    language: articleLanguage(language),
                  }),
                )
              : journalArticles(language)
            ).map((a, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: a.title,
              url:
                ORIGIN +
                (a.href.includes('?')
                  ? a.href
                  : localizedPath(a.href, a.language)),
            })),
          },
        },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        ...c,
      })),
    },
  ];
}

/** Visible progressive HTML, replaced by React once the app loads; not hidden SEO text. */
export function legalStaticHtml(
  path: string,
  language: SiteLanguage,
): string | undefined {
  if (path === '/ressources/blog') return journalStaticHtml(language);
  const a = legalArticle(
    path.startsWith('/ressources/blog/')
      ? path.split('/').pop()
      : undefined,
    language,
  );
  const contentLanguage = a ? articleLanguage(language) : language;
  const m = LEGAL_MESSAGES[contentLanguage];
  const countryLinks = `<nav class="blg-countries" aria-label="${e(m.countries)}">${LEGAL_COUNTRIES.map((c) => link(`${guidePath(c.code)}?lang=${language}`, c.name[language])).join('')}</nav>`;
  let body: string;
  if (a) {
    body = `<article lang="${contentLanguage}" dir="${contentLanguage === 'ar' ? 'rtl' : 'ltr'}" class="blg-article-page"><header class="blg-article-header">${link(localizedPath('/ressources/blog', contentLanguage), m.back)}<h1>${e(a.title)}</h1><p>${e(a.description)}</p><p class="blg-byline">${e(m.byline)} · ${e(m.reviewed)} <time datetime="${LEGAL_REVIEWED_AT}">${e(m.date)}</time></p><img class="blg-article-cover" src="${e(legalArticleImage(a.slug).src)}" srcset="${e(legalArticleImage(a.slug).thumbnail)} 480w, ${e(legalArticleImage(a.slug).src)} 1200w" sizes="(max-width: 960px) calc(100vw - 40px), 920px" alt="${e(contentLanguage === 'ar' ? ARABIC_ARTICLES[a.slug].imageAlt : legalArticleImage(a.slug).alt)}" width="1200" height="800"></header><div class="blg-reading-body" style="max-width:760px;margin:auto"><section class="blg-essentials"><h2>${e(m.summary)}</h2><dl class="blg-facts">${a.facts.map((f) => `<div><dt>${e(f.label)}</dt><dd>${e(f.value)}</dd></div>`).join('')}</dl><p>${e(a.scope)}</p></section>${a.sections.map((s, i) => `<section id="partie-${i + 1}" class="blg-prose-section"><h2>${e(s.title)}</h2>${s.paragraphs.map((p) => `<p>${e(p)}</p>`).join('')}<ul class="blg-inline-sources">${s.sources.map((id) => `<li>${sourceHtml(id, language)}</li>`).join('')}</ul></section>`).join('')}<section class="blg-action-list"><h2>${e(m.actions)}</h2><ol>${a.checklist.map((t) => `<li>${e(t)}</li>`).join('')}</ol></section>${a.faq.map((f) => `<section class="blg-faq"><h2>${e(f.q)}</h2><p>${e(f.a)}</p></section>`).join('')}<section class="blg-article-references"><h2>${e(m.sourcesMethod)}</h2><p>${e(m.methodCopy)}</p><ul>${articleSources(
      a,
    )
      .map((id) => `<li>${sourceHtml(id, language)}</li>`)
      .join(
        '',
      )}</ul></section>${link(localizedPath(guidePath(a.country), contentLanguage), m.countryGuide + ' · ' + legalCountry(a.country)!.name[contentLanguage])}</div></article>`;
  } else if (
    path === '/ressources/obligations' ||
    LEGAL_COUNTRIES.some((c) => guidePath(c.code) === path)
  ) {
    const c = legalCountry(path.split('/').pop()) ?? LEGAL_COUNTRIES[0];
    const articles = articlesForCountry(c.code, language);
    body = `<header class="blg-hero"><div><h1>${e(path === '/ressources/obligations' ? m.title : `${m.eyebrow} · ${c.name[language]}`)}</h1><p>${e(m.intro)}</p></div></header>${countryLinks}<section class="blg-guide-sheet"><header class="blg-country-intro"><div><h2>${e(c.name[language])}</h2><p>${e(c.scope[language])}</p></div><p>${e(m.reviewed)} ${e(m.date)}</p></header><div style="padding:28px">${(
      ['ouvrir', 'accueillir', 'suivre'] as const
    )
      .map(
        (stage) =>
          `<section class="blg-stage" id="${stage}"><h2>${e(m.stages[stage])}</h2>${articles
            .filter((a) => a.stage === stage)
            .map(
              (a) =>
                `<article class="blg-obligation" style="display:block"><h3>${e(language === 'fr' ? a.title : a.guide[language].title)}</h3><p>${e(language === 'fr' ? a.description : a.guide[language].copy)}</p>${language !== 'en' ? `<dl class="blg-facts blg-facts-small">${a.facts.map((f) => `<div><dt>${e(f.label)}</dt><dd>${e(f.value)}</dd></div>`).join('')}</dl>` : ''}<p>${link(localizedPath(articlePath(a), articleLanguage(language)), language === 'en' ? m.readFr : m.read)}</p>${articleSources(
                  a,
                )
                  .map((id) => sourceHtml(id, language))
                  .join(' · ')}</article>`,
            )
            .join('')}</section>`,
      )
      .join(
        '',
      )}</div><section class="blg-reference-section"><h2>${e(m.method)}</h2><p>${e(m.methodCopy)}</p></section></section>`;
  } else return undefined;
  return `<main class="blg-page"><div class="site-shell">${body}</div></main>`;
}

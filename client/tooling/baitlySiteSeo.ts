import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Plugin, ResolvedConfig } from 'vite';
import { buildSiteRenderer, type SiteRenderer } from './baitlySiteRendering';
import { discoveryCatalog } from './baitlySiteDiscovery';
import {
  DISCOVERY_LANGUAGES,
  PRIVATE_SITE_PATHS,
  siteDocuments,
  type DiscoveryCatalog,
} from './baitlySiteContent';
import { BAITLY_CONTACT_MESSAGES } from '../site/lib/messages/baitlyContact';
import type { SiteLanguage } from '../site/lib/siteLanguage';
import { ACADEMY_EPISODES } from '../site/data/baitlyAcademyVideos';
import {
  legalArticle,
  legalCountry,
  articleLanguage,
  ARTICLE_LANGUAGES,
} from '../site/data/legal';
import {
  HOME_SEARCH,
  SITE_ORIGIN,
  canonicalUrl,
  isIndexablePath,
  robotsDirective,
} from '../site/lib/siteSeo';
import { legalArticleImage } from '../site/data/legal/articleImages';
import {
  legalStaticHtml,
  legalStructuredData,
} from '../site/data/legal/publication';
import {
  academyVideoMetadata,
  scriptSafeJson,
  type AcademyVideoMetadata,
} from '../site/lib/academyStructuredData';

export type PageMetadata = {
  title: string;
  description: string;
  index: boolean;
  image?: string;
  contentLanguage?: SiteLanguage;
  availableLanguages?: readonly SiteLanguage[];
  structuredData?: Record<string, unknown>[];
  /** Page d'épisode de l'Académie : vidéo, aperçu et données structurées VideoObject. */
  video?: AcademyVideoMetadata;
};
export type MetadataCatalog = Record<
  SiteLanguage,
  Record<string, PageMetadata>
>;
const ORIGIN = SITE_ORIGIN;
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );

/** The visible editorial copy also supplies crawl and sharing metadata. */
export function metadataCatalog(catalog: DiscoveryCatalog): MetadataCatalog {
  return Object.fromEntries(
    DISCOVERY_LANGUAGES.map((language) => {
      const result: Record<string, PageMetadata> = {};
      for (const [path, markdown] of siteDocuments(language, catalog)) {
        const parts = markdown.split('\n\n').filter(Boolean);
        const title = parts[0].replace(/^# /, '').replace(/\s+/g, ' ');
        const description =
          parts
            .slice(1)
            .find((part) => part.length > 50 && !/^[#\-[|]/.test(part)) ??
          title;
        const episode = ACADEMY_EPISODES.find(
          (item) => path === `/ressources/academie/${item.slug}`,
        );
        const article = legalArticle(
          path.startsWith('/ressources/blog/')
            ? path.split('/').pop()
            : undefined,
        );
        const country = path.startsWith('/ressources/obligations/')
          ? legalCountry(path.split('/').pop())
          : undefined;
        const countryTitle = country
          ? {
              fr: `Location saisonnière : réglementation et obligations · ${country.name.fr} | Baitly`,
              en: `Vacation rental rules and obligations · ${country.name.en} | Baitly`,
              ar: `أنظمة والتزامات الإيجار السياحي · ${country.name.ar} | Baitly`,
            }[language]
          : undefined;
        const editorialData = legalStructuredData(path, language);
        result[path] = {
          title:
            path === '/'
              ? HOME_SEARCH[language].title
              : (countryTitle ?? `${title.replace(/^Baitly · /, '')} | Baitly`),
          description:
            path === '/'
              ? HOME_SEARCH[language].description
              : (country?.scope[language] ?? description)
                  .replace(/\s+/g, ' ')
                  .slice(0, 190),
          index: isIndexablePath(path),
          ...(article
            ? {
                contentLanguage: articleLanguage(language),
                availableLanguages: ARTICLE_LANGUAGES,
                image: ORIGIN + legalArticleImage(article.slug).src,
              }
            : {}),
          ...(path === '/'
            ? {
                structuredData: [
                  {
                    '@context': 'https://schema.org',
                    '@type': 'Organization',
                    '@id': ORIGIN + '/#organization',
                    name: 'Baitly',
                    url: ORIGIN + '/',
                  },
                  {
                    '@context': 'https://schema.org',
                    '@type': 'WebSite',
                    '@id': ORIGIN + '/#website',
                    name: 'Baitly',
                    url: ORIGIN + '/',
                    inLanguage: [...DISCOVERY_LANGUAGES],
                    publisher: { '@id': ORIGIN + '/#organization' },
                  },
                  {
                    '@context': 'https://schema.org',
                    '@type': 'SoftwareApplication',
                    name: 'Baitly',
                    url: ORIGIN + '/',
                    applicationCategory: 'BusinessApplication',
                    operatingSystem: 'Web',
                    description: HOME_SEARCH[language].description,
                    inLanguage: [...DISCOVERY_LANGUAGES],
                    publisher: { '@id': ORIGIN + '/#organization' },
                  },
                ],
              }
            : editorialData
              ? { structuredData: editorialData }
              : {}),
          ...(episode
            ? { video: academyVideoMetadata(episode, language, ORIGIN) }
            : {}),
        };
      }
      for (const path of PRIVATE_SITE_PATHS)
        result[path] = {
          title: 'Baitly',
          description: BAITLY_CONTACT_MESSAGES[language].intro,
          index: false,
        };
      result['/404'] = {
        title: `404 | Baitly`,
        description: BAITLY_CONTACT_MESSAGES[language].notFoundCopy,
        index: false,
      };
      return [language, result];
    }),
  ) as MetadataCatalog;
}

export function metadataHtml(
  html: string,
  page: PageMetadata,
  pathname: string,
  language: SiteLanguage,
  staticHtml = legalStaticHtml(pathname, language) ?? '',
  publishedUrl?: string,
): string {
  const contentLanguage = page.contentLanguage ?? language;
  const url = canonicalUrl(pathname, contentLanguage);
  const locale = { fr: 'fr_FR', en: 'en_US', ar: 'ar_SA' };
  const head = [
    `<title>${escape(page.title)}</title>`,
    `<meta name="description" content="${escape(page.description)}">`,
    `<meta name="robots" content="${robotsDirective(page.index, Boolean(page.video))}">`,
    `<link rel="canonical" href="${escape(url)}">`,
    ...(page.availableLanguages ?? DISCOVERY_LANGUAGES).map(
      (lang) =>
        `<link rel="alternate" hreflang="${lang}" href="${escape(canonicalUrl(pathname, lang))}">`,
    ),
    `<link rel="alternate" hreflang="x-default" href="${escape(canonicalUrl(pathname))}">`,
    `<meta property="og:type" content="${page.video ? 'video.other' : page.contentLanguage ? 'article' : 'website'}">`,
    `<meta property="og:site_name" content="Baitly">`,
    `<meta property="og:title" content="${escape(page.title)}">`,
    `<meta property="og:description" content="${escape(page.description)}">`,
    `<meta property="og:url" content="${escape(url)}">`,
    `<meta property="og:locale" content="${locale[contentLanguage]}">`,
    ...(page.availableLanguages ?? DISCOVERY_LANGUAGES)
      .filter((lang) => lang !== contentLanguage)
      .map(
        (lang) =>
          `<meta property="og:locale:alternate" content="${locale[lang]}">`,
      ),
    `<meta property="og:image" content="${escape(page.image ?? page.video?.poster ?? `${ORIGIN}/baitly-share.jpg`)}">`,
    ...(page.video
      ? [
          `<meta property="og:video" content="${escape(page.video.video)}">`,
          `<meta property="og:video:type" content="video/mp4">`,
          `<meta property="og:video:width" content="1920">`,
          `<meta property="og:video:height" content="1080">`,
          `<script type="application/ld+json" id="baitly-video-ld">${scriptSafeJson(page.video.jsonLd)}</script>`,
        ]
      : []),
    `<meta name="twitter:card" content="summary_large_image">`,
    ...(page.structuredData
      ? [
          `<script type="application/ld+json" id="baitly-editorial-ld">${scriptSafeJson(page.structuredData)}</script>`,
        ]
      : []),
  ].join('\n    ');
  return html
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(
      /<meta\b[^>]*(?:name="(?:description|robots|twitter:[^"]+)"|property="og:[^"]+")[^>]*>/gi,
      '',
    )
    .replace(/<link\b[^>]*rel="(?:canonical|alternate)"[^>]*>/gi, '')
    .replace(
      /<script type="application\/ld\+json" id="baitly-video-ld">[\s\S]*?<\/script>/gi,
      '',
    )
    .replace(
      /<script type="application\/ld\+json" id="baitly-editorial-ld">[\s\S]*?<\/script>/gi,
      '',
    )
    .replace(
      /<html\b[^>]*>/i,
      `<html lang="${language}" dir="${language === 'ar' ? 'rtl' : 'ltr'}" data-theme="light">`,
    )
    .replace('</head>', `    ${head}\n  </head>`)
    .replace(
      /<!--baitly-content:start-->[\s\S]*?<!--baitly-content:end-->/g,
      '',
    )
    .replace(
      /<div id="root"[^>]*><\/div>/,
      () =>
        `<div id="root"${publishedUrl ? ` data-baitly-url="${escape(publishedUrl)}"` : ''}><!--baitly-content:start-->${staticHtml}<!--baitly-content:end--></div>`,
    );
}

/** Small virtual data module for SPA navigation + prebuilt heads for non-JS crawlers. */
export function baitlySiteSeo(): Plugin {
  let catalog: MetadataCatalog;
  let devRenderer: SiteRenderer | undefined;
  let config: ResolvedConfig;
  const root = fileURLToPath(new URL('../', import.meta.url));
  const id = 'virtual:baitly-site-metadata';
  const loadCatalog = async () => {
    if (!catalog) {
      const discovery = discoveryCatalog(
        await readFile(`${root}/site/data/catalog.tsx`, 'utf8'),
      );
      catalog = metadataCatalog(discovery);
    }
    return catalog;
  };
  const renderPage = async (
    render: SiteRenderer,
    path: string,
    language: SiteLanguage,
  ) => (PRIVATE_SITE_PATHS.includes(path) ? undefined : render(path, language));
  return {
    name: 'baitly-site-seo',
    enforce: 'post',
    configResolved(resolved) {
      config = resolved;
    },
    async configureServer(devServer) {
      const { createDevSiteRenderer } = await import('./baitlySiteDevRendering');
      devRenderer = createDevSiteRenderer(devServer);
    },
    resolveId(source) {
      if (source === id) return '\0' + id;
    },
    async load(source) {
      // Éviter de dupliquer les transcriptions dans le catalogue de métadonnées du navigateur :
      // le lecteur les importe déjà pour leur consultation, et le HTML prégénéré les porte en JSON-LD.
      if (source === '\0' + id)
        return `export default ${JSON.stringify(await loadCatalog(), (key, value) => (key === 'transcript' ? undefined : value))}`;
    },
    transformIndexHtml: {
      order: 'post',
      async handler(html, context) {
        const url = new URL(context.originalUrl ?? '/', ORIGIN);
        const language =
          DISCOVERY_LANGUAGES.find(
            (lang) => lang === url.searchParams.get('lang'),
          ) ?? 'fr';
        const pages = (await loadCatalog())[language];
        const path = url.pathname.replace(/\/$/, '') || '/';
        const rendered = devRenderer
          ? await renderPage(devRenderer, path, language)
          : undefined;
        return metadataHtml(
          html,
          pages[path] ?? pages['/404'],
          pages[path] ? path : '/404',
          language,
          rendered?.html ?? '',
          rendered?.url,
        );
      },
    },
    async generateBundle(_, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset')
        throw new Error('Baitly SEO needs the built HTML entry');
      const source = String(index.source);
      const renderer = await buildSiteRenderer(config);
      try {
        for (const language of DISCOVERY_LANGUAGES) {
          for (const [path, page] of Object.entries(
            (await loadCatalog())[language],
          )) {
            const rendered = await renderPage(renderer.render, path, language);
            const html = metadataHtml(
              source,
              page,
              path,
              language,
              rendered?.html ?? '',
              rendered?.url,
            );
            if (path === '/' && language === 'fr') index.source = html;
            this.emitFile({
              type: 'asset',
              fileName: `_baitly-html/${language}${path === '/' ? '/index' : path}.html`,
              source: html,
            });
          }
        }
      } finally {
        await renderer.dispose();
      }
    },
  };
}

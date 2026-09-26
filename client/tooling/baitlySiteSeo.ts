import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { discoveryCatalog } from './baitlySiteDiscovery';
import {
  DISCOVERY_LANGUAGES,
  PRIVATE_SITE_PATHS,
  siteDocuments,
  type DiscoveryCatalog,
} from './baitlySiteContent';
import { BAITLY_CONTACT_MESSAGES } from '../site/lib/messages/baitlyContact';
import type { SiteLanguage } from '../site/lib/siteLanguage';

export type PageMetadata = {
  title: string;
  description: string;
  index: boolean;
};
export type MetadataCatalog = Record<
  SiteLanguage,
  Record<string, PageMetadata>
>;
const ORIGIN = 'https://baitly.fr';
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
        result[path] = {
          title: `${title.replace(/^Baitly · /, '')} | Baitly`,
          description: description.replace(/\s+/g, ' ').slice(0, 190),
          index: !path.startsWith('/legal/'),
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
): string {
  const canonicalPath =
    pathname === '/pre-lancement' ? '/bientot-disponible' : pathname;
  const url = `${ORIGIN}${canonicalPath}${language === 'fr' ? '' : `?lang=${language}`}`;
  const locale = { fr: 'fr_FR', en: 'en_US', ar: 'ar_SA' };
  const head = [
    `<title>${escape(page.title)}</title>`,
    `<meta name="description" content="${escape(page.description)}">`,
    `<meta name="robots" content="${page.index ? 'index, follow' : 'noindex, follow'}">`,
    `<link rel="canonical" href="${escape(url)}">`,
    ...DISCOVERY_LANGUAGES.map(
      (lang) =>
        `<link rel="alternate" hreflang="${lang}" href="${ORIGIN}${canonicalPath}${lang === 'fr' ? '' : `?lang=${lang}`}">`,
    ),
    `<link rel="alternate" hreflang="x-default" href="${ORIGIN}${canonicalPath}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Baitly">`,
    `<meta property="og:title" content="${escape(page.title)}">`,
    `<meta property="og:description" content="${escape(page.description)}">`,
    `<meta property="og:url" content="${escape(url)}">`,
    `<meta property="og:locale" content="${locale[language]}">`,
    ...DISCOVERY_LANGUAGES.filter((lang) => lang !== language).map(
      (lang) =>
        `<meta property="og:locale:alternate" content="${locale[lang]}">`,
    ),
    `<meta property="og:image" content="${ORIGIN}/baitly-share.jpg">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join('\n    ');
  return html
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(
      /<meta\b[^>]*(?:name="(?:description|robots|twitter:[^"]+)"|property="og:[^"]+")[^>]*>/gi,
      '',
    )
    .replace(/<link\b[^>]*rel="(?:canonical|alternate)"[^>]*>/gi, '')
    .replace(
      /<html\b[^>]*>/i,
      `<html lang="${language}" dir="${language === 'ar' ? 'rtl' : 'ltr'}" data-theme="light">`,
    )
    .replace('</head>', `    ${head}\n  </head>`);
}

/** Small virtual data module for SPA navigation + prebuilt heads for non-JS crawlers. */
export function baitlySiteSeo(): Plugin {
  let catalog: MetadataCatalog;
  const root = fileURLToPath(new URL('../', import.meta.url));
  const id = 'virtual:baitly-site-metadata';
  const loadCatalog = async () =>
    (catalog ??= metadataCatalog(
      discoveryCatalog(await readFile(`${root}/site/data/catalog.tsx`, 'utf8')),
    ));
  return {
    name: 'baitly-site-seo',
    enforce: 'post',
    resolveId(source) {
      if (source === id) return '\0' + id;
    },
    async load(source) {
      if (source === '\0' + id)
        return `export default ${JSON.stringify(await loadCatalog())}`;
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
        return metadataHtml(
          html,
          pages[path] ?? pages['/404'],
          pages[path] ? path : '/404',
          language,
        );
      },
    },
    async generateBundle(_, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset')
        throw new Error('Baitly SEO needs the built HTML entry');
      const source = String(index.source);
      for (const language of DISCOVERY_LANGUAGES) {
        for (const [path, page] of Object.entries(
          (await loadCatalog())[language],
        )) {
          this.emitFile({
            type: 'asset',
            fileName: `_baitly-html/${language}${path === '/' ? '/index' : path}.html`,
            source: metadataHtml(source, page, path, language),
          });
        }
      }
    },
  };
}

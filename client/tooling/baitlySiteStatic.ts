import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import type { SiteLanguage } from '../site/lib/siteLanguage';
import { LAYOUT_MESSAGES } from '../site/lib/messages/layout';
import { LEGAL_COUNTRIES, guidePath } from '../site/data/legal/countries';
import { canonicalUrl } from '../site/lib/siteSeo';
import { academyEpisode } from '../site/data/baitlyAcademyVideos';
import { academyVideoMetadata } from '../site/lib/academyStructuredData';
import { SITE_ORIGIN } from '../site/lib/siteSeo';

/** Public, visible HTML from the same editorial copy as the interactive site.
 * No user-agent detection, remote fetches, application data or hidden text.
 */
export function siteStaticHtml(
  markdown: string,
  path: string,
  language: SiteLanguage,
): string {
  const m = LAYOUT_MESSAGES[language];
  const episode = path.startsWith('/ressources/academie/')
    ? academyEpisode(path.split('/').pop())
    : undefined;
  const video = episode && academyVideoMetadata(episode, language, SITE_ORIGIN);
  const nav = [
    { label: 'Baitly', href: `/?lang=${language}` },
    { label: m.footer.columns.resources, href: `/ressources?lang=${language}` },
    {
      label: { fr: 'Le journal', en: 'Journal', ar: 'المجلة' }[language],
      href: `/ressources/blog?lang=${language}`,
    },
    ...LEGAL_COUNTRIES.map((country) => ({
      label: country.name[language],
      href: `${guidePath(country.code)}?lang=${language}`,
    })),
  ];
  return renderToStaticMarkup(
    createElement(
      'div',
      { className: 'baitly-marketing baitly-static-page' },
      createElement(
        'header',
        { className: 'site-shell baitly-static-header' },
        createElement(
          'nav',
          { 'aria-label': m.nav.aria },
          ...nav.map(({ label, href }) =>
            createElement('a', { href, key: href }, label),
          ),
        ),
        createElement(
          'nav',
          {
            'aria-label': { fr: 'Langue', en: 'Language', ar: 'اللغة' }[
              language
            ],
          },
          ...(['fr', 'en', 'ar'] as const).map((lang) =>
            createElement(
              'a',
              {
                href: canonicalUrl(path, lang),
                hrefLang: lang,
                lang,
                'aria-current': language === lang ? 'page' : undefined,
                key: lang,
              },
              { fr: 'Français', en: 'English', ar: 'العربية' }[lang],
            ),
          ),
        ),
      ),
      createElement(
        'main',
        { id: 'site-content', className: 'site-shell baitly-static-reading' },
        createElement(Markdown, {
          children: markdown,
          skipHtml: true,
          components: video
            ? {
                // The watch page is playable and its media URL discoverable before JavaScript runs.
                h1: ({ children }) =>
                  createElement(
                    Fragment,
                    null,
                    createElement('h1', null, children),
                    createElement('video', {
                      controls: true,
                      playsInline: true,
                      preload: 'none',
                      src: video.video,
                      poster: video.poster,
                      'aria-label': String(video.jsonLd.name),
                      className: 'baitly-static-video',
                    }),
                  ),
              }
            : undefined,
        }),
      ),
      createElement(
        'footer',
        { className: 'site-shell baitly-static-footer' },
        createElement(
          'a',
          { href: `/contact?lang=${language}` },
          { fr: 'Contact', en: 'Contact', ar: 'تواصل معنا' }[language],
        ),
        createElement('p', null, m.footer.rights),
      ),
    ),
  );
}

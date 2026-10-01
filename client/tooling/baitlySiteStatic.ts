import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import type { SiteLanguage } from '../site/lib/siteLanguage';
import { LAYOUT_MESSAGES } from '../site/lib/messages/layout';
import { LEGAL_COUNTRIES, guidePath } from '../site/data/legal';
import { canonicalUrl } from '../site/lib/siteSeo';

/** Public, visible HTML from the same editorial copy as the interactive site.
 * No user-agent detection, remote fetches, application data or hidden text.
 */
export function siteStaticHtml(
  markdown: string,
  path: string,
  language: SiteLanguage,
): string {
  const m = LAYOUT_MESSAGES[language];
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
        createElement(Markdown, { children: markdown, skipHtml: true }),
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

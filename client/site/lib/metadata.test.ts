import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  discoveryCatalog,
  discoveryArtifacts,
} from '../../tooling/baitlySiteDiscovery';
import { metadataCatalog, metadataHtml } from '../../tooling/baitlySiteSeo';
import { BAITLY_JOURNEY_MESSAGES } from './messages/baitlyJourneys';

const catalogSource = readFileSync('site/data/catalog.tsx', 'utf8');
const pages = metadataCatalog(discoveryCatalog(catalogSource));
const template = readFileSync('site/index.html', 'utf8');
describe('Public metadata', () => {
  it.each(['fr', 'en', 'ar'] as const)(
    'builds one translated head and canonical URL per page in %s',
    (language) => {
      const page = pages[language]['/solutions'];
      expect(page.title).toContain(
        BAITLY_JOURNEY_MESSAGES[language].solutions.title.replace(/\s+/g, ' '),
      );
      const rendered = metadataHtml(
        metadataHtml(template, pages.fr['/'], '/', 'fr'),
        page,
        '/solutions',
        language,
      );
      const doc = new DOMParser().parseFromString(rendered, 'text/html');
      expect(doc.querySelectorAll('title')).toHaveLength(1);
      expect(doc.title).toBe(page.title);
      expect(doc.querySelectorAll('meta[name="description"]')).toHaveLength(1);
      expect(
        doc.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      ).toBe(
        `https://baitly.fr/solutions${language === 'fr' ? '' : `?lang=${language}`}`,
      );
      expect(doc.querySelectorAll('link[hreflang]')).toHaveLength(4);
      expect(doc.documentElement.dir).toBe(language === 'ar' ? 'rtl' : 'ltr');
      expect(
        doc.querySelector('meta[property="og:image"]')?.getAttribute('content'),
      ).toContain('/baitly-share.jpg');
      expect(
        doc.querySelector('script[src="/baitly-config.js"]'),
      ).not.toBeNull();
    },
  );
  it('keeps private workflows and provisional legal copy out of indexing', () => {
    for (const path of [
      '/404',
      '/prestataires/activation',
      '/register',
      '/legal/cgv',
    ])
      expect(pages.fr[path].index).toBe(false);
    expect(pages.fr['/produit/livret-accueil'].index).toBe(true);
    expect(pages.fr['/produit/inconnu']).toBeUndefined();
  });
  it('escapes head content and excludes private URL parameters', () => {
    const html = metadataHtml(
      template,
      {
        title: '<script>bad</script>',
        description: '" ><script>bad</script>',
        index: true,
      },
      '/contact',
      'fr',
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.title).toBe('<script>bad</script>');
    expect(doc.querySelectorAll('script')).toHaveLength(2);
  });
  it('serves per-route HTML and a genuine 404 without changing the PMS fallback', () => {
    const artifacts = discoveryArtifacts(
      readFileSync('site/main.tsx', 'utf8'),
      readFileSync('site/public/robots.txt', 'utf8'),
      catalogSource,
    );
    expect(artifacts.configs.get('discovery-server.conf')).toContain(
      'try_files /_baitly-html/$baitly_markdown_language/contact.html =404;',
    );
    expect(artifacts.configs.get('discovery-server.conf')).toContain(
      'error_page 404 /_baitly-html/$baitly_markdown_language/404.html;',
    );
    expect(artifacts.configs.get('discovery-fallback.conf')).toBe(
      'return 404;\n',
    );
    const nginx = readFileSync('nginx.conf', 'utf8');
    expect(nginx).toContain('location @site_fallback');
    expect(nginx).toContain('try_files /index.html =404;');
  });
});

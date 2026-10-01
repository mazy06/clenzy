import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  discoveryCatalog,
  discoveryArtifacts,
} from '../../tooling/baitlySiteDiscovery';
import { metadataCatalog, metadataHtml } from '../../tooling/baitlySiteSeo';
import { BAITLY_JOURNEY_MESSAGES } from './messages/baitlyJourneys';
import { ACADEMY_EPISODES } from '../data/baitlyAcademyVideos';
import { ACADEMY_TRANSCRIPTS } from '../data/baitlyAcademyTranscripts';
import { scriptSafeJson } from './academyStructuredData';
import { siteStaticHtml } from '../../tooling/baitlySiteStatic';
import { siteDocuments } from '../../tooling/baitlySiteContent';
import { HOME_MESSAGES } from './messages/home';

const catalogSource = readFileSync('site/data/catalog.tsx', 'utf8');
const pages = metadataCatalog(discoveryCatalog(catalogSource));
const template = readFileSync('site/index.html', 'utf8');
describe('Public metadata', () => {
  it.each(['fr', 'en', 'ar'] as const)(
    'serves the styled journal layout before JavaScript in %s',
    (language) => {
      const path = '/ressources/blog';
      const html = metadataHtml(
        template,
        pages[language][path],
        path,
        language,
      );
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const stylesheet = doc.querySelector(
        'head link[href="/initial.css"]',
      );
      expect(stylesheet?.getAttribute('rel')).toBe('stylesheet');
      expect(stylesheet?.hasAttribute('disabled')).toBe(false);
      expect(stylesheet?.getAttribute('media')).toBeNull();
      // A readable page, not an unstyled SEO list or a loading placeholder.
      expect(
        doc.querySelector('.baitly-marketing .site-header'),
      ).not.toBeNull();
      expect(doc.querySelectorAll('#site-content h1')).toHaveLength(1);
      expect(
        doc.querySelector('.blg-journal .blg-hero-lead'),
      ).not.toBeNull();
      expect(
        doc.querySelector('.blg-featured img')?.getAttribute('src'),
      ).toMatch(/\.webp$/);
      expect(
        doc.querySelectorAll('.blg-article-list > article'),
      ).toHaveLength(27);
      expect(doc.querySelector('.site-route-loading')).toBeNull();
      expect(
        doc.querySelector('meta[name="robots"]')?.getAttribute('content'),
      ).toMatch(/index,\s*follow/);
    },
  );

  it.each(['fr', 'en', 'ar'] as const)(
    'publishes readable, linked HTML without JavaScript in %s and replaces the initial route body',
    (language) => {
      const docs = siteDocuments(language, discoveryCatalog(catalogSource));
      const home = metadataHtml(
        template,
        pages[language]['/'],
        '/',
        language,
        siteStaticHtml(docs.get('/')!, '/', language),
      );
      const homeDoc = new DOMParser().parseFromString(home, 'text/html');
      expect(homeDoc.querySelector('main')?.textContent).toContain(
        HOME_MESSAGES[language].hero.description,
      );
      for (const country of ['maroc', 'france', 'arabie-saoudite']) {
        expect(
          homeDoc.querySelector(
            `a[href="/ressources/obligations/${country}?lang=${language}"]`,
          ),
        ).not.toBeNull();
      }
      const path = '/solutions';
      const next = metadataHtml(
        home,
        pages[language][path],
        path,
        language,
        siteStaticHtml(docs.get(path)!, path, language),
      );
      const nextDoc = new DOMParser().parseFromString(next, 'text/html');
      expect(nextDoc.querySelectorAll('h1')).toHaveLength(1);
      expect(nextDoc.querySelector('h1')?.textContent).toBe(
        BAITLY_JOURNEY_MESSAGES[language].solutions.title.replace(
          /\s+/g,
          ' ',
        ),
      );
      expect(nextDoc.querySelector('main')?.textContent).not.toContain(
        HOME_MESSAGES[language].hero.description,
      );
      expect(
        nextDoc
          .querySelector('meta[name="robots"]')
          ?.getAttribute('content'),
      ).toContain('max-image-preview:large');
    },
  );

  it('escapes Markdown HTML and unsafe URLs in the public fallback', () => {
    const html = siteStaticHtml(
      '# Baitly\n\n<script>bad()</script>\n\n[Bad](javascript:alert%281%29)\n\nVisible & useful',
      '/',
      'fr',
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('script')).toBeNull();
    expect(doc.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(doc.querySelector('main')?.textContent).toContain(
      'Visible & useful',
    );
  });

  it('identifies Baitly and its website without invented ratings or endorsements', () => {
    expect(pages.fr['/'].title).toContain(
      'Logiciel de location saisonnière',
    );
    for (const country of ['Maroc', 'France', 'Arabie saoudite'])
      expect(pages.fr['/'].description).toContain(country);
    expect(
      pages.fr['/'].structuredData?.map((data) => data['@type']),
    ).toEqual(['Organization', 'WebSite', 'SoftwareApplication']);
    expect(JSON.stringify(pages.fr['/'].structuredData)).not.toMatch(
      /aggregateRating|reviewCount|sameAs/,
    );
  });
  it.each(['fr', 'en', 'ar'] as const)(
    'builds one translated head and canonical URL per page in %s',
    (language) => {
      const page = pages[language]['/solutions'];
      expect(page.title).toContain(
        BAITLY_JOURNEY_MESSAGES[language].solutions.title.replace(
          /\s+/g,
          ' ',
        ),
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
      expect(doc.querySelectorAll('meta[name="description"]')).toHaveLength(
        1,
      );
      expect(
        doc.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      ).toBe(
        `https://baitly.fr/solutions${language === 'fr' ? '' : `?lang=${language}`}`,
      );
      expect(doc.querySelectorAll('link[hreflang]')).toHaveLength(4);
      expect(doc.documentElement.dir).toBe(
        language === 'ar' ? 'rtl' : 'ltr',
      );
      expect(
        doc
          .querySelector('meta[property="og:image"]')
          ?.getAttribute('content'),
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
  it('décrit chaque épisode de l’Académie comme une vidéo, sans doublon au second passage', () => {
    const episode = ACADEMY_EPISODES[0];
    const path = `/ressources/academie/${episode.slug}`;
    const page = pages.fr[path];
    expect(page.video).toBeDefined();
    const html = metadataHtml(
      metadataHtml(template, page, path, 'fr'),
      page,
      path,
      'fr',
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const scripts = doc.querySelectorAll(
      'script[type="application/ld+json"]',
    );
    expect(scripts).toHaveLength(1);
    const data = JSON.parse(scripts[0].textContent!);
    expect(data['@type']).toBe('VideoObject');
    expect(data.duration).toMatch(/^PT\d+M\d+S$/);
    expect(data.uploadDate).toBe(episode.uploadDate);
    // The structured transcript matches the copy available to readers.
    expect(data.transcript).toBe(ACADEMY_TRANSCRIPTS[episode.slug].fr);
    expect(data.mainEntityOfPage).toBe(`https://baitly.fr${path}`);
    expect(data.hasPart).toHaveLength(episode.chapters.length);
    expect(data.hasPart[1].url).toBe(
      `https://baitly.fr${path}?t=${Math.round(episode.chapters[1])}`,
    );
    expect(
      doc
        .querySelector('meta[property="og:type"]')
        ?.getAttribute('content'),
    ).toBe('video.other');
    expect(
      doc
        .querySelector('meta[property="og:image"]')
        ?.getAttribute('content'),
    ).toBe(`https://baitly.fr/academie/posters/${episode.slug}-16x9.jpg`);
    expect(pages.en[path].video?.jsonLd.hasPart).toHaveLength(
      episode.chapters.length,
    );
  });
  it.each(['fr', 'en', 'ar'] as const)(
    'makes every published watch page playable without JavaScript in %s',
    (language) => {
      const docs = siteDocuments(language, discoveryCatalog(catalogSource));
      for (const episode of ACADEMY_EPISODES) {
        const path = `/ressources/academie/${episode.slug}`;
        const page = pages[language][path];
        const html = metadataHtml(
          template,
          page,
          path,
          language,
          siteStaticHtml(docs.get(path)!, path, language),
        );
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const video = doc.querySelector('main video');
        expect(doc.querySelectorAll('h1')).toHaveLength(1);
        expect(video?.previousElementSibling?.tagName).toBe('H1');
        expect(video?.getAttribute('src')).toBe(
          page.video?.jsonLd.contentUrl,
        );
        expect(video?.getAttribute('poster')).toBe(page.video?.poster);
        expect(video?.hasAttribute('controls')).toBe(true);
        expect(video?.getAttribute('preload')).toBe('none');
        expect(doc.querySelector('main')?.textContent).toContain(
          ACADEMY_TRANSCRIPTS[episode.slug].fr,
        );
        expect(
          doc.querySelector('meta[name="robots"]')?.getAttribute('content'),
        ).toContain('max-video-preview:-1');
        expect(page.video?.jsonLd.url).toBe(
          doc.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        );
      }
    },
  );
  it('ne peut pas fermer la balise script depuis un texte d’épisode', () => {
    const json = scriptSafeJson({
      name: '</script><script>alert(1)</script>',
    });
    expect(json).not.toMatch(/[<>&]/);
    expect(JSON.parse(json).name).toBe(
      '</script><script>alert(1)</script>',
    );
  });
});

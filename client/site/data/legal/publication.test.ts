import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  discoveryArtifacts,
  discoveryCatalog,
} from '../../../tooling/baitlySiteDiscovery';
import { metadataCatalog, metadataHtml } from '../../../tooling/baitlySiteSeo';
import { legalArticleImage } from './articleImages';
import { journalArticles, JOURNAL_ARTICLE_COUNT } from '../baitlyJournal';
import {
  LEGAL_ARTICLES,
  LEGAL_COUNTRIES,
  LEGAL_SOURCES,
  articlePath,
  articleSources,
  articlesForCountry,
  guidePath,
  localizeArticle,
  articleLanguage,
} from './index';
import { ARABIC_ARTICLES, ARABIC_SOURCE_LABELS } from './localization';
import {
  legalDocuments,
  legalStaticHtml,
  legalStructuredData,
} from './publication';

const routes = readFileSync('site/main.tsx', 'utf8');
const catalog = readFileSync('site/data/catalog.tsx', 'utf8');
const template = readFileSync('site/index.html', 'utf8');

describe('Publication réglementaire accessible aux lecteurs et aux moteurs', () => {
  it('publie les 27 articles dans une seule liste et conserve les lectures pratiques', () => {
    for (const language of ['fr', 'en', 'ar'] as const) {
      const html = new DOMParser().parseFromString(
        legalStaticHtml('/ressources/blog', language)!,
        'text/html',
      );
      const markdown = legalDocuments(language).get('/ressources/blog')!;
      expect(html.querySelectorAll('.blg-article-list')).toHaveLength(1);
      expect(html.querySelectorAll('.blg-article-list > article')).toHaveLength(
        JOURNAL_ARTICLE_COUNT,
      );
      const data = legalStructuredData('/ressources/blog', language)![0] as {
        mainEntity: { itemListElement: unknown[] };
      };
      expect(data.mainEntity.itemListElement).toHaveLength(
        JOURNAL_ARTICLE_COUNT,
      );
      for (const entry of journalArticles(language)) {
        expect(html.body.textContent).toContain(entry.title);
        expect(markdown).toContain(entry.title);
        if (entry.reading) {
          expect(html.querySelector(`#${entry.id}`)).not.toBeNull();
          expect(html.body.textContent).toContain(entry.reading.takeaway);
          for (const section of entry.reading.sections)
            expect(markdown).toContain(section.copy);
        }
      }
    }
  });
  it('publie chaque dossier complet en HTML visible et en Markdown, avec toutes les citations', () => {
    expect(new Set(LEGAL_ARTICLES.map((a) => a.slug)).size).toBe(24);
    for (const article of LEGAL_ARTICLES) {
      const path = articlePath(article);
      const markdown = legalDocuments('fr').get(path)!;
      const html = new DOMParser().parseFromString(
        legalStaticHtml(path, 'fr')!,
        'text/html',
      );
      expect(html.querySelectorAll('h1')).toHaveLength(1);
      expect(html.querySelector('main article[lang="fr"]')).not.toBeNull();
      expect(markdown).toContain(article.scope);
      for (const section of article.sections) {
        expect(section.sources.length).toBeGreaterThan(0);
        for (const paragraph of section.paragraphs) {
          expect(markdown).toContain(paragraph);
          expect(html.body.textContent).toContain(paragraph);
        }
      }
      for (const id of articleSources(article)) {
        expect(LEGAL_SOURCES[id], `${article.slug}: ${id}`).toBeDefined();
        expect(markdown).toContain(LEGAL_SOURCES[id].url);
        expect([...html.querySelectorAll('a')].map((a) => a.href)).toContain(
          LEGAL_SOURCES[id].url,
        );
      }
    }
  });

  it('publie des versions française et arabe réciproques sans inventer de traduction anglaise', () => {
    const pages = metadataCatalog(discoveryCatalog(catalog));
    for (const language of ['fr', 'en', 'ar'] as const) {
      for (const article of LEGAL_ARTICLES) {
        const contentLanguage = articleLanguage(language);
        const localized = localizeArticle(article, language);
        const path = articlePath(article);
        const page = pages[language][path];
        const html = metadataHtml(template, page, path, language);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        expect(
          doc.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        ).toBe(
          `https://baitly.fr${path}${contentLanguage === 'ar' ? '?lang=ar' : ''}`,
        );
        expect(doc.querySelector('link[hreflang="en"]')).toBeNull();
        expect(doc.querySelector('link[hreflang="fr"]')?.getAttribute('href')).toBe(
          `https://baitly.fr${path}`,
        );
        expect(doc.querySelector('link[hreflang="ar"]')?.getAttribute('href')).toBe(
          `https://baitly.fr${path}?lang=ar`,
        );
        expect(
          doc
            .querySelector('meta[property="og:type"]')
            ?.getAttribute('content'),
        ).toBe('article');
        const structured = JSON.parse(
          doc.querySelector('#baitly-editorial-ld')!.textContent!,
        )[0];
        expect(structured.inLanguage).toBe(contentLanguage);
        expect(structured.headline).toBe(localized.title);
        expect(
          doc
            .querySelector('meta[property="og:image"]')
            ?.getAttribute('content'),
        ).toBe(`https://baitly.fr${legalArticleImage(article.slug).src}`);
        expect(structured.citation).toEqual(
          articleSources(article).map((id) => LEGAL_SOURCES[id].url),
        );
        expect(structured.datePublished).toBeUndefined();
        expect(doc.querySelector('#root h1')?.textContent).toBe(
          localized.title,
        );
      }
    }
  });

  it('traduit les 24 dossiers intégralement en conservant les sources et la structure vérifiées', () => {
    expect(Object.keys(ARABIC_ARTICLES).sort()).toEqual(
      LEGAL_ARTICLES.map((a) => a.slug).sort(),
    );
    for (const id of Object.keys(LEGAL_SOURCES))
      expect(ARABIC_SOURCE_LABELS[id]).toMatch(/[\u0600-\u06ff]/);
    for (const original of LEGAL_ARTICLES) {
      const article = localizeArticle(original, 'ar');
      expect(article.sections).toHaveLength(original.sections.length);
      expect(article.facts).toHaveLength(original.facts.length);
      expect(article.checklist).toHaveLength(original.checklist.length);
      expect(article.faq).toHaveLength(original.faq.length);
      const path = articlePath(article);
      const markdown = legalDocuments('ar').get(path)!;
      const html = new DOMParser().parseFromString(
        legalStaticHtml(path, 'ar')!,
        'text/html',
      );
      expect(html.querySelector('article[lang="ar"]')?.getAttribute('dir')).toBe('rtl');
      for (const [index, section] of article.sections.entries()) {
        expect(section.sources).toEqual(original.sections[index].sources);
        expect(section.paragraphs).toHaveLength(
          original.sections[index].paragraphs.length,
        );
        for (const paragraph of section.paragraphs) {
          expect(paragraph).toMatch(/[\u0600-\u06ff]/);
          expect(markdown).toContain(paragraph);
          expect(html.body.textContent).toContain(paragraph);
        }
      }
      expect(html.body.textContent).not.toContain(original.title);
      expect(html.querySelector('a[href$="?lang=ar"]')).not.toBeNull();
      for (const id of articleSources(article)) {
        expect(markdown).toContain(LEGAL_SOURCES[id].url);
        expect(html.body.textContent).toContain(ARABIC_SOURCE_LABELS[id]);
      }
    }
  });

  it('relie les 24 articles et les trois guides dans les fichiers de découverte', () => {
    const { assets, paths, configs } = discoveryArtifacts(
      routes,
      readFileSync('site/public/robots.txt', 'utf8'),
      catalog,
    );
    for (const path of [
      ...LEGAL_ARTICLES.map(articlePath),
      ...LEGAL_COUNTRIES.map((c) => guidePath(c.code)),
    ]) {
      expect(paths).toContain(path);
      expect(assets.get('sitemap.xml')).toContain(
        `https://baitly.fr${path}</loc>`,
      );
      expect(assets.get('llms.txt')).toContain(`](https://baitly.fr${path})`);
      expect(configs.get('discovery-server.conf')).toContain(
        `location = ${path}`,
      );
    }
    for (const c of LEGAL_COUNTRIES) {
      const data = legalStructuredData(guidePath(c.code), 'fr')![0] as {
        mainEntity: { itemListElement: unknown[] };
      };
      expect(data.mainEntity.itemListElement).toHaveLength(
        articlesForCountry(c.code).length,
      );
      for (const language of ['en', 'ar'] as const)
        expect(legalDocuments(language).get(guidePath(c.code))).toContain(
          articlesForCountry(c.code)[0].guide[language].title,
        );
    }
    const rootGuide = legalStructuredData(
      '/ressources/obligations',
      'fr',
    )![0] as { mainEntity: { itemListElement: unknown[] } };
    expect(rootGuide.mainEntity.itemListElement).toHaveLength(7);
  });
});

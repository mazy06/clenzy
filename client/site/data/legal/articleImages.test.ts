import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEGAL_ARTICLES, articlePath } from './index';
import { LEGAL_ARTICLE_IMAGES, legalArticleImage } from './articleImages';
import { legalStaticHtml, legalStructuredData } from './publication';

describe('Photographies des dossiers Baitly', () => {
  it('fournit une vraie photographie et une vignette distinctes pour chaque dossier', () => {
    expect(Object.keys(LEGAL_ARTICLE_IMAGES).sort()).toEqual(
      LEGAL_ARTICLES.map((a) => a.slug).sort(),
    );
    const originals = new Set<string>();
    const thumbnails = new Set<string>();
    for (const article of LEGAL_ARTICLES) {
      const photo = legalArticleImage(article.slug);
      expect(photo.alt.length).toBeGreaterThan(30);
      for (const [src, hashes, maxBytes] of [
        [photo.src, originals, 350_000],
        [photo.thumbnail, thumbnails, 80_000],
      ] as const) {
        const bytes = readFileSync(`site/public${src}`);
        expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
        expect(bytes.length).toBeLessThan(maxBytes);
        hashes.add(createHash('sha256').update(bytes).digest('hex'));
      }
    }
    expect(originals.size).toBe(LEGAL_ARTICLES.length);
    expect(thumbnails.size).toBe(LEGAL_ARTICLES.length);
  });

  it('utilise la même photo dans le HTML public et les données structurées', () => {
    for (const article of LEGAL_ARTICLES) {
      const photo = legalArticleImage(article.slug);
      const html = new DOMParser().parseFromString(
        legalStaticHtml(articlePath(article), 'fr')!,
        'text/html',
      );
      const cover = html.querySelector('img.blg-article-cover');
      expect(cover?.getAttribute('src')).toBe(photo.src);
      expect(cover?.getAttribute('alt')).toBe(photo.alt);
      expect(legalStructuredData(articlePath(article), 'fr')![0].image).toBe(
        `https://baitly.fr${photo.src}`,
      );
    }
  });
});

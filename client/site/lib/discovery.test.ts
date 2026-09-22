import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { discoveryArtifacts } from '../../tooling/baitlySiteDiscovery';
import { PRICING_MESSAGES } from './messages/pricing';
import { PRELAUNCH_MESSAGES } from './messages/prelaunch';

const routes = readFileSync('site/main.tsx', 'utf8');
const robots = readFileSync('site/public/robots.txt', 'utf8');
const catalog = readFileSync('site/data/catalog.tsx', 'utf8');

describe('Baitly public discovery build', () => {
  it('covers real routes while excluding private workflows, fragments and tokens', () => {
    const { assets, paths } = discoveryArtifacts(routes, robots, catalog);
    const xml = new DOMParser().parseFromString(assets.get('sitemap.xml')!, 'application/xml');
    expect(xml.querySelector('parsererror')).toBeNull();
    const urls = [...xml.querySelectorAll('loc')].map((element) => element.textContent);
    expect(urls).toEqual(paths.map((path) => `https://baitly.fr${path}`));
    expect(paths).toContain('/produit/agents-ia');
    expect(paths).toContain('/legal/confidentialite');
    expect(paths).not.toContain('/prestataires/inscription');
    expect(paths).not.toContain('/prestataires/activation');
    expect(paths).not.toContain('/inscription');
    expect(paths).not.toContain('/register');
    expect(paths).toContain('/bientot-disponible');
    expect(paths).toContain('/pre-lancement');
    expect(urls.every((url) => !/[#?:*]/.test(url!.slice('https://'.length)))).toBe(true);
    expect(assets.get('robots.txt')).toContain('Sitemap: https://baitly.fr/sitemap.xml');
  });

  it('uses current public copy in each language and leaves legal copy in its actual language', () => {
    const { assets, paths } = discoveryArtifacts(routes, robots, catalog);
    for (const language of ['fr', 'en', 'ar'] as const) {
      expect(assets.get(`_baitly-markdown/${language}/tarifs.md`)).toContain(PRICING_MESSAGES[language].plans[0].price);
      for (const path of ['/bientot-disponible', '/pre-lancement']) {
        const markdown = assets.get(`_baitly-markdown/${language}${path}.md`);
        expect(markdown).toContain(PRELAUNCH_MESSAGES[language].intro);
        expect(markdown).not.toContain(PRELAUNCH_MESSAGES[language].paused);
        expect(markdown).not.toContain(PRELAUNCH_MESSAGES[language].openTitle);
      }
      for (const path of paths) {
        expect(assets.get(`_baitly-markdown/${language}${path === '/' ? '/index' : path}.md`)).toMatch(/^# .+/);
      }
    }
    expect(assets.get('_baitly-markdown/ar/legal/cgv.md')).toEqual(assets.get('_baitly-markdown/fr/legal/cgv.md'));
    expect([...assets.keys()].some((path) => /inscription|activation|register/.test(path))).toBe(false);
  });

  it('updates the sitemap when a page is removed', () => {
    const result = discoveryArtifacts(routes.replace('<Route path="/demo" element={<DemoRoute />} />', ''), robots, catalog);
    expect(result.paths).not.toContain('/demo');
    expect(result.assets.has('_baitly-markdown/fr/demo.md')).toBe(false);
  });

  it('fails publication for new routes without a Markdown representation or dynamic-route policy', () => {
    const addRoute = (path: string) => routes.replace('<Routes>', `<Routes><Route path="${path}" element={<NewPage />} />`);
    expect(() => discoveryArtifacts(addRoute('/nouveau'), robots, catalog)).toThrow('Missing Markdown representation');
    expect(() => discoveryArtifacts(addRoute('/secret/:token'), robots, catalog)).toThrow('Classify public route');
  });
});

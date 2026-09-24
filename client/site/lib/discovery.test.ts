import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { discoveryArtifacts } from '../../tooling/baitlySiteDiscovery';
import { PRICING_MESSAGES } from './messages/pricing';
import { BAITLY_LOYALTY_MESSAGES } from './messages/baitlyLoyalty';
import { PRELAUNCH_MESSAGES } from './messages/prelaunch';
import { BAITLY_PRODUCT_MESSAGES } from './messages/baitlyProducts';
import { PRODUCT_STORY_SLUGS, type ProductStoryKind } from '../data/baitlyProductStories';
import { BAITLY_RESOURCE_MESSAGES } from './messages/baitlyResources';
import { MARKET_SOURCE, type ResourceKind } from '../data/baitlyResources';

const routes = readFileSync('site/main.tsx', 'utf8');
const robots = readFileSync('site/public/robots.txt', 'utf8');
const catalog = readFileSync('site/data/catalog.tsx', 'utf8');

describe('Baitly public discovery build', () => {
  it('publie les six ressources avec leur contenu et leurs sources dans les trois langues', () => {
    const { assets, paths } = discoveryArtifacts(routes, robots, catalog);
    for (const language of ['fr', 'en', 'ar'] as const) {
      const m = BAITLY_RESOURCE_MESSAGES[language];
      for (const id of Object.keys(m.modules) as ResourceKind[]) {
        expect(paths).toContain(`/ressources/${id}`);
        expect(assets.get(`_baitly-markdown/${language}/ressources/${id}.md`)).toContain(m.modules[id].title);
      }
      expect(assets.get(`_baitly-markdown/${language}/ressources/calculateur.md`)).toContain(m.calc.formulas[2]);
      expect(assets.get(`_baitly-markdown/${language}/ressources/barometre.md`)).toContain(MARKET_SOURCE);
      expect(assets.get(`_baitly-markdown/${language}/ressources/academie.md`)).toContain(m.academy.lessons[2].takeaway);
    }
  });
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
      for (const [kind, slug] of Object.entries(PRODUCT_STORY_SLUGS)) {
        const story = BAITLY_PRODUCT_MESSAGES[language].pages[kind as ProductStoryKind];
        const markdown = assets.get(`_baitly-markdown/${language}/produit/${slug}.md`);
        expect(markdown).toContain(story.title.join(' '));
        expect(markdown).toContain(story.workflowTitle);
        expect(markdown).not.toContain('Riad Azur');
      }
      expect(assets.get(`_baitly-markdown/${language}/tarifs.md`)).toContain(PRICING_MESSAGES[language].plans[0].price);
      expect(assets.get(`_baitly-markdown/${language}/tarifs.md`)).toContain(BAITLY_LOYALTY_MESSAGES[language].volumeHint);
      expect(assets.get(`_baitly-markdown/${language}/tarifs.md`)).toContain(`20–49 ${BAITLY_LOYALTY_MESSAGES[language].propertyWords[1]} : −20 %`);
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

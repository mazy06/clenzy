import { StrictMode } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { act, fireEvent, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SiteApp, { prepareSitePage } from './SiteApp';
import { renderSite } from './entry-server';
import type { SiteLanguage } from './lib/siteLanguage';
import { ACADEMY_EPISODES } from './data/baitlyAcademyVideos';

vi.mock('./components/SiteMetadata', () => ({ default: () => null }));
const launchState = vi.hoisted(() => ({
  paused: true,
  loading: false,
  status: null,
}));
vi.mock('../src/hooks/usePublicLaunchStatus', () => ({
  usePublicLaunchStatus: () => launchState,
}));

let root: Root | undefined;
let container: HTMLDivElement;
beforeEach(() => {
  launchState.loading = false;
  container = document.createElement('div');
  document.body.append(container);
  sessionStorage.clear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(
    () => undefined,
  );
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

async function mountPublished(
  path: string,
  language: SiteLanguage,
  search = '',
) {
  const rendered = await renderSite(path, language);
  container.innerHTML = rendered.html;
  const heading = container.querySelector('h1');
  const main = container.querySelector('main');
  const header = container.querySelector('header');
  expect(heading).not.toBeNull();
  expect(container.querySelector('.site-route-loading')).toBeNull();
  window.history.replaceState({}, '', `${rendered.url}${search}`);
  const prepared = await prepareSitePage(path);
  const onRecoverableError = vi.fn();
  await act(async () => {
    root = hydrateRoot(
      container,
      <StrictMode>
        <BrowserRouter>
          <SiteApp
            prepared={prepared}
            initialLanguage={language}
            initialUrl={rendered.url}
          />
        </BrowserRouter>
      </StrictMode>,
      { onRecoverableError },
    );
  });
  expect(onRecoverableError).not.toHaveBeenCalled();
  expect(container.querySelector('main')).toBe(main);
  expect(container.querySelector('header')).toBe(header);
  expect(container.querySelector('h1')).toBe(heading);
  expect(window.scrollTo).not.toHaveBeenCalled();
  const mismatches = vi
    .mocked(console.error)
    .mock.calls.filter((args) =>
      /did not match|hydration|server HTML|validateDOMNesting/i.test(
        String(args[0]),
      ),
    );
  expect(mismatches).toEqual([]);
  return within(container);
}

describe('Published site hydration', () => {
  it.each([
    ['/ressources/obligations/maroc', 'fr'],
    ['/ressources/obligations/arabie-saoudite', 'ar'],
    ['/ressources/blog', 'en'],
    ['/ressources/blog/maroc-autorisation-hebergement-chez-habitant', 'fr'],
    ['/', 'fr'],
    ['/tarifs', 'ar'],
    ['/produit/booking-engine', 'fr'],
    ['/produit/agents-ia', 'fr'],
    ['/produit/agents-ia', 'en'],
    ['/produit/agents-ia', 'ar'],
    ['/produit/operations-menage', 'ar'],
    ['/produit/portail-proprietaire', 'ar'],
    ['/produit/objets-connectes', 'ar'],
    ['/produit/pms-channel-manager', 'ar'],
    ['/produit/livret-accueil', 'en'],
    ['/solutions', 'en'],
    ['/prestataires', 'ar'],
    ['/migration', 'fr'],
    ['/comparer', 'en'],
    ['/contact', 'ar'],
    ['/bientot-disponible', 'fr'],
    [`/ressources/academie/${ACADEMY_EPISODES[0].slug}`, 'fr'],
  ] as const)('keeps the published DOM on %s (%s)', async (path, language) => {
    // A previous session language must not replace the published document.
    sessionStorage.setItem('clenzy_site_lang', language === 'ar' ? 'fr' : 'ar');
    await mountPublished(path, language);
    expect(document.documentElement.lang).toBe(language);
    expect(document.documentElement.dir).toBe(
      language === 'ar' ? 'rtl' : 'ltr',
    );
  });

  it('activates the existing guide checklist without replacing the page', async () => {
    const view = await mountPublished('/ressources/obligations/maroc', 'fr');
    fireEvent.click(
      view.getByRole('checkbox', {
        name: /points préparés.*obtenir son autorisation/,
      }),
    );
    expect(view.getByRole('progressbar')).toHaveAttribute('value', '1');
  });

  it('publishes the demo form while safely waiting for launch availability', async () => {
    launchState.loading = true;
    await mountPublished('/demo', 'fr');
    expect(container.querySelector('fieldset')).toBeDisabled();
  });

  it('keeps hydration stable with reduced motion and runtime domain configuration', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    window.__baitlyConfig = { VITE_APP_URL: 'https://app.baitly.fr' };
    try {
      const view = await mountPublished('/ressources/obligations/maroc', 'fr');
      expect(view.getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
        'href',
        'https://app.baitly.fr',
      );
    } finally {
      delete window.__baitlyConfig;
    }
  });

  it('applies URL filters after hydration without mismatching the published article list', async () => {
    const view = await mountPublished(
      '/ressources/blog',
      'fr',
      '&country=FR&topic=fiscalite',
    );
    expect(view.getByRole('combobox')).toHaveValue('fiscalite');
    expect(container.querySelectorAll('.blg-article-link').length).toBeLessThan(
      27,
    );
  });

  it('publishes a playable video and its transcript without JavaScript', async () => {
    const episode = ACADEMY_EPISODES[0];
    const { html } = await renderSite(
      `/ressources/academie/${episode.slug}`,
      'fr',
    );
    container.innerHTML = html;
    const video = container.querySelector('video');
    expect(video).toHaveAttribute('controls');
    // URL absolue canonique : identique au contentUrl des données structurées et au
    // sitemap vidéo (contrôle tooling/check_baitly_discovery.py).
    expect(video).toHaveAttribute(
      'src',
      `https://baitly.fr/academie/media/fr/${episode.slug}-16x9-1080.mp4`,
    );
    expect(video).toHaveAttribute('preload', 'none');
    expect(
      container.querySelector('.bac-transcript')?.textContent?.length,
    ).toBeGreaterThan(500);
  });
});

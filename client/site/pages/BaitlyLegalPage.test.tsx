import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteLanguageProvider } from '../lib/siteLanguage';
import {
  LEGAL_ARTICLES,
  LEGAL_COUNTRIES,
  LEGAL_SOURCES,
  articlePath,
  articlesForCountry,
  guidePath,
  localizeArticle,
} from '../data/legal';
import { LEGAL_MESSAGES } from '../lib/messages/baitlyLegal';
import BaitlyLegalPage from './BaitlyLegalPage';
import { legalArticleImage } from '../data/legal/articleImages';
import { journalArticles, JOURNAL_ARTICLE_COUNT } from '../data/baitlyJournal';
import { BAITLY_RESOURCE_MESSAGES } from '../lib/messages/baitlyResources';

vi.mock('../lib/siteLaunch', () => ({
  useSiteLaunch: () => ({ paused: false }),
}));

function mount(path: string) {
  window.history.replaceState({}, '', path);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SiteLanguageProvider>
        <Routes>
          <Route
            path="/ressources/obligations"
            element={<BaitlyLegalPage kind="guide" />}
          />
          <Route
            path="/ressources/obligations/:country"
            element={<BaitlyLegalPage kind="guide" />}
          />
          <Route
            path="/ressources/blog"
            element={<BaitlyLegalPage kind="journal" />}
          />
          <Route
            path="/ressources/blog/:article"
            element={<BaitlyLegalPage kind="article" />}
          />
        </Routes>
      </SiteLanguageProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Guide et journal réglementaire', () => {
  it('associe chaque vignette du journal à son article sans image partagée', () => {
    const { container } = mount('/ressources/blog?lang=fr');
    const links = [...container.querySelectorAll('.blg-article-link')];
    expect(links).toHaveLength(JOURNAL_ARTICLE_COUNT);
    expect(container.querySelectorAll('.blg-article-list')).toHaveLength(1);
    expect(screen.queryByText('Aussi dans le journal')).not.toBeInTheDocument();
    for (const article of LEGAL_ARTICLES) {
      const link = links.find(
        (link) =>
          link.getAttribute('href') === `${articlePath(article)}?lang=fr`,
      );
      expect(link?.querySelector('img')).toHaveAttribute(
        'src',
        legalArticleImage(article.slug).thumbnail,
      );
    }
    expect(
      new Set(
        links.map((link) => link.querySelector('img')?.getAttribute('src')),
      ).size,
    ).toBe(JOURNAL_ARTICLE_COUNT);
  });
  it('recherche les anciens articles pratiques et les filtre avec les dossiers', () => {
    const { container } = mount('/ressources/blog?lang=fr');
    const reading = BAITLY_RESOURCE_MESSAGES.fr.blog.articles[0];
    expect(screen.getByRole('status')).toHaveTextContent('27 articles');
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'revenus' },
    });
    expect(screen.getByRole('status')).toHaveTextContent('1 article');
    fireEvent.click(
      screen.getByRole('button', { name: 'France', exact: true }),
    );
    expect(screen.getByRole('heading', { name: reading.title })).toBeVisible();
    const details = container.querySelector('details')!;
    fireEvent.click(within(details).getByText(reading.title));
    expect(details).toHaveAttribute('open');
    expect(within(details).getByText(reading.sections[0].copy)).toBeVisible();
    expect(within(details).getByText(reading.takeaway)).toBeVisible();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'serviettes' },
    });
    expect(screen.getByRole('status')).toHaveTextContent('1 article');
    expect(
      screen.getByRole('heading', {
        name: BAITLY_RESOURCE_MESSAGES.fr.blog.articles[2].title,
      }),
    ).toBeVisible();
  });

  it.each(['en', 'ar'] as const)(
    'préserve les conseils traduits en %s dans le journal commun',
    (language) => {
      const { container } = mount(
        `/ressources/blog?lang=${language}&topic=revenus`,
      );
      const entry = journalArticles(language).find((a) => a.reading)!;
      const heading = screen.getByRole('heading', { name: entry.title });
      expect(heading).toBeVisible();
      expect(heading.closest('article')).toHaveAttribute('lang', language);
      expect(heading.closest('article')).toHaveAttribute(
        'dir',
        language === 'ar' ? 'rtl' : 'ltr',
      );
      expect(container.querySelectorAll('.blg-article-link')).toHaveLength(1);
    },
  );

  it.each(LEGAL_COUNTRIES)(
    'préserve les anciens liens vers $code',
    (country) => {
      mount(`/ressources/obligations?lang=fr&country=${country.code}`);
      const nav = screen.getByRole('navigation', {
        name: LEGAL_MESSAGES.fr.countries,
      });
      expect(
        within(nav).getByRole('link', { name: country.name.fr }),
      ).toHaveAttribute('aria-current', 'page');
      expect(screen.getAllByRole('checkbox')).toHaveLength(
        articlesForCountry(country.code).length,
      );
    },
  );

  it('sépare les coches par pays et exporte le dossier choisi avec ses sources', async () => {
    let blob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((value) => {
      blob = value as Blob;
      return 'blob:checklist';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    mount('/ressources/obligations/maroc?lang=fr');
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    const countries = () =>
      within(
        screen.getByRole('navigation', { name: LEGAL_MESSAGES.fr.countries }),
      );
    fireEvent.click(countries().getByRole('link', { name: 'France' }));
    expect(screen.queryAllByRole('checkbox', { checked: true })).toHaveLength(
      0,
    );
    fireEvent.click(countries().getByRole('link', { name: 'Maroc' }));
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(1);
    fireEvent.click(
      screen.getByRole('button', { name: LEGAL_MESSAGES.fr.download }),
    );
    expect(click).toHaveBeenCalledOnce();
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob!);
    });
    expect(text).toContain(`[x] ${LEGAL_ARTICLES[0].title}`);
    expect(text).toContain('2026-10-01');
    expect(text).toContain(
      LEGAL_SOURCES[LEGAL_ARTICLES[0].sections[0].sources[0]].url,
    );
    expect(text).not.toContain(articlesForCountry('FR')[0].title);
  });

  it('combine recherche sans accents, pays et sujet, puis réinitialise un résultat vide', () => {
    mount('/ressources/blog?lang=fr');
    fireEvent.click(
      screen.getByRole('button', { name: 'France', exact: true }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('12 articles');
    fireEvent.change(
      screen.getByRole('combobox', { name: LEGAL_MESSAGES.fr.allTopics }),
      { target: { value: 'fiscalite' } },
    );
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'exonerations' },
    });
    expect(screen.getByRole('status')).toHaveTextContent('1 article');
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: /Taxe de séjour en France/,
      }),
    ).toBeVisible();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'inexistant' },
    });
    expect(screen.getByText(LEGAL_MESSAGES.fr.noResults)).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: LEGAL_MESSAGES.fr.reset }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('27 articles');
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('ouvre un article complet avec périmètre, références et liens de lecture', () => {
    const article = articlesForCountry('SA')[4];
    mount(`${articlePath(article)}?lang=fr`);
    expect(
      screen.getByRole('img', { name: legalArticleImage(article.slug).alt }),
    ).toHaveAttribute('src', legalArticleImage(article.slug).src);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      article.title,
    );
    for (const section of article.sections)
      expect(
        screen.getByRole('heading', { name: section.title }),
      ).toBeVisible();
    expect(screen.getByText(article.scope, { exact: false })).toBeVisible();
    expect(
      screen.getByRole('link', { name: /Le guide du pays · Arabie saoudite/ }),
    ).toHaveAttribute('href', `${guidePath('SA')}?lang=fr`);
    expect(
      screen.getAllByRole('link', { name: /Umm Al-Qura/ }).length,
    ).toBeGreaterThan(0);
  });

  it.each(LEGAL_COUNTRIES)(
    'affiche le dossier $code entièrement en arabe et conserve la langue dans les liens',
    (country) => {
      const original = articlesForCountry(country.code)[0];
      const article = localizeArticle(original, 'ar');
      const { container } = mount(`${articlePath(article)}?lang=ar`);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        article.title,
      );
      expect(container.querySelector('.blg-article-page')).toHaveAttribute(
        'dir',
        'rtl',
      );
      for (const section of article.sections) {
        expect(
          screen.getByRole('heading', { name: section.title }),
        ).toBeVisible();
        for (const paragraph of section.paragraphs)
          expect(screen.getByText(paragraph)).toBeVisible();
      }
      expect(screen.queryByText(original.title)).not.toBeInTheDocument();
      for (const link of container.querySelectorAll(
        '.blg-article-page a[href^="/ressources/"]',
      )) {
        expect(link.getAttribute('href')).toContain('lang=ar');
      }
    },
  );

  it('recherche les dossiers saoudiens en arabe depuis le journal', () => {
    mount('/ressources/blog?lang=ar&country=SA');
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'شموس' },
    });
    const article = localizeArticle(articlesForCountry('SA')[2], 'ar');
    expect(screen.getByRole('heading', { name: article.title })).toBeVisible();
    expect(
      screen.getByRole('link', { name: new RegExp(article.title) }),
    ).toHaveAttribute('href', `${articlePath(article)}?lang=ar`);
  });

  it.each(['/ressources/blog/inconnu', '/ressources/obligations/inconnu'])(
    'affiche une vraie page absente pour %s',
    (path) => {
      mount(`${path}?lang=fr`);
      expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent(
        /Guide des obligations|Mieux comprendre/,
      );
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    },
  );
});

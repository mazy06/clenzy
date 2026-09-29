import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SiteLanguageProvider } from '../lib/siteLanguage';
import { ACADEMY_EPISODES } from '../data/baitlyAcademyVideos';
import { BAITLY_ACADEMY_MESSAGES } from '../lib/messages/baitlyAcademy';
import { BAITLY_RESOURCE_MESSAGES } from '../lib/messages/baitlyResources';
import { BAITLY_CONTACT_MESSAGES } from '../lib/messages/baitlyContact';
import BaitlyResourcePage from './BaitlyResourcePage';

vi.mock('../lib/siteLaunch', () => ({
  useSiteLaunch: () => ({ paused: false }),
}));

/** L'Académie : une page d'accueil (épisode 01 à la une) et une page par épisode. */
function mount(path: string) {
  window.history.replaceState({}, '', `${path}?lang=fr`);
  return render(
    <MemoryRouter initialEntries={[`${path}?lang=fr`]}>
      <SiteLanguageProvider>
        <Routes>
          <Route path="/ressources/academie" element={<BaitlyResourcePage kind="academie" />} />
          <Route path="/ressources/academie/:episode" element={<BaitlyResourcePage kind="academie" />} />
        </Routes>
      </SiteLanguageProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: false,
    media,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Page Académie', () => {
  it('met l’épisode 01 à la une, puis le programme et la mise en pratique', () => {
    mount('/ressources/academie');
    const academy = BAITLY_ACADEMY_MESSAGES.fr;
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(BAITLY_RESOURCE_MESSAGES.fr.modules.academie.title);
    expect(screen.getByRole('region', { name: academy.episodes[ACADEMY_EPISODES[0].slug].title })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: academy.ui.program })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: academy.ui.practiceTitle })).toBeInTheDocument();
    for (const episode of ACADEMY_EPISODES) {
      expect(
        screen.getByRole('link', { name: new RegExp(academy.episodes[episode.slug].title.replace(/[?]/g, '\\?')) }),
      ).toHaveAttribute('href', `/ressources/academie/${episode.slug}?lang=fr`);
    }
  });

  it('donne à chaque épisode sa page, son titre et ses chapitres', () => {
    const episode = ACADEMY_EPISODES[ACADEMY_EPISODES.length - 1];
    const text = BAITLY_ACADEMY_MESSAGES.fr.episodes[episode.slug];
    mount(`/ressources/academie/${episode.slug}`);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(text.title);
    expect(screen.getByRole('button', { name: new RegExp(text.chapters[2]) })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: new RegExp(text.title.replace(/[?]/g, '\\?')) })).toHaveAttribute('aria-current', 'page');
  });

  it('répond 404 pour un épisode inconnu', () => {
    mount('/ressources/academie/99-inconnu');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      BAITLY_CONTACT_MESSAGES.fr.notFound.replace(/\s+/g, ' '),
    );
  });
});

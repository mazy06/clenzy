import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AcademyEpisodeView from './AcademyEpisodeView';
import { ACADEMY_UP_NEXT_SECONDS } from './AcademyUpNext';
import { ACADEMY_THEME_ORDER, academyReadingOrder, nextAcademyEpisode } from './academyOrder';
import { academyEpisode } from '../../data/baitlyAcademyVideos';
import { BAITLY_ACADEMY_MESSAGES } from '../../lib/messages/baitlyAcademy';

/**
 * Fin d'épisode : l'Académie propose l'épisode suivant dans l'ordre du programme et l'enchaîne
 * après un compte à rebours, sauf si le visiteur l'annule ; après le dernier épisode, elle propose
 * de revoir ou de parcourir le programme.
 */
const m = BAITLY_ACADEMY_MESSAGES.fr;
const order = academyReadingOrder();

function Where() {
  const location = useLocation();
  const state = location.state as { academyAutoplay?: boolean } | null;
  return <output data-testid="where">{`${location.pathname}${location.hash}|${String(state?.academyAutoplay ?? false)}`}</output>;
}

const mount = (slug: string) =>
  render(
    <MemoryRouter initialEntries={[`/ressources/academie/${slug}`]}>
      <Routes>
        <Route
          path="/ressources/academie/:episode"
          element={
            <>
              <AcademyEpisodeView episode={academyEpisode(slug)!} language="fr" />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
const end = () => fireEvent(document.querySelector('video')!, new Event('ended'));
const tick = (seconds: number) => {
  for (let i = 0; i < seconds; i += 1) act(() => { vi.advanceTimersByTime(1000); });
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: false,
    media,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ordre de lecture', () => {
  it('suit le programme, par thème puis par numéro, et s’arrête après le dernier épisode', () => {
    order.slice(1).forEach((episode, index) => {
      const previous = order[index];
      const step = ACADEMY_THEME_ORDER.indexOf(episode.theme) - ACADEMY_THEME_ORDER.indexOf(previous.theme);
      expect(step > 0 || (step === 0 && episode.number > previous.number)).toBe(true);
      expect(nextAcademyEpisode(previous.slug)).toBe(episode);
    });
    expect(nextAcademyEpisode(order[order.length - 1].slug)).toBeUndefined();
  });
});

describe('AcademyUpNext', () => {
  it('ne montre rien pendant la lecture', () => {
    mount(order[0].slug);
    expect(screen.queryByText(m.ui.playNext)).toBeNull();
  });

  it('propose l’épisode suivant à la fin et l’enchaîne après le compte à rebours, en lecture', () => {
    const [current, next] = order;
    mount(current.slug);
    end();
    expect(screen.getByRole('heading', { name: m.episodes[next.slug].title })).toBeInTheDocument();
    expect(screen.getByText(`Lecture automatique dans ${ACADEMY_UP_NEXT_SECONDS} s`)).toBeInTheDocument();
    tick(ACADEMY_UP_NEXT_SECONDS - 1);
    expect(screen.getByTestId('where')).toHaveTextContent(`/ressources/academie/${current.slug}|false`);
    tick(1);
    expect(screen.getByTestId('where')).toHaveTextContent(`/ressources/academie/${next.slug}#academie-lecteur|true`);
  });

  it('enchaîne tout de suite au clic, et reste sur l’épisode si le visiteur annule', () => {
    const [current, next] = order;
    mount(current.slug);
    end();
    fireEvent.click(screen.getByRole('button', { name: m.ui.cancelAutoplay }));
    tick(ACADEMY_UP_NEXT_SECONDS + 2);
    expect(screen.getByTestId('where')).toHaveTextContent(`/ressources/academie/${current.slug}|false`);
    expect(screen.queryByText(/Lecture automatique/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: m.ui.playNext }));
    expect(screen.getByTestId('where')).toHaveTextContent(`/ressources/academie/${next.slug}#academie-lecteur|true`);
  });

  it('après le dernier épisode, propose de revoir ou de voir le programme', () => {
    const last = order[order.length - 1];
    mount(last.slug);
    end();
    expect(screen.getByRole('heading', { name: m.ui.seriesDone })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: m.ui.seeProgram })).toHaveAttribute('href', '#academie-programme');
    fireEvent.click(screen.getByRole('button', { name: m.ui.replay }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: m.ui.seriesDone })).toBeNull();
  });
});

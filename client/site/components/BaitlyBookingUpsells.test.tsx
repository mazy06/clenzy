import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SiteLanguageProvider } from '../lib/siteLanguage';
import BaitlyBookingUpsells from './BaitlyBookingUpsells';

let intersection: IntersectionObserverCallback;

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  vi.stubGlobal('navigator', {
    ...navigator,
    languages: ['fr-FR'],
    language: 'fr-FR',
  });
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersection = callback;
      }
      observe() {
        intersection(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderUpsells() {
  render(
    <MemoryRouter>
      <SiteLanguageProvider>
        <BaitlyBookingUpsells />
      </SiteLanguageProvider>
    </MemoryRouter>,
  );
}
const total = () =>
  screen
    .getByRole('status')
    .querySelector('strong')
    ?.textContent?.replace(/\s/g, '');
const tick = (milliseconds = 3200) =>
  act(() => vi.advanceTimersByTime(milliseconds));

describe('Baitly booking upsell showcase', () => {
  it('retains optional extras across categories and calculates their combined value', () => {
    renderUpsells();
    expect(total()).toBe('0€');
    fireEvent.click(
      screen.getByRole('button', { name: /Activités & expériences/ }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /Ajouter au séjour : Le lever du soleil/,
      }),
    );
    expect(total()).toBe('120€');
    fireEvent.click(screen.getByRole('button', { name: /Confort du séjour/ }));
    fireEvent.click(
      screen.getByRole('button', {
        name: /Ajouter au séjour : Prendre son temps/,
      }),
    );
    expect(total()).toBe('165€');
    fireEvent.click(screen.getByRole('button', { name: /Services privés/ }));
    fireEvent.click(
      screen.getByRole('button', { name: /Ajouter au séjour : Un chef/ }),
    );
    expect(total()).toBe('250€');
    const selection = screen.getByRole('complementary');
    expect(within(selection).getAllByRole('listitem')).toHaveLength(3);
    fireEvent.click(
      within(selection).getByRole('button', {
        name: /Retirer : Le lever du soleil/,
      }),
    );
    expect(total()).toBe('130€');
    fireEvent.click(
      screen.getByRole('button', { name: /Activités & expériences/ }),
    );
    expect(
      screen
        .getByRole('button', { name: /Ajouter au séjour : Le lever du soleil/ })
        .getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('can empty the selection and links to the welcome guide in the active language', () => {
    renderUpsells();
    fireEvent.click(
      screen.getByRole('button', { name: /Activités & expériences/ }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Ajouter au séjour : Une escapade/ }),
    );
    fireEvent.click(
      within(screen.getByRole('complementary')).getByRole('button', {
        name: /Retirer : Une escapade/,
      }),
    );
    expect(total()).toBe('0€');
    expect(screen.getByText('Essayez d’ajouter une option')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe(
      '/produit/livret-accueil?lang=fr',
    );
  });

  it('automatically adds each offer, advances through every category and loops without a pause control', () => {
    renderUpsells();
    const categories = [
      'Confort du séjour',
      'Services privés',
      'Activités & expériences',
    ];
    const totals = [
      ['45€', '105€'],
      ['85€', '121€'],
      ['120€', '185€'],
    ];
    const pointedButton = () =>
      document.querySelector('[data-demo-pointer]')?.closest('button');
    for (let index = 0; index < categories.length; index++) {
      expect(
        screen
          .getByRole('button', { name: categories[index] })
          .getAttribute('aria-pressed'),
      ).toBe('true');
      expect(total()).toBe('0€');
      expect(pointedButton()?.getAttribute('aria-label')).toMatch(
        /^Ajouter au séjour/,
      );
      tick();
      expect(total()).toBe(totals[index][0]);
      expect(pointedButton()?.getAttribute('aria-label')).toMatch(
        /^Ajouter au séjour/,
      );
      tick();
      expect(total()).toBe(totals[index][1]);
      expect(pointedButton()?.textContent).toBe(
        categories[(index + 1) % categories.length],
      );
      tick();
    }
    expect(
      screen
        .getByRole('button', { name: categories[0] })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(total()).toBe('0€');
    tick();
    expect(total()).toBe('45€');
    expect(screen.queryByRole('button', { name: /pause|rejouer/i })).toBeNull();
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('off');
  });

  it('waits while offscreen or in a hidden tab, then continues the same category', () => {
    renderUpsells();
    act(() =>
      intersection(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    tick(20000);
    expect(total()).toBe('0€');
    expect(document.querySelector('[data-demo-pointer]')).toBeNull();
    act(() =>
      intersection(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    tick();
    expect(total()).toBe('45€');
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    tick(20000);
    expect(total()).toBe('45€');
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    tick();
    expect(total()).toBe('105€');
  });

  it('continues after a manual selection and honours reduced motion', () => {
    renderUpsells();
    fireEvent.click(screen.getByRole('button', { name: /Services privés/ }));
    fireEvent.click(
      screen.getByRole('button', { name: /Ajouter au séjour : Un chef/ }),
    );
    tick();
    expect(total()).toBe('85€');
    tick();
    expect(total()).toBe('121€');
    cleanup();
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    renderUpsells();
    tick(30000);
    expect(total()).toBe('0€');
    fireEvent.click(
      screen.getByRole('button', {
        name: /Ajouter au séjour : Prendre son temps/,
      }),
    );
    expect(total()).toBe('45€');
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });
});

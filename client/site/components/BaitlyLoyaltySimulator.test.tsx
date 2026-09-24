import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import PricingPage from '../pages/PricingPage';
import { SiteLanguageProvider } from '../lib/siteLanguage';

vi.mock('../lib/siteLaunch', () => ({
  useSiteLaunch: () => ({ paused: true }),
}));
let intersection: IntersectionObserverCallback;
beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  vi.stubGlobal('navigator', {
    ...navigator,
    language: 'fr-FR',
    languages: ['fr-FR'],
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
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const mount = () =>
  render(
    <MemoryRouter>
      <SiteLanguageProvider>
        <PricingPage />
      </SiteLanguageProvider>
    </MemoryRouter>,
  );
const amount = () =>
  screen.getByTestId('loyalty-monthly').textContent?.replace(/\s/g, '');
const month = () => screen.getByRole('slider', { name: /Mois/ });
const tick = () => act(() => vi.advanceTimersByTime(1600));

describe('Baitly loyalty simulator', () => {
  it('recalculates months, properties, plans and markets without creating a subscription', () => {
    mount();
    expect(amount()).toBe('490MAD');
    fireEvent.change(month(), { target: { value: '7' } });
    fireEvent.change(
      screen.getByRole('slider', { name: 'Nombre de logements' }),
      { target: { value: '3' } },
    );
    expect(amount()).toBe('1176MAD');
    expect(
      screen.getByTestId('loyalty-year').textContent?.replace(/\s/g, ''),
    ).toBe('15435MAD');
    fireEvent.change(month(), { target: { value: '13' } });
    expect(amount()).toBe('1029MAD');
    fireEvent.click(
      screen.getByRole('button', { name: 'Gérer et vendre en direct' }),
    );
    expect(amount()).toBe('609MAD');
    fireEvent.change(screen.getByRole('combobox', { name: 'Votre marché' }), {
      target: { value: 'EU' },
    });
    expect(amount()).toBe('60,9EUR');
    expect(
      screen
        .getAllByRole('link', { name: /Rejoindre le pré-lancement/ })
        .every(
          (link) => link.getAttribute('href') === '/bientot-disponible?lang=fr',
        ),
    ).toBe(true);
  });
  it('plays all four tiers once, stops at the stable tier and can replay', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Animer les paliers' }));
    tick();
    expect(amount()).toBe('441MAD');
    tick();
    expect(amount()).toBe('392MAD');
    tick();
    expect(amount()).toBe('343MAD');
    expect(
      screen.getByRole('button', { name: 'Rejouer les paliers' }),
    ).toBeTruthy();
    act(() => vi.advanceTimersByTime(30000));
    expect(amount()).toBe('343MAD');
    fireEvent.click(
      screen.getByRole('button', { name: 'Rejouer les paliers' }),
    );
    expect(amount()).toBe('490MAD');
  });
  it('updates volume, loyalty, plan averages and exact monthly totals together', () => {
    mount();
    fireEvent.click(
      screen.getByRole('button', { name: '10–19 logements : −15 %' }),
    );
    expect(amount()).toBe('4581,5MAD');
    fireEvent.change(month(), { target: { value: '13' } });
    expect(amount()).toBe('3207,05MAD');
    const text = (id: string) =>
      screen.getByTestId(id).textContent?.replace(/\s/g, '');
    expect(text('plan-pro-unit')).toBe('320,71MAD');
    expect(text('plan-pro-total')).toBe('3207,05MADHT/mois');
    expect(text('loyalty-year')).toBe('48105,75MAD');
    fireEvent.change(screen.getByRole('combobox', { name: 'Votre marché' }), {
      target: { value: 'EU' },
    });
    expect(amount()).toBe('320,71EUR');
    expect(text('plan-pro-unit')).toBe('32,07EUR');
    expect(text('plan-pro-total')).toBe('320,71EURHT/mois');
    fireEvent.click(
      screen.getByRole('button', { name: '1–4 logements : 0 %' }),
    );
    expect(amount()).toBe('34,3EUR');
  });
  it('pauses for manual input and when the simulation leaves the viewport', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Animer les paliers' }));
    tick();
    fireEvent.change(month(), { target: { value: '8' } });
    tick();
    expect(amount()).toBe('392MAD');
    fireEvent.click(screen.getByRole('button', { name: 'Animer les paliers' }));
    act(() =>
      intersection(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    tick();
    expect(amount()).toBe('490MAD');
  });
  it('offers manual exploration without animation for reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    mount();
    expect(
      screen.queryByRole('button', { name: 'Animer les paliers' }),
    ).toBeNull();
    fireEvent.change(month(), { target: { value: '18' } });
    expect(amount()).toBe('343MAD');
  });
});

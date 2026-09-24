import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BaitlyBookingDemo from './BaitlyBookingDemo';
import { SiteLanguageProvider } from '../lib/siteLanguage';

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
});

const renderDemo = () =>
  render(
    <SiteLanguageProvider>
      <BaitlyBookingDemo />
    </SiteLanguageProvider>,
  );
const total = () =>
  screen.getByTestId('booking-demo-total').textContent?.replace(/\s/g, '');
const tick = (milliseconds: number) =>
  act(() => vi.advanceTimersByTime(milliseconds));

describe('Baitly booking journey', () => {
  it('recalculates optional services, lets guests remove them and resets on template change', () => {
    renderDemo();
    fireEvent.click(screen.getByRole('button', { name: '03 Les attentions' }));
    fireEvent.click(screen.getByRole('button', { name: /Dîner pour deux/ }));
    expect(total()).toBe('396€');
    fireEvent.click(screen.getByRole('button', { name: /Transfert aéroport/ }));
    expect(total()).toBe('424€');
    fireEvent.click(screen.getByRole('button', { name: /Dîner pour deux/ }));
    expect(total()).toBe('388€');
    fireEvent.click(
      screen.getByRole('button', { name: /Villa & séjour privé/ }),
    );
    expect(total()).toBe('720€');
    expect(
      screen
        .getByRole('button', { name: '01 Les dates' })
        .getAttribute('aria-current'),
    ).toBe('step');
    fireEvent.click(
      screen.getByRole('button', { name: /Conciergerie & collection/ }),
    );
    expect(total()).toBe('540€');
    expect(
      screen
        .getByRole('button', { name: '01 Les adresses' })
        .getAttribute('aria-current'),
    ).toBe('step');
  });

  it('animates the funnel, adds an extra, stops at confirmation and can replay', () => {
    renderDemo();
    tick(3200);
    tick(3200);
    tick(2200);
    expect(total()).toBe('396€');
    tick(3200);
    expect(screen.getByText('Votre escapade prend forme.')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Rejouer le parcours' }),
    ).toBeTruthy();
    tick(20000);
    expect(total()).toBe('396€');
    fireEvent.click(
      screen.getByRole('button', { name: 'Rejouer le parcours' }),
    );
    expect(total()).toBe('360€');
    expect(
      screen
        .getByRole('button', { name: '01 La chambre' })
        .getAttribute('aria-current'),
    ).toBe('step');
  });

  it('suspends outside the viewport and preserves the cart when paused', () => {
    renderDemo();
    act(() =>
      intersection(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    tick(20000);
    expect(
      screen
        .getByRole('button', { name: '01 La chambre' })
        .getAttribute('aria-current'),
    ).toBe('step');
    act(() =>
      intersection(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    tick(3200);
    tick(3200);
    tick(2200);
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en pause' }));
    tick(20000);
    expect(total()).toBe('396€');
    expect(screen.queryByText('Votre escapade prend forme.')).toBeNull();
  });

  it('keeps manual exploration available with reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    renderDemo();
    tick(30000);
    expect(
      screen.queryByRole('button', { name: 'Mettre en pause' }),
    ).toBeNull();
    expect(
      screen
        .getByRole('button', { name: '01 La chambre' })
        .getAttribute('aria-current'),
    ).toBe('step');
    fireEvent.click(screen.getByRole('button', { name: '03 Les attentions' }));
    fireEvent.click(screen.getByRole('button', { name: /Dîner pour deux/ }));
    expect(total()).toBe('396€');
  });
});

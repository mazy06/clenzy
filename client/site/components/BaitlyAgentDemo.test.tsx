import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BaitlyAgentDemo from './BaitlyAgentDemo';
import { SiteLanguageProvider } from '../lib/siteLanguage';

function mockMotionPreference(reduced: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  mockMotionPreference(false);
  // Les assertions lisent la copie FRANCAISE : sans cet ancrage, jsdom annonce
  // 'en-US' et le provider sert — correctement — la demo en anglais.
  vi.stubGlobal('navigator', { ...navigator, languages: ['fr-FR'], language: 'fr-FR' });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [{ target, isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderDemo() {
  render(
    <MemoryRouter>
      <SiteLanguageProvider>
        <BaitlyAgentDemo />
      </SiteLanguageProvider>
    </MemoryRouter>,
  );
}

describe('Baitly interactive agent demonstration', () => {
  it('lets visitors approve a proposal and try another agent independently', () => {
    renderDemo();
    fireEvent.click(screen.getByRole('button', { name: 'Approuver le tarif' }));
    expect(
      screen.getByText('Nouveau tarif appliqué aux dates proposées.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Agent Séjours/ }));
    expect(
      screen.getByRole('button', { name: 'Envoyer le message' }),
    ).toBeTruthy();
    expect(
      screen.queryByText('Nouveau tarif appliqué aux dates proposées.'),
    ).toBeNull();
  });

  it('keeps the current decision visible when playback is paused', () => {
    renderDemo();
    fireEvent.click(screen.getByRole('button', { name: 'Lire la démo' }));
    act(() => vi.advanceTimersByTime(3500));
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => vi.advanceTimersByTime(20000));
    expect(
      screen.getByText('Nouveau tarif appliqué aux dates proposées.'),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: /Agent Revenue/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByRole('button', { name: 'Lire la démo' })).toBeTruthy();
  });

  it('keeps manual exploration available when reduced motion is preferred', () => {
    mockMotionPreference(true);
    renderDemo();
    expect(screen.queryByRole('button', { name: 'Lire la démo' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Agent Opérations/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider la mission' }));
    expect(
      screen.getByText('Mission validée. L’équipe retrouve ses consignes.'),
    ).toBeTruthy();
  });
});

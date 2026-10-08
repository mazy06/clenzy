import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AnimatedPlanningMockup from './AnimatedPlanningMockup';
import { SiteLanguageProvider } from '../lib/siteLanguage';

let intersection: IntersectionObserverCallback;
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
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
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const show = (visible: boolean) =>
  act(() =>
    intersection(
      [{ isIntersecting: visible } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  );
const renderDemo = () =>
  render(
    <SiteLanguageProvider>
      <AnimatedPlanningMockup />
    </SiteLanguageProvider>,
  );

describe('planning marketing preview', () => {
  it('autoplays only in view and preserves the scene when paused or offscreen', () => {
    const { container } = renderDemo();
    expect(container.querySelector('[data-planning-panel="filters"]')).toBeNull();
    tick(10000);
    expect(container.querySelector('.bpm-demo-controls')).toHaveTextContent(
      'Vos logements',
    );
    show(true);
    // Le rythme suit la voix off française (repères de PLANNING_VOICE_CUES).
    tick(13000);
    expect(container.querySelector('[data-planning-panel="filters"] [data-chip="airbnb"]')).not.toBeNull();
    expect(container.querySelector('.bpm-demo-controls')).toHaveTextContent(
      'Isoler un canal',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pause', exact: true }));
    tick(20000);
    expect(container.querySelector('[data-bar="r9"]')).toHaveStyle({
      opacity: '1',
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Reprendre', exact: true }),
    );
    tick(1000);
    expect(container.querySelector('[data-bar="r9"]')).toHaveStyle({
      opacity: '0.12',
    });
    show(false);
    tick(20000);
    expect(container.querySelector('[data-bar="r9"]')).toHaveStyle({
      opacity: '0.12',
    });
    show(true);
    tick(5000);
    expect(container.querySelector('[data-bar="r9"]')).toHaveStyle({
      opacity: '1',
    });
    tick(3000);
    expect(container.querySelector('[data-planning-panel="filters"]')).toBeNull();
  });

  it('creates the direct booking and loops back to a clean planning', () => {
    const { container } = renderDemo();
    show(true);
    tick(70000);
    expect(container.querySelector('[data-bar="rn"]')).toHaveTextContent(
      'Sarah Miller',
    );
    tick(8000);
    expect(container.querySelector('[data-bar="rn"]')).toBeNull();
    expect(container.querySelector('.bpm-demo-controls')).toHaveTextContent(
      'Vos logements',
    );
  });

  it('explains each action separately and holds its result before continuing', () => {
    const { container } = renderDemo();
    const step = () =>
      container
        .querySelector('[data-guide-step]')
        ?.getAttribute('data-guide-step');
    show(true);
    tick(3000);
    expect(step()).toBe('0');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Tout savoir sur un logement',
    );
    // Instants absolus calés sur la voix française : 13 s, 22 s, 31 s…
    tick(10000);
    expect(step()).toBe('1');
    tick(9000);
    expect(step()).toBe('2');
    tick(9000);
    expect(step()).toBe('3');
    tick(3800);
    const movedBar = container.querySelector('[data-bar="r9"]');
    const stablePosition = movedBar?.getAttribute('style');
    tick(1200);
    expect(step()).toBe('3');
    expect(movedBar?.getAttribute('style')).toBe(stablePosition);
    tick(2000);
    expect(step()).toBe('4');
    tick(7500);
    expect(step()).toBe('5');
    tick(9500);
    expect(step()).toBe('6');
    tick(6000);
    expect(step()).toBe('7');
    tick(8000);
    expect(step()).toBe('8');
    fireEvent.click(screen.getByRole('button', { name: 'Pause', exact: true }));
    tick(20000);
    expect(step()).toBe('8');
    expect(container.querySelector('[data-bar="rn"]')).not.toBeNull();
    // Toute la boucle (70 s simulées, rendu à chaque geste) dépasse le délai global.
  }, 60_000);

  it('keeps a static calendar when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const { container } = renderDemo();
    show(true);
    tick(39000);
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    expect(container.querySelector('[data-bar="rn"]')).toBeNull();
    expect(container.querySelector('[data-guide-step]')).toBeNull();
    expect(container.querySelector('.bpm-demo-controls')).toHaveTextContent(
      'Vos logements',
    );
  });
});

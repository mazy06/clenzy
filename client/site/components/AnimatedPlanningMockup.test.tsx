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
    tick(10000);
    expect(container.querySelector('.bpm-demo-controls')).toHaveTextContent(
      'Vos logements',
    );
    show(true);
    tick(9000);
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
    tick(250);
    expect(container.querySelector('[data-bar="r9"]')).toHaveStyle({
      opacity: '0.12',
    });
    show(false);
    tick(20000);
    expect(container.querySelector('[data-bar="r9"]')).toHaveStyle({
      opacity: '0.12',
    });
    show(true);
    tick(3500);
    expect(container.querySelector('[data-bar="r9"]')).toHaveStyle({
      opacity: '1',
    });
  });

  it('creates the direct booking and loops back to a clean planning', () => {
    const { container } = renderDemo();
    show(true);
    tick(59000);
    expect(container.querySelector('[data-bar="rn"]')).toHaveTextContent(
      'Sarah Miller',
    );
    tick(4000);
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
    tick(5000);
    tick(2500);
    expect(step()).toBe('1');
    tick(6000);
    expect(step()).toBe('2');
    tick(7500);
    expect(step()).toBe('3');
    const movedBar = container.querySelector('[data-bar="r9"]');
    const stablePosition = movedBar?.getAttribute('style');
    tick(2500);
    expect(step()).toBe('3');
    expect(movedBar?.getAttribute('style')).toBe(stablePosition);
    tick(4500);
    expect(step()).toBe('4');
    tick(6500);
    expect(step()).toBe('5');
    tick(8500);
    expect(step()).toBe('6');
    tick(7000);
    expect(step()).toBe('7');
    tick(6000);
    expect(step()).toBe('8');
    fireEvent.click(screen.getByRole('button', { name: 'Pause', exact: true }));
    tick(20000);
    expect(step()).toBe('8');
    expect(container.querySelector('[data-bar="rn"]')).not.toBeNull();
  });

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

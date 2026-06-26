// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawnComet } from '../spawnComet';

function makeEl(): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({ left: 10, top: 10, width: 20, height: 20, right: 30, bottom: 30, x: 10, y: 10, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

describe('spawnComet', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('no-op si la source ou la cible manque', () => {
    spawnComet({ sourceEl: null, targetEl: makeEl(), color: '#7C5CE0' });
    expect(document.querySelectorAll('.supervision-comet')).toHaveLength(0);
  });

  it('crée une comète puis la retire après la durée', () => {
    const source = makeEl();
    const target = makeEl();
    spawnComet({ sourceEl: source, targetEl: target, color: '#7C5CE0', durationMs: 500 });
    expect(document.querySelectorAll('.supervision-comet')).toHaveLength(1);
    vi.advanceTimersByTime(500);
    expect(document.querySelectorAll('.supervision-comet')).toHaveLength(0);
  });

  it('fait pulser la cible via Web Animations (si dispo)', () => {
    const source = makeEl();
    const target = makeEl();
    const animate = vi.fn();
    (target as unknown as { animate: typeof animate }).animate = animate;
    spawnComet({ sourceEl: source, targetEl: target, color: '#37D98A', durationMs: 300 });
    vi.advanceTimersByTime(300);
    expect(animate).toHaveBeenCalled();
  });

  it('ne crée aucune comète en prefers-reduced-motion', () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: () => false,
    }) as typeof window.matchMedia;
    try {
      spawnComet({ sourceEl: makeEl(), targetEl: makeEl(), color: '#7C5CE0' });
      expect(document.querySelectorAll('.supervision-comet')).toHaveLength(0);
    } finally {
      window.matchMedia = original;
    }
  });
});

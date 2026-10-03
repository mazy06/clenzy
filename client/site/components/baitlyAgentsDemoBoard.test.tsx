import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AgentsBoard, INITIAL_AUTONOMY, INITIAL_COUNTS } from './baitlyAgentsDemoBoard';
import { AGENTS_DEMO_MESSAGES } from '../lib/messages/baitlyAgentsDemo';
import { SiteLanguageProvider } from '../lib/siteLanguage';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('fits the measured column and follows its resize while the demo is paused', () => {
  let width = 579;
  let height = 455;
  const observers = new Set<() => void>();
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute('data-orbit') ? width : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute('data-orbit') ? height : 0;
  });
  vi.stubGlobal('ResizeObserver', class {
    constructor(private callback: () => void) {}
    observe() { observers.add(this.callback); }
    disconnect() { observers.delete(this.callback); }
  });
  const { container, unmount } = render(
    <SiteLanguageProvider initialLanguage="fr">
      <AgentsBoard
        m={AGENTS_DEMO_MESSAGES.fr}
        height={530}
        playing={false}
        state={{ view: 'orbit', selected: 'rep', counts: INITIAL_COUNTS, autonomy: INITIAL_AUTONOMY, leaving: new Set(), gone: new Set() }}
      />
    </SiteLanguageProvider>,
  );
  const canvas = container.querySelector<HTMLElement>('[data-supervision-constellation]')!;
  const initialSide = parseFloat(canvas.style.width);
  expect(initialSide).toBeGreaterThan(460);
  expect(canvas.style.height).toBe(canvas.style.width);
  expect(container.querySelectorAll('[data-orbit-node]')).toHaveLength(10);

  act(() => {
    width = 300;
    observers.forEach(callback => callback());
  });
  const narrowSide = parseFloat(canvas.style.width);
  expect(narrowSide).toBeLessThan(initialSide);
  act(() => {
    height = 240;
    observers.forEach(callback => callback());
  });
  expect(parseFloat(canvas.style.width)).toBeLessThan(narrowSide);
  expect(canvas.style.height).toBe(canvas.style.width);
  unmount();
  expect(observers.size).toBe(0);
});

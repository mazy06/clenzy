import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BaitlyAgentsPlanningDemo from './BaitlyAgentsPlanningDemo';
import { SiteLanguageProvider } from '../lib/siteLanguage';

let intersection: IntersectionObserverCallback;
let reducedMotion = false;
beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  reducedMotion = false;
  vi.stubGlobal('navigator', { ...navigator, languages: ['fr-FR'], language: 'fr-FR' });
  vi.stubGlobal('matchMedia', () => ({
    matches: reducedMotion,
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
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const show = () =>
  act(() =>
    intersection([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver),
  );
const renderDemo = () =>
  render(
    <SiteLanguageProvider>
      <BaitlyAgentsPlanningDemo />
    </SiteLanguageProvider>,
  );

describe('home agents demonstration', () => {
  it('presents the planning without framing it, then expands a property', () => {
    const { container } = renderDemo();
    tick(20000);
    expect(container.querySelector('[data-agents-board]')).toBeNull();
    show();
    tick(3000);
    expect(container.querySelector('[data-guide-step="0"] .bpm-guide-focus')).toBeNull();
    tick(8000);
    expect(container.querySelector('[data-agents-board]')).not.toBeNull();
    expect(container.querySelector('[data-board-header]')).toHaveTextContent('27 à valider');
  });

  it('publishes the adjusted review reply and removes the card from the queue', () => {
    const { container } = renderDemo();
    show();
    const reply = () =>
      container.querySelector<HTMLTextAreaElement>('[data-planning-panel="reply"] textarea')?.value;
    // Repères FR : « Je l'insère » (étape 4), puis l'ajustement sous la
    // phrase « Plutôt qu'une promesse vague… » et la publication sur « Je publie ».
    tick(39000);
    expect(reply()).toContain('nous allons réfléchir');
    tick(8000);
    expect(reply()).toContain('double vitrage côté rue');
    expect(reply()).not.toContain('nous allons réfléchir');
    tick(2500);
    expect(container.querySelector('[data-planning-panel="reply"]')).toBeNull();
    expect(container.querySelector('[data-card="review-laura"]')).toBeNull();
    expect(container.querySelector('[data-board-header]')).toHaveTextContent('26 à valider');
  });

  it('narrates from the first view, then mutes itself after one loop and keeps playing', () => {
    const { container } = renderDemo();
    tick(2000);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    show();
    tick(1500);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Couper la voix off' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    tick(100000);
    const toggle = screen.getByRole('button', { name: 'Activer la voix off' });
    expect(toggle).toHaveAttribute('data-attention');
    tick(3000);
    expect(container.querySelector('[data-guide-step="0"]')).not.toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Couper la voix off' })).not.toHaveAttribute(
      'data-attention',
    );
  });

  it('waits for a first interaction when the browser blocks sound', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(
      Object.assign(new Error('blocked'), { name: 'NotAllowedError' }),
    );
    renderDemo();
    show();
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByRole('button', { name: 'Activer la voix off' })).toHaveAttribute(
      'data-attention',
    );
    const calls = vi.mocked(HTMLMediaElement.prototype.play).mock.calls.length;
    vi.mocked(HTMLMediaElement.prototype.play).mockResolvedValue(undefined);
    fireEvent.pointerDown(document.body);
    // La voix rejoint l'étape en cours : elle se positionne une fois la
    // durée du clip connue (métadonnées, que jsdom ne charge jamais).
    const players = vi.mocked(HTMLMediaElement.prototype.play).mock.contexts as HTMLMediaElement[];
    act(() => players.forEach((audio) => audio.dispatchEvent(new Event('loadedmetadata'))));
    expect(vi.mocked(HTMLMediaElement.prototype.play).mock.calls.length).toBeGreaterThan(calls);
    expect(screen.getByRole('button', { name: 'Couper la voix off' })).toBeInTheDocument();
  });

  it('shows a still constellation without controls when motion is reduced', () => {
    reducedMotion = true;
    const { container } = renderDemo();
    show();
    tick(30000);
    expect(container.querySelector('[data-agents-board]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    expect(container.querySelector('[data-guide-step]')).toBeNull();
  });
});

// @vitest-environment jsdom
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { AgentSpeechSurface } from '../renderers/AgentSpeechSurface';
import { agentSpeechOutline } from '../renderers/agentSpeechGeometry';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('agent speech geometry', () => {
  it.each([{ x: -24, y: 40 }, { x: 384, y: 180 }, { x: 50, y: -24 }, { x: 300, y: 284 }])('joins the exact notification centre at $x, $y', (anchor) => {
    const path = agentSpeechOutline(360, 260, anchor);
    expect(path).toContain(`${anchor.x.toFixed(2)} ${anchor.y.toFixed(2)} Q`);
    expect(path).not.toMatch(/NaN|Infinity/);
    expect(path).toContain('A 26 26');
  });

  it('starts with the badge dimensions and changes its actual contour between frames', () => {
    const anchor = { x: 230, y: -28 };
    expect(agentSpeechOutline(360, 260, anchor, 0)).toContain('A 12 12');
    expect(agentSpeechOutline(360, 260, anchor, .5)).toContain('A 19 19');
    expect(agentSpeechOutline(360, 260, anchor, 0, 12, 38)).toContain('M 223.00 -40.00');
  });

  it('keeps the notch on the facing edge when a corner collision shifts the body', () => {
    // The source is both left of and below the panel, but the panel was placed
    // above it. The notch belongs to the bottom, not to the left-hand edge.
    const path = agentSpeechOutline(336, 240, { x: -4, y: 268 }, 1, 12, 24, 'bottom');
    expect(path).toContain('L 55.00 239.00 Q');
    expect(path).toContain('-4.00 268.00 Q');
  });
});

describe('AgentSpeechSurface morph', () => {
  let popupLeft = 200;
  beforeEach(() => {
    vi.useFakeTimers();
    popupLeft = 200;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.dataset.testid === 'badge'
        ? { x: 172, y: 200, left: 172, top: 200, right: 196, bottom: 224, width: 24, height: 24, toJSON() {} }
        : { x: popupLeft, y: 100, left: popupLeft, top: 100, right: popupLeft + 360, bottom: 360, width: 360, height: 260, toJSON() {} };
    });
  });

  it('expands the contour, tracks a repositioned popover and contracts to the same badge', () => {
    const anchorRef = createRef<HTMLSpanElement>();
    const scene = (open: boolean) => <><span ref={anchorRef} data-testid="badge">4</span><div data-slot="popover-content"><AgentSpeechSurface anchorRef={anchorRef} open={open} badge="4">Content</AgentSpeechSurface></div></>;
    const { container, rerender } = render(scene(true));
    const path = () => container.querySelector('path')!.getAttribute('d')!;
    act(() => vi.advanceTimersByTime(16));
    expect(path()).toContain('A 12 12');
    act(() => vi.advanceTimersByTime(160));
    expect(path()).not.toContain('A 12 12');
    expect(path()).not.toContain('A 26 26');
    act(() => vi.advanceTimersByTime(180));
    expect(path()).toContain('A 26 26');
    expect(path()).toContain('-16.00 112.00 Q');
    popupLeft = 240;
    fireEvent.scroll(window);
    act(() => vi.advanceTimersByTime(16));
    expect(path()).toContain('-56.00 112.00 Q');
    rerender(scene(false));
    act(() => vi.advanceTimersByTime(160));
    expect(path()).not.toContain('A 12 12');
    expect(path()).not.toContain('A 26 26');
    act(() => vi.advanceTimersByTime(180));
    expect(path()).toContain('A 12 12');
  });

  it('shows the final shape immediately when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const anchorRef = createRef<HTMLSpanElement>();
    const { container } = render(<><span ref={anchorRef} data-testid="badge"/><div data-slot="popover-content"><AgentSpeechSurface anchorRef={anchorRef} open badge="4">Content</AgentSpeechSurface></div></>);
    act(() => vi.advanceTimersByTime(32));
    expect(container.querySelector('path')!.getAttribute('d')).toContain('A 26 26');
  });
});

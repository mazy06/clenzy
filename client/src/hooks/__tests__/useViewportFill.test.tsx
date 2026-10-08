import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useViewportFill } from '../useViewportFill';

vi.mock('../../utils/layoutShift', () => ({ createSettledScheduler: (measure: () => void) => ({ schedule: measure, cancel: vi.fn() }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('reclaims space after a header shrinks even when the body keeps its viewport height', () => {
  let headerHeight = 160;
  const observed = new Set<Element>();
  let resized = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resized = callback; }
    observe(element: Element) { observed.add(element); }
    disconnect = disconnect;
  });
  vi.stubGlobal('innerWidth', 1440);
  vi.stubGlobal('innerHeight', 900);
  vi.stubGlobal('visualViewport', undefined);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const top = this.dataset.testid === 'workspace' ? headerHeight : 0;
    return { x: 0, y: top, left: 0, top, width: 1000, height: 900, right: 1000, bottom: 900, toJSON: () => ({}) };
  });
  function Page() {
    const [ref, height] = useViewportFill<HTMLDivElement>();
    return <main><header data-testid="header">Room controls</header><div ref={ref} data-testid="workspace" style={{ height }} /></main>;
  }
  const page = render(<Page />);
  expect(screen.getByTestId('workspace').style.height).toBe('728px');
  expect(observed.has(screen.getByTestId('header'))).toBe(true);
  headerHeight = 100;
  act(() => resized());
  expect(screen.getByTestId('workspace').style.height).toBe('788px');
  page.unmount();
  expect(disconnect).toHaveBeenCalled();
});

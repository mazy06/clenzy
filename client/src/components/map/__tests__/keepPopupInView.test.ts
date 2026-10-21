import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Map, Popup } from 'maplibre-gl';
import { keepPopupInView } from '../keepPopupInView';

afterEach(() => vi.unstubAllGlobals());

describe('Fiches Baitly dans une petite carte', () => {
  it('excludes overlay lists and leaves space for the clicked place below its card', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    let frame: FrameRequestCallback = () => {};
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const split = document.createElement('div');
    split.className = 'baitly-map-split';
    const container = document.createElement('div');
    const left = document.createElement('aside'); left.className = 'baitly-map-split__aside';
    const right = document.createElement('section'); right.className = 'baitly-map-split__list';
    split.append(container, left, right);
    const rect = (x: number, width: number) => ({ left: x, right: x + width, top: 0, bottom: 700, width, height: 700 } as DOMRect);
    container.getBoundingClientRect = () => rect(0, 1000);
    left.getBoundingClientRect = () => rect(0, 240);
    right.getBoundingClientRect = () => rect(800, 200);
    const element = document.createElement('div');
    const content = document.createElement('div'); content.className = 'maplibregl-popup-content';
    content.getBoundingClientRect = () => ({ left: 100, right: 580, top: 150, bottom: 450, width: 480, height: 300 } as DOMRect);
    element.append(content);
    const map = { getContainer: () => container, on: vi.fn(), off: vi.fn(), isMoving: () => false, panBy: vi.fn() };
    const release = keepPopupInView(map as unknown as Map, { getElement: () => element } as unknown as Popup, { bottomGap: 36 });
    frame(0);
    expect(content.style.getPropertyValue('--baitly-popup-width')).toBe('536px');
    expect(content.style.getPropertyValue('--baitly-popup-height')).toBe('640px');
    expect(map.panBy).toHaveBeenCalledWith([-152, -0], expect.any(Object));
    release();
  });
  it('plafonne la fiche à la vraie surface disponible, sans imposer un minimum qui déborde', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ left: 0, top: 0, right: 180, bottom: 140, width: 180, height: 140 } as DOMRect);
    const element = document.createElement('div');
    const content = document.createElement('div');
    content.className = 'maplibregl-popup-content';
    element.append(content);
    const map = { getContainer: () => container, on: vi.fn(), off: vi.fn() };
    const release = keepPopupInView(map as unknown as Map, { getElement: () => element } as unknown as Popup);
    expect(content.style.maxInlineSize).toBe('156px');
    expect(content.style.maxBlockSize).toBe('116px');
    release();
    expect(map.off).toHaveBeenCalledWith('moveend', expect.any(Function));
    expect(map.off).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});

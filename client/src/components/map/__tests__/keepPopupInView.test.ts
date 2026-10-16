import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Map, Popup } from 'maplibre-gl';
import { keepPopupInView } from '../keepPopupInView';

afterEach(() => vi.unstubAllGlobals());

describe('Fiches Baitly dans une petite carte', () => {
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

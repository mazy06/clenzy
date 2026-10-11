import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaitlyMapCanvas, type PropertyMarker } from '../BaitlyMapCanvas';
import { MapSheetProvider } from '../map/MapSheetContext';

const state = vi.hoisted(() => ({ markers: [] as Array<{ element: HTMLElement; removed: number }> }));
const container = document.createElement('div');
const map = {
  on: vi.fn(), off: vi.fn(), remove: vi.fn(), resize: vi.fn(), jumpTo: vi.fn(), fitBounds: vi.fn(),
  getContainer: () => container, getZoom: () => 20,
  getBounds: () => ({ getNorth: () => 90, getSouth: () => -90, getEast: () => 180, getWest: () => -180 }),
  project: () => ({ x: 120, y: 100 }),
};

vi.mock('../map/createBaitlyMap', () => ({ createBaitlyMap: () => map, setBaitlyMapMode: vi.fn(), prefersReducedMotion: () => true }));
vi.mock('../map/keepPopupInView', () => ({ keepPopupInView: () => () => undefined }));
vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (_key: string, fallback: unknown) => typeof fallback === 'string' ? fallback : 'Lieux' }) }));
vi.mock('maplibre-gl', () => {
  class Popup {
    options: Record<string, unknown>;
    private opened = false;
    private listeners = new Map<string, Array<() => void>>();
    private content?: HTMLElement;
    constructor(options: Record<string, unknown>) { this.options = options; }
    setDOMContent(content: HTMLElement) { this.content = content; return this; }
    setLngLat() { return this; }
    addTo() { if (this.content) container.append(this.content); return this; }
    remove() { this.content?.remove(); return this; }
    on(event: string, callback: () => void) { this.listeners.set(event, [...(this.listeners.get(event) ?? []), callback]); return this; }
    isOpen() { return this.opened; }
    toggle() { this.opened = !this.opened; this.listeners.get(this.opened ? 'open' : 'close')?.forEach((listener) => listener()); }
  }
  class Marker {
    element: HTMLElement;
    removed = 0;
    private popup?: Popup;
    private position = { lng: 0, lat: 0 };
    constructor({ element }: { element: HTMLElement }) { this.element = element; state.markers.push(this); }
    setLngLat([lng, lat]: [number, number]) { this.position = { lng, lat }; return this; }
    getLngLat() { return this.position; }
    setPopup(popup: Popup) { this.popup = popup; return this; }
    getPopup() { return this.popup; }
    getElement() { return this.element; }
    addTo() { container.append(this.element); return this; }
    remove() { this.removed++; this.element.remove(); return this; }
    togglePopup() { this.popup?.toggle(); return this; }
  }
  return { Marker, Popup, LngLatBounds: class { extend() { return this; } } };
});

const place: PropertyMarker = { id: 1, name: 'Doha', lat: 25.2854, lng: 51.531 };

beforeEach(() => {
  vi.clearAllMocks();
  state.markers.length = 0;
  container.replaceChildren();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Carte Baitly : rafraîchissements et caméra', () => {
  it('conserve la carte régionale quand seul le fond mondial est indisponible', () => {
    render(<BaitlyMapCanvas properties={[place]} center={[51.5, 25.3]} />);
    const errorHandler = map.on.mock.calls.find(([event]) => event === 'error')?.[1];
    const loadHandler = map.on.mock.calls.find(([event]) => event === 'load')?.[1];
    act(() => { errorHandler({ sourceId: 'baitly-world', error: new Error('HTTP 403') }); loadHandler(); });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Carte régionale affichée');
    expect(state.markers[0].removed).toBe(0);
    expect(map.remove).not.toHaveBeenCalled();
  });

  it('signale toujours un échec du fond régional même si le fond mondial échoue aussi', () => {
    render(<BaitlyMapCanvas properties={[place]} />);
    const errorHandler = map.on.mock.calls.find(([event]) => event === 'error')?.[1];
    act(() => { errorHandler({ sourceId: 'protomaps', error: new Error('HTTP 403') }); errorHandler({ sourceId: 'baitly-world', error: new Error('HTTP 403') }); });
    expect(screen.getByRole('alert').textContent).toContain('Le fond de carte');
  });

  it('met à jour les états et les callbacks sans recréer le marqueur ni recadrer', () => {
    const clicked = vi.fn();
    const { rerender } = render(<BaitlyMapCanvas properties={[place]} center={[51.5, 25.3]} onMarkerClick={clicked} />);
    const marker = state.markers[0];
    map.fitBounds.mockClear();
    map.jumpTo.mockClear();
    const refreshed = { ...place, state: 'late' as const, name: 'Doha, maintenance' };
    rerender(<BaitlyMapCanvas properties={[refreshed]} center={[51.5, 25.3]} onMarkerClick={clicked} />);
    expect(state.markers).toHaveLength(1);
    expect(marker.removed).toBe(0);
    expect(marker.element.dataset.state).toBe('late');
    fireEvent.click(marker.element);
    expect(clicked).toHaveBeenCalledWith(refreshed);
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.jumpTo).not.toHaveBeenCalled();
  });

  it('ne dépend pas de load pour afficher les marqueurs arrivés après le montage', () => {
    const { rerender } = render(<BaitlyMapCanvas properties={[]} center={[51.5, 25.3]} />);
    rerender(<BaitlyMapCanvas properties={[place]} center={[51.5, 25.3]} />);
    expect(state.markers).toHaveLength(1);
    expect(container.querySelector('[aria-label="Doha"]')).not.toBeNull();
  });

  it('cadre tous les lieux uniquement sur une demande explicite quand le centre utilisateur est connu', () => {
    render(<BaitlyMapCanvas properties={[place]} center={[51.5, 25.3]} />);
    expect(map.fitBounds).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Voir tous les lieux' }));
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('rend le détail mobile dans la feuille plutôt que dans une bulle sur la carte', () => {
    const detailHost = document.createElement('div');
    document.body.append(detailHost);
    const openDetail = vi.fn();
    render(<MapSheetProvider value={{ detailHost, detailOpen: true, openDetail, closeDetail: vi.fn() }}>
      <BaitlyMapCanvas properties={[place]} center={[51.5, 25.3]} renderPopup={(marker) => <p>{marker.name} détail</p>} />
    </MapSheetProvider>);
    fireEvent.click(state.markers[0].element);
    expect(openDetail).toHaveBeenCalledTimes(1);
    expect(detailHost.textContent).toBe('Doha détail');
    detailHost.remove();
  });

  it('conserve le cadrage demandé même si la localisation arrive ensuite', () => {
    const { rerender } = render(<BaitlyMapCanvas properties={[place]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Voir tous les lieux' }));
    map.jumpTo.mockClear();
    rerender(<BaitlyMapCanvas properties={[place]} center={[51.5, 25.3]} />);
    expect(map.jumpTo).not.toHaveBeenCalled();
  });

  it('rend sélectionnables deux missions exactement au même point, même à fort zoom', () => {
    const clicked = vi.fn();
    const second = { ...place, id: 2, name: 'Doha, seconde mission' };
    render(<BaitlyMapCanvas properties={[place, second]} center={[51.5, 25.3]} onMarkerClick={clicked} />);
    const cluster = container.querySelector('.baitly-map-cluster');
    expect(cluster).not.toBeNull();
    fireEvent.click(cluster as HTMLElement);
    const choices = container.querySelectorAll('.baitly-map-cluster-list button');
    expect(choices).toHaveLength(2);
    fireEvent.click(choices[1]);
    expect(clicked).toHaveBeenCalledWith(second);
  });
});

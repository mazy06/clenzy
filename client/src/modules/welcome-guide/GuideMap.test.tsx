import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuideMap, type GuideMapPin } from './GuideMap';
import { GUIDE_LABELS } from './guideLabels';

const state = vi.hoisted(() => ({ maps: [] as any[], markers: [] as any[] }));
vi.mock('../../components/map/createBaitlyMap', () => ({
  prefersReducedMotion: () => true,
  createBaitlyMap: vi.fn(() => {
    const map = { on: vi.fn(), off: vi.fn(), remove: vi.fn(), fitBounds: vi.fn(), jumpTo: vi.fn(), easeTo: vi.fn(), resize: vi.fn(),
      getBounds: () => ({ contains: () => false }), scrollZoom: { disable: vi.fn() } };
    state.maps.push(map);
    return map;
  }),
}));
vi.mock('maplibre-gl', () => ({
  LngLatBounds: class { points: number[][] = []; extend(point: number[]) { this.points.push(point); return this; } },
  Marker: class {
    element: HTMLElement;
    position?: number[];
    remove = vi.fn();
    constructor({ element }: { element: HTMLElement }) { this.element = element; state.markers.push(this); }
    setLngLat(position: number[]) { this.position = position; return this; }
    addTo() { return this; }
    getElement() { return this.element; }
  },
}));

beforeEach(() => { state.maps.length = 0; state.markers.length = 0; vi.stubGlobal('IntersectionObserver', undefined); });
afterEach(() => vi.unstubAllGlobals());
const pins: GuideMapPin[] = [{ id: 'home', lat: 48.885, lng: 2.373, color: '#345566', label: 'Le logement', icon: 'home' }];
const props = { center: [2.373, 48.885] as [number, number], pins, labels: GUIDE_LABELS.fr, lang: 'fr' as const };

describe('Guide map lifecycle', () => {
  it('updates coordinates and pins when switching properties without retaining old markers', () => {
    const { rerender } = render(<GuideMap {...props} />);
    const oldMarker = state.markers[0];
    rerender(<GuideMap {...props} center={[-5.8, 35.78]} pins={[{ ...pins[0], lat: 35.78, lng: -5.8 }]} />);
    expect(state.maps).toHaveLength(1);
    expect(oldMarker.remove).toHaveBeenCalledOnce();
    expect(state.markers.at(-1).position).toEqual([-5.8, 35.78]);
    expect(state.maps[0].fitBounds.mock.calls.at(-1)[0].points).toEqual([[-5.8, 35.78]]);
  });

  it('synchronizes the selected pin, camera and keyboard activation', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<GuideMap {...props} onSelect={onSelect} />);
    state.markers[0].element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith('home');
    rerender(<GuideMap {...props} onSelect={onSelect} selectedId="home" />);
    expect(state.markers[0].element).toHaveAttribute('aria-pressed', 'true');
    expect(state.maps[0].easeTo).toHaveBeenCalledWith(expect.objectContaining({ center: [2.373, 48.885], duration: 0 }));
  });

  it('keeps a retry action on tile failure and releases the old map', () => {
    const { unmount } = render(<GuideMap {...props} />);
    const map = state.maps[0];
    act(() => map.on.mock.calls.find(([event]: string[]) => event === 'error')[1]({ sourceId: 'protomaps' }));
    expect(screen.getByText(GUIDE_LABELS.fr.mapUnavailable)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(map.remove).toHaveBeenCalledOnce();
    expect(state.maps).toHaveLength(2);
    unmount();
    expect(state.maps[1].remove).toHaveBeenCalledOnce();
  });
});

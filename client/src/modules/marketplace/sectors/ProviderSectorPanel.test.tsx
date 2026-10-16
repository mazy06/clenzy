import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SectorMap } from '../../../services/api/sectorMapApi';
import ProviderSectorPanel from './ProviderSectorPanel';

vi.mock('../../../hooks/usePropertiesList', () => ({ usePropertiesList: () => ({ properties: [
  { id: '10', name: 'Loft', imageUrl: '/loft.jpg', city: 'Paris', postalCode: '75011' },
] }) }));
vi.mock('../../../services/api/providerCatalogApi', () => ({ providerCatalogApi: { getById: vi.fn().mockResolvedValue({
  id: 1, displayName: 'Paris Ménage', headline: 'Ménage entre deux séjours', verified: true,
  categoryCodes: ['CLEANING'], coverageCities: ['Paris'], offers: [{ id: 11, active: true, label: 'Ménage de départ', categoryCode: 'CLEANING', amount: 45, currency: 'EUR', pricingModel: 'FIXED' }],
}) } }));

vi.mock('../../../hooks/useThemeMode', () => ({ useThemeMode: () => ({ isDark: false }) }));
vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: unknown) => typeof fallback === 'string' ? fallback
      : (fallback as { defaultValue?: string } | undefined)?.defaultValue
        ?.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String((fallback as Record<string, unknown>)[name] ?? '')) ?? _key,
  }),
}));

const square = (lng: number, lat: number): GeoJSON.Polygon => ({
  type: 'Polygon',
  coordinates: [[[lng, lat], [lng + 0.1, lat], [lng + 0.1, lat + 0.1], [lng, lat + 0.1], [lng, lat]]],
});

const data: SectorMap = {
  providers: [
    { providerId: 1, name: 'Paris Ménage', avatarUrl: null, geometry: square(2.3, 48.8), zones: [{ key: 'k', name: 'Paris', kind: 'department', approx: false, drawn: true }], userId: null },
    { providerId: 2, name: 'Lyon Services', avatarUrl: null, geometry: square(4.8, 45.7), zones: [], userId: null },
  ],
  merged: null,
  properties: [{ id: 10, name: 'Loft', latitude: 48.85, longitude: 2.35, coveredBy: [1] }],
  attribution: '',
};

const parisBounds = { north: 49, south: 48.5, east: 2.6, west: 2.1 };

function renderPanel(onSelect = vi.fn(), onHover = vi.fn(), selectedId: number | null = null, map: SectorMap = data) {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>
    <ProviderSectorPanel data={map} isLoading={false} isError={false} bounds={parisBounds}
      mode="merged" onModeChange={vi.fn()} selectedId={selectedId} onSelect={onSelect} onHover={onHover} />
  </MemoryRouter></QueryClientProvider>);
  return { onSelect, onHover };
}

const observers: { callback: IntersectionObserverCallback; root: IntersectionObserverInit['root']; disconnected: boolean }[] = [];
beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal('IntersectionObserver', class {
    entry: typeof observers[number];
    constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
      this.entry = { callback, root: options.root, disconnected: false }; observers.push(this.entry);
    }
    observe() {}
    disconnect() { this.entry.disconnected = true; }
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const manyProviders: SectorMap = { ...data, providers: [
  ...Array.from({ length: 22 }, (_, index) => ({ ...data.providers[0], providerId: index + 100, name: `Prestataire ${String(index + 1).padStart(2, '0')}` })),
  { ...data.providers[0], providerId: 27, name: 'Salma Chraibi' },
  data.providers[1],
] };
function reachListEnd() {
  act(() => observers.at(-1)!.callback([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver));
}

describe('ProviderSectorPanel', () => {
  it('opens an anchored preview before exposing the full provider profile link', async () => {
    const { onSelect } = renderPanel();
    expect(screen.queryByRole('link', { name: 'Voir les détails' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Détails · Paris Ménage' }));
    expect(onSelect).not.toHaveBeenCalled();
    const preview = screen.getByRole('dialog', { name: 'Paris Ménage' });
    expect(within(preview).getByText('Paris')).toBeTruthy();
    expect(within(preview).getByText('Loft')).toBeTruthy();
    expect(await within(preview).findByText('Ménage de départ')).toBeTruthy();
    expect(within(preview).getByText('Zones d’intervention')).toBeTruthy();
    expect(preview.querySelector('img[src="/images/catalog/cleaning.webp"]')).toBeTruthy();
    expect(preview.querySelector('img')).toBeTruthy();
    expect(preview.className).not.toContain('bui-sidebar-flyout');
    expect(within(preview).getByRole('link', { name: 'Voir les détails' }).getAttribute('href')).toBe('/prestataires/1');
    fireEvent.click(within(preview).getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: /Paris Ménage/, pressed: false })).toBeTruthy();
  });

  it('keeps every provider of the selected area even outside the visible map bounds', () => {
    const panel = (ids: number[] | null) => <MemoryRouter><ProviderSectorPanel
      data={data} isLoading={false} isError={false} bounds={parisBounds} mode="merged"
      onModeChange={vi.fn()} selectedId={null} onSelect={vi.fn()} onHover={vi.fn()}
      areaProviderIds={ids} /></MemoryRouter>;
    const { rerender } = render(panel([1, 2]));
    expect(screen.getByText('Paris Ménage')).toBeTruthy();
    expect(screen.getByText('Lyon Services')).toBeTruthy();
    rerender(panel(null));
    expect(screen.queryByText('Lyon Services')).toBeNull();
  });
  it('lists only providers in the clicked area and restores the full list when the area filter is cleared', () => {
    const clear = vi.fn();
    const map = { ...data, providers: [data.providers[0], { ...data.providers[1], geometry: data.providers[0].geometry }] };
    const panel = (ids: number[] | null) => <MemoryRouter><ProviderSectorPanel
      data={map} isLoading={false} isError={false} bounds={parisBounds} mode="merged"
      onModeChange={vi.fn()} selectedId={2} onSelect={vi.fn()} onHover={vi.fn()}
      areaProviderIds={ids} onClearAreaFilter={clear} /></MemoryRouter>;
    const { rerender } = render(panel([1]));
    expect(screen.getByText('Paris Ménage')).toBeTruthy();
    expect(screen.queryByText('Lyon Services')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Effacer le filtre' }));
    expect(clear).toHaveBeenCalledOnce();
    rerender(panel(null));
    expect(screen.getByText('Lyon Services')).toBeTruthy();
  });
  it('whenTheMapShowsParis_thenOnlyProvidersWhoseSectorIsVisibleAreListed', () => {
    renderPanel();

    expect(screen.getByText('Paris Ménage')).toBeTruthy();
    expect(screen.queryByText('Lyon Services')).toBeNull();
    expect(screen.getByText('1 logement(s) couvert(s)')).toBeTruthy();
  });

  it('whenARowIsHoveredThenClicked_thenItsSectorIsHighlightedThenSelected', () => {
    const { onSelect, onHover } = renderPanel();
    const row = screen.getByRole('button', { name: /Paris Ménage/, pressed: false });

    fireEvent.mouseEnter(row);
    fireEvent.click(row);

    expect(onHover).toHaveBeenCalledWith(1);
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.mouseLeave(row.closest('li')!);
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it('keeps a selected provider without a visible sector in the normal list order', () => {
    const withAssignee: SectorMap = { ...data, providers: [...data.providers,
      { providerId: 3, name: 'Jean Martin', avatarUrl: null, geometry: null, zones: [], userId: 42 }] };
    renderPanel(vi.fn(), vi.fn(), 3, withAssignee);

    const rows = screen.getAllByRole('button', { pressed: true });
    expect(rows[0].textContent).toContain('Jean Martin');
    expect(screen.getByText('Aucune zone déclarée')).toBeTruthy();
    expect(screen.getAllByRole('listitem')[0].textContent).toContain('Paris Ménage');
    expect(screen.getAllByRole('listitem')[1].textContent).toContain('Jean Martin');
  });

  it('loads visible providers ten at a time and keeps Salma reachable at the end', () => {
    renderPanel(vi.fn(), vi.fn(), null, manyProviders);
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByText('23 prestataire(s) dans cette zone')).toBeTruthy();
    expect(screen.queryByText('Lyon Services')).toBeNull();
    expect(screen.queryByText('Salma Chraibi')).toBeNull();
    expect(observers.at(-1)?.root).toBe(screen.getByRole('list').parentElement);

    reachListEnd();
    expect(screen.getAllByRole('listitem')).toHaveLength(20);
    expect(screen.getByText('20 sur 23 affichés')).toBeTruthy();
    reachListEnd();
    expect(screen.getAllByRole('listitem')).toHaveLength(23);
    expect(screen.getByText('Salma Chraibi')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Afficher les/ })).toBeNull();
    expect(observers.at(-1)?.disconnected).toBe(true);
  });

  it('resets the batch and scroll position when the visible map area changes', () => {
    const props = { data: manyProviders, isLoading: false, isError: false, mode: 'merged' as const,
      onModeChange: vi.fn(), selectedId: null, onSelect: vi.fn(), onHover: vi.fn() };
    const { rerender } = render(<MemoryRouter><ProviderSectorPanel {...props} bounds={parisBounds} /></MemoryRouter>);
    reachListEnd();
    const scroll = screen.getByRole('list').parentElement!;
    scroll.scrollTop = 600;
    rerender(<MemoryRouter><ProviderSectorPanel {...props} bounds={{ west: 4, east: 5, south: 45, north: 46 }} /></MemoryRouter>);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Lyon Services')).toBeTruthy();
    expect(scroll.scrollTop).toBe(0);
    rerender(<MemoryRouter><ProviderSectorPanel {...props} bounds={parisBounds} /></MemoryRouter>);
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
  });

  it('preserves row order, loaded batches and scroll position when a later provider is clicked', () => {
    function Panel() {
      const [selectedId, onSelect] = useState<number | null>(null);
      return <ProviderSectorPanel data={manyProviders} isLoading={false} isError={false} bounds={parisBounds}
        mode="byProvider" onModeChange={vi.fn()} selectedId={selectedId} onSelect={onSelect} onHover={vi.fn()} />;
    }
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><Panel /></MemoryRouter></QueryClientProvider>);
    reachListEnd(); reachListEnd();
    const list = screen.getByRole('list');
    const order = Array.from(list.children).map(row => row.textContent);
    const scroll = list.parentElement!;
    scroll.scrollTop = 400;
    const row = within(list).getByRole('button', { name: /Salma Chraibi/, pressed: false });
    fireEvent.click(row);
    expect(Array.from(list.children).map(row => row.textContent)).toEqual(order);
    expect(list.children).toHaveLength(23);
    expect(scroll.scrollTop).toBe(400);
    expect(row.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Détails · Salma Chraibi' }));
    expect(screen.getByRole('dialog', { name: 'Salma Chraibi' })).toBeTruthy();
  });

  it('offers keyboard-accessible loading when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    renderPanel(vi.fn(), vi.fn(), null, manyProviders);
    fireEvent.click(screen.getByRole('button', { name: 'Afficher les 10 suivants' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: 'Afficher les 3 suivants' }));
    expect(screen.getByText('Salma Chraibi')).toBeTruthy();
  });
});

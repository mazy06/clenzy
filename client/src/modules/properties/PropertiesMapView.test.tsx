import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PropertiesMapView from './PropertiesMapView';
import type { PropertyListItem } from '../../hooks/usePropertiesList';

vi.mock('../../hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('../../components/MapboxPropertyMap', () => ({ MapboxPropertyMap: () => <div data-testid="map" /> }));
vi.mock('../settings/components/ChannexHealthBadge', () => ({ default: () => null }));
vi.mock('./MissingContractChip', () => ({ default: () => null }));

let intersect: IntersectionObserverCallback;
beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback; }
    observe() {} disconnect() {} unobserve() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const build = (count: number) => Array.from({ length: count }, (_, index) => ({
  id: index + 1, name: 'Logement ' + (index + 1), address: '1 rue', city: 'Tours',
  type: 'APARTMENT', status: 'ACTIVE', nightlyPrice: 0, latitude: 47, longitude: 1,
})) as unknown as PropertyListItem[];

function mount(properties: PropertyListItem[]) {
  return render(<PropertiesMapView
    mapMarkers={properties.map(p => ({ lat: 47, lng: 1, name: p.name, id: Number(p.id), type: 'property' as const }))}
    viewportProperties={properties}
    channexMappings={new Map()}
    onBoundsChange={() => {}}
    onDiagnose={() => {}}
    canManageContracts={false}
    missingContractIds={new Set()}
    onMissingContractClick={() => {}}
    navigate={vi.fn() as never}
  />);
}

describe('Liste de la vue carte des logements', () => {
  it('affiche 20 logements, puis 20 de plus en arrivant en bas', () => {
    mount(build(45));
    expect(screen.getAllByText(/^Logement /)).toHaveLength(20);

    act(() => intersect([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver));
    expect(screen.getAllByText(/^Logement /)).toHaveLength(40);

    act(() => intersect([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver));
    expect(screen.getAllByText(/^Logement /)).toHaveLength(45);
    expect(screen.queryByText('Charger les 20 suivants')).toBeNull();
  });

  it('repart du premier lot quand la zone visible change', () => {
    const { rerender } = mount(build(45));
    act(() => intersect([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver));
    expect(screen.getAllByText(/^Logement /)).toHaveLength(40);

    const narrowed = build(30);
    rerender(<PropertiesMapView
      mapMarkers={narrowed.map(p => ({ lat: 47, lng: 1, name: p.name, id: Number(p.id), type: 'property' as const }))}
      viewportProperties={narrowed}
      channexMappings={new Map()}
      onBoundsChange={() => {}}
      onDiagnose={() => {}}
      canManageContracts={false}
      missingContractIds={new Set()}
      onMissingContractClick={() => {}}
      navigate={vi.fn() as never}
    />);
    expect(screen.getAllByText(/^Logement /)).toHaveLength(20);
  });

  it('le bouton reste utilisable au clavier quand l’observateur ne se déclenche pas', () => {
    mount(build(45));
    fireEvent.click(screen.getByText('Charger les 20 suivants'));
    expect(screen.getAllByText(/^Logement /)).toHaveLength(40);
  });
});

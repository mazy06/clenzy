import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { PropertyListItem } from '../../hooks/usePropertiesList';
import PropertyMapRow from './PropertyMapRow';
import { MapRowInteractions } from './map-views/MapRowInteractions';

vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }) }));
vi.mock('../../components/Money', () => ({ Money: ({ value }: { value: number }) => <>{value} €</> }));
vi.mock('../notifications/NotificationPropertyPanel', () => ({ PropertyThumb: () => <img alt="" /> }));
vi.mock('./PropertyMapCard', () => ({ default: ({ propertyId, previewOnly }: { propertyId: number; previewOnly: boolean }) =>
  <div data-testid="preview" data-preview-only={previewOnly}><a href={`/properties/${propertyId}`}>Voir les détails</a></div> }));

function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }

describe('PropertyMapRow', () => {
  it('previews the property without navigating and closes back to the list', () => {
    const property: PropertyListItem = { id: '7', name: 'Loft Bastille', type: 'apartment', status: 'active',
      nightlyPrice: 130, guests: 2, bedrooms: 1, bathrooms: 1, city: 'Paris', address: '8 rue de Paris',
    };
    const locate = vi.fn();
    render(<MemoryRouter initialEntries={['/properties']}><Location /><MapRowInteractions.Provider value={{ locate, highlight: vi.fn(), selectedId: null, highlightedId: null }}>
      <PropertyMapRow property={property} onDiagnose={vi.fn()} showMissingContract={false} onMissingContractClick={vi.fn()} />
    </MapRowInteractions.Provider></MemoryRouter>);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Loft Bastille' }));
    expect(locate).toHaveBeenCalledWith(7);
    expect(screen.queryByRole('dialog')).toBeNull();
    locate.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Détails · Loft Bastille' }));
    expect(locate).not.toHaveBeenCalled();
    expect(screen.getByTestId('location').textContent).toBe('/properties');
    const preview = screen.getByRole('dialog', { name: 'Loft Bastille' });
    expect(within(preview).getByTestId('preview').getAttribute('data-preview-only')).toBe('true');
    expect(within(preview).getByRole('link', { name: 'Voir les détails' }).getAttribute('href')).toBe('/properties/7');
    fireEvent.click(within(preview).getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('location').textContent).toBe('/properties');
  });
});

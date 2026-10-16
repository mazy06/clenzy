import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Property } from '../../services/api/propertiesApi';
import PropertyMapPreview from './PropertyMapPreview';

vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }) }));
vi.mock('../../components/Money', () => ({ Money: ({ value }: { value: number }) => <>{value} €</> }));

const property: Property = {
  id: 7, name: 'Loft Bastille', address: '8 rue de Paris', postalCode: '75011', city: 'Paris', country: 'France',
  type: 'APARTMENT', status: 'ACTIVE', bedroomCount: 1, bathroomCount: 1, squareMeters: 42,
  nightlyPrice: 130, description: 'Un logement lumineux près de la place de la Bastille.',
  maxGuests: 2, cleaningFrequency: 'PER_STAY', ownerId: 3, ownerName: 'Samira Martin',
  photoUrls: ['/loft.webp'],
};

describe('PropertyMapPreview', () => {
  it('preserves the photo, facts, price and owner with an explicit details link', () => {
    render(<MemoryRouter><PropertyMapPreview property={property} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Loft Bastille' })).toBeTruthy();
    expect(screen.getByAltText('Loft Bastille')).toBeTruthy();
    expect(screen.getByText('75011 Paris', { exact: false })).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('130 €')).toBeTruthy();
    expect(screen.getByText('Samira Martin')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voir les détails' }).getAttribute('href')).toBe('/properties/7');
  });

  it('keeps a usable preview without photos, owner or optional positive figures', () => {
    render(<MemoryRouter><PropertyMapPreview property={{ ...property, photoUrls: [], ownerName: undefined,
      bedroomCount: 0, bathroomCount: 0, squareMeters: 0, nightlyPrice: 0 }} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Loft Bastille' })).toBeTruthy();
    expect(screen.queryByText('130 €')).toBeNull();
    expect(screen.getByRole('link', { name: 'Voir les détails' })).toBeTruthy();
  });
});

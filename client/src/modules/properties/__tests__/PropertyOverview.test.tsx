import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { PropertyDetailsData } from '../../../hooks/usePropertyDetails';

vi.mock('../../../components/PropertyImageCarousel', () => ({ PropertyImageCarousel: () => <div data-testid="carousel" /> }));
vi.mock('../../../components/MapboxPropertyMap', () => ({ MapboxPropertyMap: () => <div data-testid="map" /> }));
vi.mock('../../../components/Money', () => ({ Money: ({ value }: { value: number }) => <>{value} €</> }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { organizationId: 3 } }) }));
vi.mock('../../settings/amenity-mapping/useAmenityIconOverrides', () => ({ useAmenityIconOverrides: () => ({ overrides: {} }) }));

import PropertyOverview from '../overview/PropertyOverview';

const duplex: PropertyDetailsData = {
  id: '12', name: 'Duplex Hivernage', address: '8 rue du Temple, Hivernage', city: 'Marrakech', postalCode: '40000', country: 'Maroc',
  propertyType: 'DUPLEX', status: 'ACTIVE', nightlyPrice: 140, bedrooms: 1, bathrooms: 1, surfaceArea: 120,
  description: 'Duplex contemporain dans un riad rénové.', amenities: ['WIFI', 'POOL'], cleaningFrequency: 'AFTER_EACH_STAY',
  maxGuests: 6, contactPhone: '', contactEmail: '', ownerName: 'Admin User', defaultCheckInTime: '16:00:00', defaultCheckOutTime: '11:00:00',
  cleaningBasePrice: 80, cleaningDurationMinutes: 220, numberOfFloors: 2, hasExterior: true, hasLaundry: true,
  latitude: 31.62, longitude: -8.01,
};

afterEach(cleanup);

describe("Fiche logement, vue d'ensemble", () => {
  it('whenShowingAProperty_thenItsIdentityAndKeyFiguresLeadThePage', () => {
    render(<PropertyOverview property={duplex} photoUrls={[]} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Duplex Hivernage' })).toBeVisible();
    expect(screen.getByText('120 m²')).toBeVisible();
    expect(screen.getByText('8 rue du Temple, Hivernage, 40000 Marrakech, Maroc')).toBeVisible();
    expect(screen.getByText('140 €')).toBeVisible();
  });

  it('whenTheMapIconIsChosen_thenTheMapAndLocationReplaceThePhotosUntilThePhotoIconIsChosen', () => {
    render(<PropertyOverview property={duplex} photoUrls={[]} />);
    const photos = screen.getByRole('button', { name: 'Voir les photos' });
    const map = screen.getByRole('button', { name: 'Voir sur la carte' });
    expect(photos).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('carousel')).toBeInTheDocument();

    fireEvent.click(map);

    expect(map).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('map')).toBeInTheDocument();
    expect(screen.queryByTestId('carousel')).not.toBeInTheDocument();
    expect(screen.getByText('31.62000, -8.01000')).toBeVisible();
    expect(screen.getByRole('link', { name: /Ouvrir dans Google Maps/ }))
      .toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=31.62,-8.01');

    fireEvent.click(photos);

    expect(screen.getByTestId('carousel')).toBeInTheDocument();
    expect(screen.getByText('120 m²')).toBeVisible();
  });

  it('whenThePropertyIsNotGeolocated_thenNoMapToggleIsOffered', () => {
    render(<PropertyOverview property={{ ...duplex, latitude: undefined, longitude: undefined }} photoUrls={[]} />);
    expect(screen.queryByRole('button', { name: 'Voir sur la carte' })).not.toBeInTheDocument();
  });

  it('whenListingAmenities_thenTheyAreGroupedByFamilyEachWithItsLibraryIcon', () => {
    render(<PropertyOverview property={{ ...duplex, amenities: ['POOL', 'WIFI'] }} photoUrls={[]} />);
    const amenities = screen.getByRole('heading', { name: 'Équipements' }).closest('section')!;
    const items = within(amenities).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['WiFi', 'Piscine']);
    items.forEach((item) => expect(item.querySelector('svg')).not.toBeNull());
  });

  it('whenTheCleaningIsConfigured_thenTheEstimateDurationAndServicesAreListed', () => {
    render(<PropertyOverview property={duplex} photoUrls={[]} />);
    const cleaning = screen.getByRole('heading', { name: 'Ménage' }).closest('section')!;
    expect(within(cleaning).getByText('115 €')).toBeVisible();
    expect(within(cleaning).getByText('3h40')).toBeVisible();
    expect(within(cleaning).getByText('Linge fourni')).toBeVisible();
  });

  it('whenAddOnServicesAreBooked_thenEachShowsItsIconAndTheWindowsKeepTheirDetail', () => {
    render(<PropertyOverview property={{ ...duplex, windowCount: 9, frenchDoorCount: 3, hasDisinfection: true }} photoUrls={[]} />);
    const cleaning = screen.getByRole('heading', { name: 'Ménage' }).closest('section')!;
    const services = within(cleaning).getAllByRole('listitem');
    expect(services.map((service) => service.querySelector('[dir="auto"]')!.textContent))
      .toEqual(['Terrasse / Jardin', 'Linge fourni', 'Vitres', 'Désinfection']);
    expect(within(cleaning).getByText('9 fen., 3 p-fen.')).toBeVisible();
    services.forEach((service) => expect(service.querySelector('svg')).not.toBeNull());
  });

  it('whenArrivalInstructionsAreMissing_thenTheAccessSectionInvitesToAddThem', () => {
    const editAccess = vi.fn();
    render(<PropertyOverview property={duplex} photoUrls={[]} onEditAccess={editAccess} />);
    const access = screen.getByRole('heading', { name: 'Accueil des voyageurs' }).closest('section')!;
    expect(within(access).getByText('16:00')).toBeVisible();
    expect(within(access).getByText(/Aucune instruction d'arrivée/)).toBeVisible();
    fireEvent.click(within(access).getByRole('button', { name: 'Modifier' }));
    expect(editAccess).toHaveBeenCalled();
  });

  it('whenTheUserCannotEdit_thenNoEditShortcutIsOffered', () => {
    render(<PropertyOverview property={duplex} photoUrls={[]} />);
    const access = screen.getByRole('heading', { name: 'Accueil des voyageurs' }).closest('section')!;
    expect(within(access).queryByRole('button')).not.toBeInTheDocument();
  });
});

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { Reservation } from '../../services/api/reservationsApi';

const hooks = vi.hoisted(() => ({
  setFilter: vi.fn(),
  cancelReservation: vi.fn(async () => undefined),
  getById: vi.fn(),
  reservations: [] as Reservation[],
}));

vi.mock('../../hooks/useReservations', () => ({
  reservationsKeys: { all: ['reservations'] },
  useReservations: () => ({
    reservations: hooks.reservations,
    totalElements: hooks.reservations.length,
    isLoading: false,
    isError: false,
    error: null,
    filters: { propertyId: null, status: null, source: null, from: '', to: '' },
    setFilter: hooks.setFilter,
    cancelReservation: hooks.cancelReservation,
    isCancelling: false,
  }),
}));
vi.mock('../../hooks/usePropertiesList', () => ({
  usePropertiesList: () => ({
    properties: [{ id: '7', name: 'Appartement Médina', address: '12 rue des Oliviers', postalCode: '40000', city: 'Marrakech', guests: 4, bedrooms: 2 }],
  }),
}));
vi.mock('../../services/api/reservationsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/api/reservationsApi')>()),
  reservationsApi: { getById: hooks.getById },
}));
vi.mock('../../hooks/useDynamicPageSize', () => ({ useDynamicPageSize: () => ({ containerRef: { current: null }, pageSize: 10 }) }));
vi.mock('../../components/ScreenChrome', () => ({ useScreenSearch: () => {} }));
vi.mock('../../components/Money', () => ({ Money: ({ value }: { value: number }) => <>{value.toFixed(2)} €</> }));
vi.mock('../../components/PageHeader', () => ({
  default: ({ title, actions }: { title: string; actions?: React.ReactNode }) => <header><h1>{title}</h1>{actions}</header>,
}));
vi.mock('../../components/first-use/ModuleFirstUsePage', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../components/reservations/ReservationDialog', () => ({
  default: ({ open, mode, reservation }: { open: boolean; mode: string; reservation?: Reservation | null }) =>
    open ? <div role="dialog" aria-label={`dialog-${mode}`}>{reservation?.guestName}</div> : null,
}));
vi.mock('../channels/GuestProfileDialog', () => ({
  default: ({ guestId, open }: { guestId: number | null; open: boolean }) => (open ? <div data-testid="guest-profile">{guestId}</div> : null),
}));

import ReservationsPage from './ReservationsList';

function reservation(overrides: Partial<Reservation>): Reservation {
  return {
    id: 17,
    propertyId: 7,
    propertyName: 'Appartement Médina',
    guestName: 'Inès Haddad',
    guestEmail: 'ines@example.com',
    guestCount: 2,
    checkIn: '2026-06-24',
    checkOut: '2026-07-10',
    checkInTime: '15:00',
    checkOutTime: '11:00',
    status: 'confirmed',
    source: 'airbnb',
    collectedByChannel: true,
    totalPrice: 1920,
    ...overrides,
  };
}

function renderPage(path = '/reservations') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ReservationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  hooks.reservations = [
    reservation({ id: 17, guestId: 301 }),
    reservation({ id: 18, guestName: 'Paul Martin', guestId: null, source: 'direct', collectedByChannel: false, status: 'pending' }),
  ];
  hooks.getById.mockReset();
  hooks.setFilter.mockReset();
  hooks.cancelReservation.mockClear();
});
afterEach(cleanup);

describe('Réservations, liste et détail', () => {
  it('whenARowIsSelected_thenItsStayGuestPropertyAndPaymentShowInTheDetail', () => {
    renderPage();
    const detail = screen.getByRole('region', { name: 'Détail de la réservation' });
    expect(within(detail).getByRole('heading', { name: 'Choisissez une réservation' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /Inès Haddad/ }));

    expect(within(detail).getByRole('heading', { level: 2, name: 'Inès Haddad' })).toBeVisible();
    expect(within(detail).getByText('à partir de 15:00')).toBeVisible();
    expect(within(detail).getByText('16 nuits')).toBeVisible();
    expect(within(detail).getByText('12 rue des Oliviers, 40000 Marrakech')).toBeVisible();
    expect(within(detail).getByText('Par Airbnb')).toBeVisible();
    expect(screen.getByRole('button', { name: /Inès Haddad/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('whenOpeningTheGuestProfile_thenItUsesTheGuestIdNotTheReservationId', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Inès Haddad/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Profil' }));
    expect(screen.getByTestId('guest-profile')).toHaveTextContent('301');

    fireEvent.click(screen.getByRole('button', { name: /Paul Martin/ }));
    expect(screen.queryByRole('button', { name: 'Profil' })).not.toBeInTheDocument();
  });

  it('whenADeepLinkTargetsAReservationOutsideThePage_thenItIsLoadedById', async () => {
    hooks.getById.mockResolvedValue(reservation({ id: 99, guestName: 'Lina Benali' }));
    renderPage('/reservations?highlight=99');

    const detail = screen.getByRole('region', { name: 'Détail de la réservation' });
    expect(await within(detail).findByRole('heading', { level: 2, name: 'Lina Benali' })).toBeVisible();
    expect(hooks.getById).toHaveBeenCalledWith(99);
  });

  it('whenCancellingFromTheDetail_thenTheConfirmedReservationIsCancelled', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Inès Haddad/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler la réservation' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Oui, annuler' }));
    await waitFor(() => expect(hooks.cancelReservation).toHaveBeenCalledWith(17));
  });

  it('whenAStatusChipIsChosen_thenTheListIsFilteredOnThatStatus', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmée' }));
    expect(hooks.setFilter).toHaveBeenCalledWith('status', 'confirmed');
  });

  it('whenTheSelectedReservationIsCancelled_thenTheDetailCarriesTheCancelledTint', () => {
    hooks.reservations = [...hooks.reservations, reservation({ id: 19, guestName: 'Sami Ouali', status: 'cancelled' })];
    renderPage();
    const detail = screen.getByRole('region', { name: 'Détail de la réservation' });

    fireEvent.click(screen.getByRole('button', { name: /Inès Haddad/ }));
    expect(detail).toHaveAttribute('data-status', 'confirmed');

    fireEvent.click(screen.getByRole('button', { name: /Sami Ouali/ }));
    expect(detail).toHaveAttribute('data-status', 'cancelled');
    expect(within(detail).queryByRole('button', { name: 'Annuler la réservation' })).not.toBeInTheDocument();
  });

  it('whenEditing_thenTheEditDialogOpensOnTheSelectedReservation', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Inès Haddad/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    expect(screen.getByRole('dialog', { name: 'dialog-edit' })).toHaveTextContent('Inès Haddad');
  });
});

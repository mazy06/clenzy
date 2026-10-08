import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodayOperationsView } from '../TodayOperationsView';
import type { DashboardOperations } from '../../../services/api/dashboardOperationsApi';

vi.mock('../../../components/baitly/Money', () => ({ Money: ({ value }: { value: number }) => <span>{value} €</span> }));
vi.mock('../../../components/baitly/GuestAvatar', () => ({ default: () => <span aria-hidden="true">SF</span> }));
afterEach(cleanup);

const arrivals: DashboardOperations['arrivals'] = Array.from({ length: 5 }, (_, index) => ({
  reservationId: index + 1, guestName: `Voyageur ${index + 1}`, propertyId: 1, propertyName: 'Maison Plumereau',
  checkInTime: '16:00', source: 'airbnb', sourceName: null, note: null, guestCount: 2,
}));
const departure: DashboardOperations['departures'][number] = {
  reservationId: 11, guestName: 'Emma Fontaine', propertyId: 2, propertyName: 'Loft Bastille',
  checkOutTime: '11:00', securityDepositId: 27, depositToRelease: 350,
};
const cleaning: DashboardOperations['cleanings'][number] = {
  interventionId: 30, propertyId: 2, propertyName: 'Loft Bastille', assigneeName: 'Nadia Martin',
  windowStart: '11:00', windowEnd: '14:00', status: 'COMPLETED',
};
const data: DashboardOperations = { arrivals, departures: [departure], cleanings: [cleaning] };
const handlers = () => ({onOpenReservation: vi.fn(), onOpenCleaning: vi.fn(), onOpenDeposits: vi.fn()});

describe('Daily operations queue', () => {
  it('opens the first populated section and reveals more rows from the fixed footer', () => {
    const { container } = render(<TodayOperationsView data={data} {...handlers()} />);
    expect(screen.getByRole('heading', { name: 'Opérations du jour 7' })).toBeVisible();
    expect(screen.getByText('Voyageur 3')).toBeVisible();
    expect(screen.queryByText('Voyageur 4')).not.toBeInTheDocument();
    const more = screen.getByRole('button', { name: 'Voir les 2 autres arrivées' });
    expect(container.querySelector('.db-queue__footer')).toContainElement(more);
    expect(container.querySelector('.db-widget-body')).not.toContainElement(more);
    expect(document.getElementById(more.getAttribute('aria-controls')!)).toHaveAttribute('role', 'region');
    fireEvent.click(more);
    expect(screen.getByText('Voyageur 5')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Réduire' }));
    expect(screen.queryByText('Voyageur 4')).not.toBeInTheDocument();
  });

  it('opens only one section, resets its preview and does not execute an action while toggling', () => {
    const callbacks = handlers();
    render(<TodayOperationsView data={data} {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Voir les 2 autres arrivées' }));
    const departures = screen.getByRole('button', { name: /Départs aujourd’hui/ });
    fireEvent.click(departures);
    expect(screen.queryByText('Voyageur 1')).not.toBeInTheDocument();
    expect(screen.getByText('Emma Fontaine')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Réduire' })).not.toBeInTheDocument();
    expect(callbacks.onOpenReservation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Arrivées aujourd’hui/ }));
    expect(screen.queryByText('Voyageur 4')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Arrivées aujourd’hui/ }));
    expect(screen.queryByText('Voyageur 1')).not.toBeInTheDocument();
  });

  it('preserves reservation, mission and deposit actions without nesting buttons', () => {
    const callbacks = handlers();
    const { container } = render(<TodayOperationsView data={data} {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: /Voyageur 1.*Voir le séjour/ }));
    expect(callbacks.onOpenReservation).toHaveBeenCalledWith(arrivals[0]);
    fireEvent.click(screen.getByRole('button', { name: /Départs aujourd’hui/ }));
    expect(screen.getByText('350 €')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Emma Fontaine.*Voir le séjour/ }));
    expect(callbacks.onOpenReservation).toHaveBeenLastCalledWith(departure);
    fireEvent.click(screen.getByRole('button', { name: 'Voir les cautions' }));
    expect(callbacks.onOpenDeposits).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /Ménages du jour/ }));
    const mission = screen.getByRole('button', { name: /Nadia Martin.*Voir la mission/ });
    expect(within(mission).queryByText('Planifié')).not.toBeInTheDocument();
    fireEvent.click(mission);
    expect(callbacks.onOpenCleaning).toHaveBeenCalledWith(30);
    expect(container.querySelector('button button')).toBeNull();
  });

  it('shows honest empty states and opens departures if there are no arrivals', () => {
    const { rerender } = render(<TodayOperationsView data={{arrivals: [], departures: [departure], cleanings: []}} {...handlers()} />);
    expect(screen.getByRole('button', { name: /Arrivées aujourd’hui/ })).toBeDisabled();
    expect(screen.getByText('Aucune arrivée aujourd’hui.')).toBeVisible();
    expect(screen.getByText('Emma Fontaine')).toBeVisible();
    rerender(<TodayOperationsView data={{arrivals: [], departures: [], cleanings: []}} {...handlers()} />);
    expect(screen.getByRole('heading', { name: 'Opérations du jour 0' })).toBeVisible();
    expect(screen.getByText('Aucun ménage planifié aujourd’hui.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Voir les cautions' })).not.toBeInTheDocument();
  });

  it('does not carry the expanded arrival list into departures after a data refresh', () => {
    const departures = Array.from({ length: 5 }, (_, index) => ({ ...departure, reservationId: 20 + index, guestName: `Départ ${index + 1}` }));
    const { rerender } = render(<TodayOperationsView data={{...data, departures}} {...handlers()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Voir les 2 autres arrivées' }));
    rerender(<TodayOperationsView data={{...data, arrivals: [], departures}} {...handlers()} />);
    expect(screen.getByText('Départ 3')).toBeVisible();
    expect(screen.queryByText('Départ 4')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voir les 2 autres départs' })).toHaveAttribute('aria-expanded', 'false');
  });
});

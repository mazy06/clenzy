import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpcomingArrivalsView } from '../UpcomingArrivalsView';
import type { DashboardUpcomingArrival } from '../../../services/api/dashboardOperationsApi';

vi.mock('../../../components/baitly/Money', () => ({ Money: ({ value }: { value: number | null }) => <span>{value == null ? '—' : `${value} €`}</span> }));
afterEach(cleanup);
const arrival: DashboardUpcomingArrival = { reservationId: 12, guestName: 'Laura Tazi', propertyId: 2, propertyName: 'Loft Bastille', checkIn: '2026-10-05', nights: 2, source: 'booking', sourceName: 'Booking.com', paymentStatus: 'PAID', totalPrice: 395, amountDue: 120 };
const photos = new Map([[2, '/images/loft.jpg']]);

describe('Upcoming arrivals', () => {
  it('keeps unpaid balances visible even if the raw status says paid, on both layouts', () => {
    const onOpen = vi.fn();
    const {container} = render(<MemoryRouter><UpcomingArrivalsView rows={[arrival]} days={7} photos={photos} onOpen={onOpen} /></MemoryRouter>);
    expect(screen.getAllByText('Solde dû')).toHaveLength(2);
    expect(screen.queryByText('Payée')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Laura Tazi', exact: true }));
    expect(onOpen).toHaveBeenCalledWith(arrival);
    const mobile = container.querySelector('.db-upcoming-mobile-row') as HTMLElement;
    expect(within(mobile).getByRole('img', { name: 'Booking.com' })).toBeInTheDocument();
    fireEvent.click(mobile);
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(container.querySelector('button button')).toBeNull();
    expect(screen.getByRole('link', { name: 'Tout le planning' })).toHaveAttribute('href', '/planning');
  });

  it('renders the full arrival list and keeps a missing amount unknown', () => {
    const rows = Array.from({length:12},(_,index)=>({...arrival,reservationId:index,guestName:`Voyageur ${index}`,totalPrice:null,amountDue:null}));
    render(<MemoryRouter><UpcomingArrivalsView rows={rows} days={7} photos={photos} onOpen={vi.fn()} /></MemoryRouter>);
    expect(screen.getAllByText('Voyageur 11')).toHaveLength(2);
    expect(screen.queryByText('0 €')).toBeNull();
  });

  it('shows a photo fallback and an empty state without inventing reservations', () => {
    const { container, rerender } = render(<MemoryRouter><UpcomingArrivalsView rows={[arrival]} days={7} photos={photos} onOpen={vi.fn()} /></MemoryRouter>);
    const image = container.querySelector('.bui-property-thumbnail img')!;
    fireEvent.error(image);
    expect(container.querySelector('.bui-property-thumbnail')).toHaveTextContent('LB');
    rerender(<MemoryRouter><UpcomingArrivalsView rows={[]} days={7} photos={photos} onOpen={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText('Aucune arrivée sur la période.')).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import ServiceMapRowView from '../ServiceMapRowView';
import { MapLinkedRow, MapRowInteractions } from '../../modules/properties/map-views/MapRowInteractions';
import ReservationMapRow from '../../modules/properties/map-views/ReservationMapRow';
import IssueMapRow from '../../modules/properties/map-views/IssueMapRow';
import type { Reservation } from '../../services/api/reservationsApi';
import type { Issue } from '../../services/api/issuesApi';

vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string, fallback?: string | { defaultValue: string }) => typeof fallback === 'object' ? fallback.defaultValue : fallback ?? key }) }));
function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }

it('focuses the property from the service row and opens its preview only from the chevron', () => {
  const locate = vi.fn();
  render(<MemoryRouter initialEntries={['/properties']}><Location />
    <MapRowInteractions.Provider value={{ locate, highlight: vi.fn(), selectedId: null, highlightedId: null }}>
      <MapLinkedRow propertyId={7} showLocate={false}>
        <ServiceMapRowView title="Ménage de départ" serviceLabel="Ménage" propertyName="Loft"
          propertyAddress="Paris" propertyThumb={null} assigneeLabel="Intervenant" assigneeAvatars={null}
          assigneeName="Claire" schedule="Demain" badges={null} to="/interventions/12" />
      </MapLinkedRow>
    </MapRowInteractions.Provider>
  </MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Ménage de départ · Ménage · Loft' }));
  expect(locate).toHaveBeenCalledWith(7);
  expect(screen.queryByRole('dialog')).toBeNull();
  locate.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Localiser sur la carte' }));
  expect(locate).toHaveBeenCalledOnce();
  expect(locate).toHaveBeenCalledWith(7);
  locate.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Détails · Ménage de départ' }));
  expect(locate).not.toHaveBeenCalled();
  expect(screen.getByTestId('location').textContent).toBe('/properties');
  const preview = screen.getByRole('dialog', { name: 'Ménage de départ' });
  fireEvent.click(within(preview).getByRole('link', { name: 'Voir les détails' }));
  expect(screen.getByTestId('location').textContent).toBe('/interventions/12');
});

it('keeps reservation preview and issue detail separate from map focus', () => {
  const locate = vi.fn();
  const openIssue = vi.fn();
  const reservation: Reservation = { id: 12, propertyId: 7, guestCount: 2, totalPrice: 260, guestName: 'Marc', propertyName: 'Loft', checkIn: '2026-10-20', checkOut: '2026-10-22', source: 'direct', status: 'confirmed' };
  const issue = { id: 4, title: 'Fuite', propertyName: 'Loft', severity: 'HIGH', status: 'OPEN', createdAt: '2026-10-16T12:00:00Z' } as Issue;
  render(<MemoryRouter><MapRowInteractions.Provider value={{ locate, highlight: vi.fn(), selectedId: null, highlightedId: null }}>
    <MapLinkedRow propertyId={7}><ReservationMapRow reservation={reservation} /></MapLinkedRow>
    <MapLinkedRow propertyId={7}><IssueMapRow issue={issue} onOpen={openIssue} /></MapLinkedRow>
  </MapRowInteractions.Provider></MemoryRouter>);
  fireEvent.click(screen.getByText('Marc').closest('button')!);
  fireEvent.click(screen.getByText('Fuite').closest('button')!);
  expect(locate).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(openIssue).not.toHaveBeenCalled();
  locate.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Détails · Marc' }));
  expect(within(screen.getByRole('dialog', { name: 'Marc' })).getByRole('link', { name: 'Voir les détails' }).getAttribute('href')).toBe('/reservations?highlight=12');
  fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Détails · Fuite' }));
  expect(openIssue).toHaveBeenCalledWith(issue);
  expect(locate).not.toHaveBeenCalled();
});

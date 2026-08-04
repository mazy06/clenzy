import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import ReservationLifecycle, { buildSteps } from '../PlanningActionPanel/ReservationLifecycle';
import type { PlanningEvent } from '../types';

type Reservation = NonNullable<PlanningEvent['reservation']>;

const makeReservation = (overrides: Partial<Reservation> = {}): Reservation =>
  ({
    id: 1,
    guestName: 'Jean Dupont',
    propertyName: 'Studio Centre',
    propertyId: 10,
    checkIn: '2025-06-01',
    checkOut: '2025-06-05',
    checkInTime: '15:00',
    status: 'confirmed',
    source: 'airbnb',
    totalPrice: 400,
    guestCount: 2,
    ...overrides,
  }) as Reservation;

// ─── buildSteps : dérivation des jalons ──────────────────────────────────────

describe('buildSteps', () => {
  it('whenStatusPending_thenConfirmationNotDone', () => {
    const steps = buildSteps(makeReservation({ status: 'pending' }));

    expect(steps[0]).toMatchObject({ label: 'Confirmée', done: false });
  });

  it('whenPaymentStatusPaid_thenPaymentDone', () => {
    const steps = buildSteps(makeReservation({ paymentStatus: 'PAID', paidAt: '2025-05-03T10:00:00Z' }));

    expect(steps[1]).toMatchObject({ label: 'Paiement', done: true, detail: '3 mai' });
  });

  it('whenCollectedByChannel_thenPaymentDoneViaChannel', () => {
    const steps = buildSteps(makeReservation({ collectedByChannel: true }));

    expect(steps[1]).toMatchObject({ done: true, detail: 'via le canal' });
  });

  it('whenPaymentMissing_thenPaymentAwaited', () => {
    const steps = buildSteps(makeReservation());

    expect(steps[1]).toMatchObject({ done: false, detail: 'en attente' });
  });

  it('whenCheckInDatePastWithoutCheckedInStatus_thenArrivalNotDone', () => {
    // Le jalon Arrivée ne se déduit jamais du seul calendrier.
    const steps = buildSteps(makeReservation({ checkIn: '2020-01-01' }));

    expect(steps[2]).toMatchObject({ label: 'Arrivée', done: false, detail: '1 janv., 15:00' });
  });

  it('whenStatusCheckedIn_thenArrivalDoneButNotDeparture', () => {
    const steps = buildSteps(makeReservation({ status: 'checked_in' }));

    expect(steps[2].done).toBe(true);
    expect(steps[3]).toMatchObject({ label: 'Départ', done: false });
  });

  it('whenStatusCheckedOut_thenAllStayMilestonesDone', () => {
    const steps = buildSteps(makeReservation({ status: 'checked_out' }));

    expect(steps[2].done).toBe(true);
    expect(steps[3].done).toBe(true);
  });
});

// ─── Rendu ───────────────────────────────────────────────────────────────────

describe('ReservationLifecycle', () => {
  it('whenRendered_thenShowsAllMilestoneLabels', () => {
    render(<ReservationLifecycle reservation={makeReservation()} />);

    expect(screen.getByText('Confirmée')).toBeInTheDocument();
    expect(screen.getByText('Paiement')).toBeInTheDocument();
    expect(screen.getByText('Arrivée')).toBeInTheDocument();
    expect(screen.getByText('Départ')).toBeInTheDocument();
  });

  it('whenCancelled_thenRendersNothing', () => {
    const { container } = render(
      <ReservationLifecycle reservation={makeReservation({ status: 'cancelled' })} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';

// ─── Mock @dnd-kit ──────────────────────────────────────────────────────────

vi.mock('@dnd-kit/core', () => ({
  useDraggable: vi.fn(() => ({
    attributes: { role: 'button', tabIndex: 0 },
    listeners: { onPointerDown: vi.fn() },
    setNodeRef: vi.fn(),
    isDragging: false,
  })),
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { roles: ['SUPER_ADMIN'], orgRole: 'ADMIN' },
  }),
}));

// useCurrency depend de CurrencyProvider + react-query. Stub deterministe
// pour eviter de monter tout le provider stack dans un test unitaire.
vi.mock('../../../hooks/useCurrency', () => ({
  useCurrency: () => ({
    currency: 'EUR',
    setCurrency: vi.fn(),
    currencySymbol: '€',
    currencyLabel: 'EUR (€)',
    convertAndFormat: (amount: number | null | undefined) =>
      amount == null ? '—' : `${amount.toFixed(2)} €`,
    convert: (amount: number) => amount,
    isConverting: false,
    rateDate: null,
    rates: null,
    ratesLoading: false,
  }),
}));

import PlanningRow from '../PlanningRow';
import type { BarLayout, PlanningEvent, PlanningProperty, PlanningDragState } from '../types';
import type { PricingMap } from '../hooks/usePlanningPricing';
import type { Reservation, PlanningIntervention } from '../../../services/api';
import type { PlanningServiceRequest } from '../../../services/api/serviceRequestsApi';

// ─── Test fixtures ──────────────────────────────────────────────────────────

const theme = createTheme();

const testDays = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(2026, 2, 1 + i); // March 1-7, 2026
  return d;
});

const testProperty: PlanningProperty = {
  id: 1,
  name: 'Villa Test',
  address: '123 Rue Test',
  city: 'Paris',
  maxGuests: 4,
  nightlyPrice: 120,
  minimumNights: 1,
  defaultCheckInTime: '15:00',
  defaultCheckOutTime: '11:00',
};

const reservationEvent: PlanningEvent = {
  id: 'res-1',
  type: 'reservation',
  propertyId: 1,
  startDate: '2026-03-02',
  endDate: '2026-03-04',
  label: 'John Doe',
  status: 'confirmed',
  color: '#4CAF50',
};

const barLayout: BarLayout = {
  event: reservationEvent,
  left: 80, // 1 day * 80px (week zoom)
  width: 160, // 2 days * 80px
  top: 4,
  height: 34,
  layer: 'primary',
};

const initialDragState: PlanningDragState = {
  activeId: null,
  activeType: null,
  dragConflict: false,
  ghostLayout: null,
  isDragging: false,
};

const emptyPricingMap: PricingMap = new Map();

let mockOnEmptyClick: ReturnType<typeof vi.fn>;
let mockOnEventClick: ReturnType<typeof vi.fn>;

function renderRow(overrides?: Partial<React.ComponentProps<typeof PlanningRow>>) {
  return render(
    <ThemeProvider theme={theme}>
      <PlanningRow
        property={testProperty}
        barLayouts={[barLayout]}
        days={testDays}
        dayWidth={80}
        density="normal"
        zoom="fortnight"
        totalGridWidth={560}
        rowIndex={0}
        selectedEventId={null}
        conflictEventIds={new Set()}
        isDragging={false}
        dragState={initialDragState}
        onEventClick={mockOnEventClick}
        onEmptyClick={mockOnEmptyClick}
        quickCreateOpen={false}
        showPrices={false}
        showInterventions={true}
        pricingMap={emptyPricingMap}
        effectiveRowHeight={68}
        allEvents={[reservationEvent]}
        loadedReservations={[]}
        {...overrides}
      />
    </ThemeProvider>,
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PlanningRow', () => {
  beforeEach(() => {
    mockOnEmptyClick = vi.fn();
    mockOnEventClick = vi.fn();
  });

  describe('Range selection (empty space clicks)', () => {
    it('triggers onEmptyClick when clicking on empty space (not on a bar)', () => {
      const { container } = renderRow();
      const rowElement = container.firstChild as HTMLElement;

      // Click on empty area (day 0 = x offset 40, y = 20 — in the grid area)
      fireEvent.mouseDown(rowElement, {
        clientX: 40,
        clientY: 20,
        button: 0,
      });
      fireEvent.mouseUp(document);

      // onEmptyClick should have been called (single click = minimumNights selection)
      expect(mockOnEmptyClick).toHaveBeenCalled();
    });

    it('does NOT trigger onEmptyClick when clicking on a bar element', () => {
      const { container } = renderRow();
      const barElement = container.querySelector('[data-planning-bar]') as HTMLElement;

      // Click directly on the bar
      fireEvent.mouseDown(barElement, { button: 0 });
      fireEvent.mouseUp(document);

      // onEmptyClick should NOT be called — the bar should handle its own events
      expect(mockOnEmptyClick).not.toHaveBeenCalled();
    });

    it('does NOT trigger range selection when isDragging is true', () => {
      const { container } = renderRow({ isDragging: true });
      const rowElement = container.firstChild as HTMLElement;

      fireEvent.mouseDown(rowElement, {
        clientX: 40,
        clientY: 20,
        button: 0,
      });
      fireEvent.mouseUp(document);

      expect(mockOnEmptyClick).not.toHaveBeenCalled();
    });

    it('ignores right-click (button !== 0)', () => {
      const { container } = renderRow();
      const rowElement = container.firstChild as HTMLElement;

      fireEvent.mouseDown(rowElement, {
        clientX: 40,
        clientY: 20,
        button: 2, // Right click
      });
      fireEvent.mouseUp(document);

      expect(mockOnEmptyClick).not.toHaveBeenCalled();
    });
  });

  describe('Bar rendering', () => {
    it('renders PlanningBar with data-planning-bar attribute', () => {
      const { container } = renderRow();
      const bars = container.querySelectorAll('[data-planning-bar]');
      expect(bars.length).toBe(1);
    });

    it('renders bars inside the row with absolute positioning', () => {
      const { container } = renderRow();
      const bar = container.querySelector('[data-planning-bar]') as HTMLElement;
      expect(window.getComputedStyle(bar).position).toBe('absolute');
    });
  });

  describe('Blocked range rendering', () => {
    const blockedEvent: PlanningEvent = {
      id: 'block-1',
      type: 'blocked',
      propertyId: 1,
      startDate: '2026-03-02',
      endDate: '2026-03-05',
      label: 'Bloqué',
      sublabel: 'ICAL:50',
      status: 'blocked',
      color: '#9aa',
    };
    const blockedLayout: BarLayout = {
      event: blockedEvent,
      left: 80,
      width: 240,
      top: 4,
      height: 34,
      layer: 'primary',
    };

    it('renders a greyed band (data-blocked-range), not an event bar', () => {
      const { container } = renderRow({ barLayouts: [blockedLayout], allEvents: [blockedEvent] });
      expect(container.querySelector('[data-blocked-range]')).not.toBeNull();
      // Un blocage n'est jamais rendu comme brique d'événement.
      expect(container.querySelector('[data-planning-bar]')).toBeNull();
    });

    it('does NOT trigger range selection when clicking the blocked band', () => {
      const { container } = renderRow({ barLayouts: [blockedLayout], allEvents: [blockedEvent] });
      const band = container.querySelector('[data-blocked-range]') as HTMLElement;

      fireEvent.mouseDown(band, { button: 0 });
      fireEvent.mouseUp(document);

      expect(mockOnEmptyClick).not.toHaveBeenCalled();
    });

    it('shows an explanatory tooltip on click', async () => {
      const { container } = renderRow({ barLayouts: [blockedLayout], allEvents: [blockedEvent] });
      const band = container.querySelector('[data-blocked-range]') as HTMLElement;

      fireEvent.click(band);

      expect(await screen.findByText('Période bloquée')).toBeInTheDocument();
    });
  });

  describe('Rattachement des interventions (heuristique jour de checkout)', () => {
    // Réservation « Gérard Mazy » : 4 nuits, checkout le 2026-03-05.
    const hostReservation: Reservation = {
      id: 42,
      propertyId: 1,
      propertyName: 'Villa Test',
      guestName: 'Gérard Mazy',
      guestCount: 2,
      checkIn: '2026-03-01',
      checkOut: '2026-03-05',
      status: 'confirmed',
      source: 'direct',
      totalPrice: 480,
    };

    const hostEvent: PlanningEvent = {
      id: 'res-42',
      type: 'reservation',
      propertyId: 1,
      startDate: '2026-03-01',
      endDate: '2026-03-05',
      label: 'Gérard Mazy',
      status: 'confirmed',
      color: '#4CAF50',
      reservation: hostReservation,
    };

    const hostLayout: BarLayout = {
      event: hostEvent,
      left: 0,
      width: 320,
      top: 4,
      height: 34,
      layer: 'primary',
    };

    // Ménage post-départ planifié le JOUR du checkout (12h-15h, après le
    // départ 11h) — SANS linkedReservationId : cas réel des données dev où le
    // backend ne renseigne le lien que via le FK reservation.intervention_id.
    const cleaningIntervention: PlanningIntervention = {
      id: 1000,
      propertyId: 1,
      propertyName: 'Villa Test',
      type: 'cleaning',
      title: 'Ménage après séjour Gérard Mazy',
      assigneeName: 'Fatou Diallo',
      startDate: '2026-03-05',
      endDate: '2026-03-05',
      startTime: '12:00',
      endTime: '15:00',
      status: 'scheduled',
      estimatedDurationHours: 3,
    };

    const cleaningEvent: PlanningEvent = {
      id: 'int-1000',
      type: 'cleaning',
      propertyId: 1,
      startDate: '2026-03-05',
      endDate: '2026-03-05',
      startTime: '12:00',
      endTime: '15:00',
      label: 'Ménage après séjour Gérard Mazy',
      status: 'scheduled',
      color: '#5083C9',
      intervention: cleaningIntervention,
    };

    const cleaningLayout: BarLayout = {
      event: cleaningEvent,
      left: 320,
      width: 80,
      top: 4,
      height: 34,
      layer: 'primary',
    };

    it('absorbe le ménage du jour de checkout dans la brique (pas de pastille isolée)', () => {
      const { container } = renderRow({
        barLayouts: [hostLayout, cleaningLayout],
        allEvents: [hostEvent, cleaningEvent],
        loadedReservations: [hostReservation],
      });
      const bars = container.querySelectorAll('[data-planning-bar]');
      // Une seule brique rendue : la réservation. Le ménage est une pastille
      // DANS la brique, pas un bar standalone sur la grille.
      expect(bars.length).toBe(1);
    });

    it('clic sur la pastille in-brick → ouvre le détail intervention (onEventClick)', () => {
      const { container } = renderRow({
        barLayouts: [hostLayout, cleaningLayout],
        allEvents: [hostEvent, cleaningEvent],
        loadedReservations: [hostReservation],
      });
      const bar = container.querySelector('[data-planning-bar]') as HTMLElement;
      // La pastille d'intervention cliquable est un role="button" (icône seule
      // → aria-label) ; localisation robuste au moteur d'icônes (Iconify ne rend
      // pas de <svg> synchrone hors réseau).
      const pill = bar.querySelector('[role="button"]') as HTMLElement | null;
      expect(pill).toBeTruthy();
      fireEvent.click(pill!);
      expect(mockOnEventClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'int-1000' }),
      );
    });

    it('rattachée mais brique hôte non rendue (masquée/hors plage) → rien', () => {
      const { container } = renderRow({
        barLayouts: [cleaningLayout],
        allEvents: [cleaningEvent],
        loadedReservations: [hostReservation],
      });
      const bars = container.querySelectorAll('[data-planning-bar]');
      expect(bars.length).toBe(0);
    });

    it('orpheline réelle (aucune réservation candidate chargée) → pastille isolée', () => {
      const { container } = renderRow({
        barLayouts: [cleaningLayout],
        allEvents: [cleaningEvent],
        loadedReservations: [],
      });
      const bars = container.querySelectorAll('[data-planning-bar]');
      expect(bars.length).toBe(1);
    });

    // Ménage « A payer » = SERVICE REQUEST (pas encore une intervention). Lié à la
    // réservation via reservationId. Doit AUSSI s'afficher DANS la brique.
    const cleaningSr: PlanningServiceRequest = {
      id: 2000,
      propertyId: 1,
      propertyName: 'Villa Test',
      serviceType: 'CLEANING',
      title: 'Ménage Airbnb (A payer)',
      startDate: '2026-03-05',
      estimatedDurationHours: 3,
      status: 'AWAITING_PAYMENT',
      reservationId: 42,
    };

    const cleaningSrEvent: PlanningEvent = {
      id: 'sr-2000',
      type: 'cleaning',
      propertyId: 1,
      startDate: '2026-03-05',
      endDate: '2026-03-05',
      label: 'Ménage Airbnb (A payer)',
      status: 'awaiting_payment',
      color: '#5083C9',
      isAwaitingPayment: true,
      serviceRequest: cleaningSr,
    };

    const cleaningSrLayout: BarLayout = {
      event: cleaningSrEvent,
      left: 320,
      width: 80,
      top: 4,
      height: 34,
      layer: 'primary',
    };

    it('absorbe une SERVICE REQUEST « A payer » liée (reservationId) dans la brique', () => {
      const { container } = renderRow({
        barLayouts: [hostLayout, cleaningSrLayout],
        allEvents: [hostEvent, cleaningSrEvent],
        loadedReservations: [hostReservation],
      });
      const bars = container.querySelectorAll('[data-planning-bar]');
      // Une seule brique : la réservation. La SR ménage est une pastille DEDANS.
      expect(bars.length).toBe(1);
    });
  });

  describe('Cursor zone overlay', () => {
    it('renders the cursor zone with pointer-events: none', () => {
      const { container } = renderRow();
      // The overlay is the second absolutely positioned child with cursor: cell
      const overlays = container.querySelectorAll('[style*="pointer-events"]');
      // Find the one with cursor: cell
      const cursorZone = Array.from(container.querySelectorAll('div')).find(
        (el) => {
          const style = window.getComputedStyle(el);
          return style.cursor === 'cell' && style.pointerEvents === 'none';
        },
      );
      expect(cursorZone).toBeTruthy();
    });
  });
});

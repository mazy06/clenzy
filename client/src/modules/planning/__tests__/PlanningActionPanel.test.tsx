import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlanningActionPanel from '../PlanningActionPanel';
import type { PlanningEvent, PanelTab } from '../types';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../../hooks/usePropertyDetails', () => ({
  usePropertyDetails: vi.fn(() => ({
    property: null,
    interventions: [],
    isLoading: true,
    isError: false,
    error: null,
  })),
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { roles: ['SUPER_ADMIN'], orgRole: 'ADMIN' },
  })),
}));

vi.mock('../PlanningActionPanel/usePanelPayment', () => ({
  usePanelPayment: vi.fn(() => ({
    cartItems: [],
    toggleCartItem: vi.fn(),
    selectAll: vi.fn(),
    deselectAll: vi.fn(),
    selectedTotal: 0,
    selectedIds: [],
    paying: false,
    paymentError: null,
    paymentSuccess: false,
    initiatePayment: vi.fn(),
    paymentHistory: [],
    loadingHistory: false,
    refreshHistory: vi.fn(),
  })),
}));

vi.mock('../utils/colorUtils', () => ({
  hexToRgba: vi.fn((hex: string, alpha: number) => `rgba(0,0,0,${alpha})`),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeReservationEvent = (): PlanningEvent => ({
  id: 'res-1',
  type: 'reservation',
  propertyId: 10,
  startDate: '2025-06-01',
  endDate: '2025-06-05',
  label: 'Jean Dupont',
  sublabel: '4 nuits',
  status: 'confirmed',
  color: '#4CAF50',
  reservation: {
    id: 1,
    guestName: 'Jean Dupont',
    propertyName: 'Studio Centre',
    propertyId: 10,
    checkIn: '2025-06-01',
    checkOut: '2025-06-05',
    status: 'CONFIRMED',
    source: 'airbnb',
    totalPrice: 400,
    guestCount: 2,
  } as any,
});

const makeInterventionEvent = (): PlanningEvent => ({
  id: 'int-1',
  type: 'cleaning',
  propertyId: 10,
  startDate: '2025-06-01',
  endDate: '2025-06-01',
  label: 'Ménage Studio',
  status: 'scheduled',
  color: '#9B7FC4',
  intervention: {
    id: 1,
    title: 'Ménage Studio',
    type: 'cleaning',
    status: 'scheduled',
    propertyId: 10,
    propertyName: 'Studio Centre',
    startDate: '2025-06-01',
    endDate: '2025-06-01',
    estimatedDurationHours: 2,
  },
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PlanningActionPanel', () => {
  const defaultProps = {
    open: true,
    activeTab: 'info' as PanelTab,
    onTabChange: vi.fn(),
    onClose: vi.fn(),
    allEvents: [] as PlanningEvent[],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Null event ─────────────────────────────────────────────────────────────
  describe('no event', () => {
    it('should render nothing when event is null', () => {
      const { container } = render(
        <PlanningActionPanel {...defaultProps} event={null} />,
      );
      // Drawer should not render content
      expect(container.querySelector('.MuiDrawer-root')).toBeNull();
    });
  });

  // ── Reservation tabs ───────────────────────────────────────────────────────
  describe('reservation tabs', () => {
    it('should show reservation tab labels', () => {
      render(
        <PlanningActionPanel
          {...defaultProps}
          event={makeReservationEvent()}
        />,
      );
      expect(screen.getByText('Infos')).toBeInTheDocument();
      expect(screen.getByText('Logement')).toBeInTheDocument();
      expect(screen.getByText('Opérations')).toBeInTheDocument();
      expect(screen.getByText('Financier')).toBeInTheDocument();
    });

    it('should NOT show intervention-specific tabs for reservations', () => {
      render(
        <PlanningActionPanel
          {...defaultProps}
          event={makeReservationEvent()}
        />,
      );
      expect(screen.queryByText('Avancement')).not.toBeInTheDocument();
      expect(screen.queryByText('Récap')).not.toBeInTheDocument();
      // "Paiement" tab should not be present (only for interventions)
      // Note: "Financier" is the reservation equivalent
    });
  });

  // ── Intervention tabs ──────────────────────────────────────────────────────
  describe('intervention tabs', () => {
    it('should show intervention tab labels', () => {
      render(
        <PlanningActionPanel
          {...defaultProps}
          event={makeInterventionEvent()}
        />,
      );
      expect(screen.getByText('Infos')).toBeInTheDocument();
      expect(screen.getByText('Avancement')).toBeInTheDocument();
      expect(screen.getByText('Récap')).toBeInTheDocument();
      expect(screen.getByText('Paiement')).toBeInTheDocument();
    });

    it('should NOT show reservation-specific tabs for interventions', () => {
      render(
        <PlanningActionPanel
          {...defaultProps}
          event={makeInterventionEvent()}
        />,
      );
      expect(screen.queryByText('Logement')).not.toBeInTheDocument();
      expect(screen.queryByText('Opérations')).not.toBeInTheDocument();
      expect(screen.queryByText('Financier')).not.toBeInTheDocument();
    });
  });

  // ── Header ─────────────────────────────────────────────────────────────────
  describe('header', () => {
    it('should display event label', () => {
      render(
        <PlanningActionPanel
          {...defaultProps}
          event={makeReservationEvent()}
        />,
      );
      // Label may appear in header + tab content; use getAllByText
      const matches = screen.getAllByText('Jean Dupont');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('should show "Reservation" for reservation events', () => {
      render(
        <PlanningActionPanel
          {...defaultProps}
          event={makeReservationEvent()}
        />,
      );
      const matches = screen.getAllByText(/Reservation/);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('should show "Ménage" for cleaning events', () => {
      render(
        <PlanningActionPanel
          {...defaultProps}
          event={makeInterventionEvent()}
        />,
      );
      // "Ménage" appears in header + possibly label; use getAllByText
      const matches = screen.getAllByText(/Ménage/);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('should display date range', () => {
      render(
        <PlanningActionPanel
          {...defaultProps}
          event={makeReservationEvent()}
        />,
      );
      // Dates appear in header + possibly tab content
      const startDates = screen.getAllByText(/2025-06-01/);
      expect(startDates.length).toBeGreaterThanOrEqual(1);
      const endDates = screen.getAllByText(/2025-06-05/);
      expect(endDates.length).toBeGreaterThanOrEqual(1);
    });

    it('should have close button', () => {
      render(
        <PlanningActionPanel
          {...defaultProps}
          event={makeReservationEvent()}
        />,
      );
      const buttons = screen.getAllByRole('button');
      const closeButton = buttons.find(
        (btn) => btn.querySelector('[data-testid="CloseIcon"]'),
      );
      expect(closeButton).toBeTruthy();
    });
  });

  // ── Tab auto-reset ─────────────────────────────────────────────────────────
  describe('tab auto-reset', () => {
    it('should reset to info when switching from reservation to intervention event', () => {
      const onTabChange = vi.fn();
      const { rerender } = render(
        <PlanningActionPanel
          {...defaultProps}
          event={makeReservationEvent()}
          activeTab="financial"
          onTabChange={onTabChange}
        />,
      );

      // Switch to intervention event
      rerender(
        <PlanningActionPanel
          {...defaultProps}
          event={makeInterventionEvent()}
          activeTab="financial"
          onTabChange={onTabChange}
        />,
      );

      // Should reset to 'info' since 'financial' is not valid for interventions
      expect(onTabChange).toHaveBeenCalledWith('info');
    });
  });

  // ── Maintenance event type ─────────────────────────────────────────────────
  describe('maintenance event', () => {
    it('should show "Maintenance" for maintenance events', () => {
      const maintenanceEvent: PlanningEvent = {
        ...makeInterventionEvent(),
        type: 'maintenance',
        label: 'Plomberie',
        color: '#F59E0B',
      };
      render(
        <PlanningActionPanel
          {...defaultProps}
          event={maintenanceEvent}
        />,
      );
      expect(screen.getByText(/Maintenance/)).toBeInTheDocument();
    });
  });
});

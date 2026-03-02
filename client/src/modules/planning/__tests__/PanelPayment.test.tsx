import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import PanelPayment from '../PlanningActionPanel/PanelPayment';
import type { PlanningEvent } from '../types';
import type { PlanningIntervention } from '../../../services/api';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock useAuth
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { roles: ['SUPER_ADMIN'], orgRole: 'ADMIN' },
  })),
}));

// Mock usePanelPayment
const mockPaymentReturn = {
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
};

vi.mock('../PlanningActionPanel/usePanelPayment', () => ({
  usePanelPayment: vi.fn(() => mockPaymentReturn),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeEvent = (overrides?: Partial<PlanningEvent['intervention']>): PlanningEvent => ({
  id: 'int-1',
  type: 'cleaning',
  propertyId: 10,
  startDate: '2025-06-01',
  endDate: '2025-06-01',
  label: 'Ménage',
  status: 'in_progress',
  color: '#9B7FC4',
  intervention: {
    id: 1,
    title: 'Ménage Studio',
    type: 'cleaning',
    status: 'in_progress',
    propertyId: 10,
    propertyName: 'Studio Centre',
    startDate: '2025-06-01',
    endDate: '2025-06-01',
    estimatedDurationHours: 2,
    paymentStatus: undefined,
    ...overrides,
  },
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PanelPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── No intervention ────────────────────────────────────────────────────────
  describe('no intervention', () => {
    it('should show info alert when no intervention', () => {
      const event = { ...makeEvent(), intervention: undefined };
      render(<PanelPayment event={event} />);
      expect(screen.getByText(/Aucune donnée d'intervention/)).toBeInTheDocument();
    });
  });

  // ── Payment status ─────────────────────────────────────────────────────────
  describe('payment status', () => {
    it('should display payment status label', () => {
      render(<PanelPayment event={makeEvent()} />);
      expect(screen.getByText('Statut paiement')).toBeInTheDocument();
    });

    it('should display status chip with intervention status as fallback', () => {
      render(<PanelPayment event={makeEvent()} />);
      expect(screen.getByText('in_progress')).toBeInTheDocument();
    });

    it('should display paymentStatus when available', () => {
      render(<PanelPayment event={makeEvent({ paymentStatus: 'PAID' })} />);
      expect(screen.getByText('PAID')).toBeInTheDocument();
    });
  });

  // ── Cost details ───────────────────────────────────────────────────────────
  describe('cost details', () => {
    it('should display estimated duration', () => {
      render(<PanelPayment event={makeEvent()} />);
      expect(screen.getByText('Durée estimée')).toBeInTheDocument();
      expect(screen.getByText('2 h')).toBeInTheDocument();
    });

    it('should display estimated cost', () => {
      render(<PanelPayment event={makeEvent()} />);
      expect(screen.getByText('Coût estimé')).toBeInTheDocument();
      expect(screen.getByText('50.00 €')).toBeInTheDocument();
    });

    it('should handle missing duration', () => {
      render(<PanelPayment event={makeEvent({ estimatedDurationHours: undefined })} />);
      expect(screen.getByText('— h')).toBeInTheDocument();
      expect(screen.getByText('0.00 €')).toBeInTheDocument();
    });
  });

  // ── Payment cart (awaiting_payment) ────────────────────────────────────────
  describe('awaiting payment', () => {
    it('should show payment cart when status is awaiting_payment', () => {
      render(<PanelPayment event={makeEvent({ status: 'awaiting_payment' })} />);
      // PanelPaymentCart is rendered; since mockPaymentReturn has empty cart, it shows the empty message
      expect(screen.getByText(/Aucune intervention en attente de paiement/)).toBeInTheDocument();
    });

    it('should NOT show payment cart for non-awaiting statuses', () => {
      render(<PanelPayment event={makeEvent({ status: 'in_progress' })} />);
      expect(screen.queryByText(/Aucune intervention en attente de paiement/)).not.toBeInTheDocument();
    });
  });

  // ── Manager validation ─────────────────────────────────────────────────────
  describe('manager validation', () => {
    it('should show validation section for awaiting_validation + admin role', () => {
      render(<PanelPayment event={makeEvent({ status: 'awaiting_validation' })} />);
      expect(screen.getByText('Validation manager')).toBeInTheDocument();
      expect(screen.getByText(/attend votre validation/)).toBeInTheDocument();
      expect(screen.getByText("Valider l'intervention")).toBeInTheDocument();
    });

    it('should NOT show validation section for non-awaiting_validation status', () => {
      render(<PanelPayment event={makeEvent({ status: 'in_progress' })} />);
      expect(screen.queryByText('Validation manager')).not.toBeInTheDocument();
    });

    it('should open validate dialog when button is clicked', () => {
      render(<PanelPayment event={makeEvent({ status: 'awaiting_validation' })} />);
      fireEvent.click(screen.getByText("Valider l'intervention"));
      // Dialog and button both show "Valider l'intervention", so multiple matches expected
      const matches = screen.getAllByText("Valider l'intervention");
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText(/Coût final/)).toBeInTheDocument();
    });

    it('should call onValidateIntervention when validated', async () => {
      const onValidate = vi.fn().mockResolvedValue({ success: true, error: null });
      render(
        <PanelPayment
          event={makeEvent({ status: 'awaiting_validation', estimatedDurationHours: 2 })}
          onValidateIntervention={onValidate}
        />,
      );

      // Open dialog
      fireEvent.click(screen.getByText("Valider l'intervention"));

      // Submit the dialog
      const dialogSubmit = screen.getAllByText('Valider').find(
        (el) => el.closest('.MuiDialogActions-root'),
      );
      if (dialogSubmit) {
        fireEvent.click(dialogSubmit);
      }

      await waitFor(() => {
        expect(onValidate).toHaveBeenCalledWith(1, 50);
      });
    });
  });

  // ── Payment history ────────────────────────────────────────────────────────
  describe('payment history', () => {
    it('should show payment history section', () => {
      render(<PanelPayment event={makeEvent()} />);
      expect(screen.getByText('Historique paiements')).toBeInTheDocument();
    });

    it('should show empty message when no history', () => {
      render(<PanelPayment event={makeEvent()} />);
      expect(screen.getByText(/Aucun paiement enregistré/)).toBeInTheDocument();
    });

    it('should show loading spinner when loading history', async () => {
      const { usePanelPayment } = await import('../PlanningActionPanel/usePanelPayment');
      (usePanelPayment as any).mockReturnValueOnce({
        ...mockPaymentReturn,
        loadingHistory: true,
      });

      render(<PanelPayment event={makeEvent()} />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should display payment history records', async () => {
      const { usePanelPayment } = await import('../PlanningActionPanel/usePanelPayment');
      (usePanelPayment as any).mockReturnValueOnce({
        ...mockPaymentReturn,
        paymentHistory: [
          { id: 1, interventionId: 1, amount: 50, status: 'PAID', transactionDate: '2025-06-01T10:00:00' },
        ],
      });

      render(<PanelPayment event={makeEvent()} />);
      // "50.00 €" appears both in cost section and history; use getAllByText
      const amountElements = screen.getAllByText('50.00 €');
      expect(amountElements.length).toBeGreaterThanOrEqual(2); // Cost section + history
      expect(screen.getByText('PAID')).toBeInTheDocument();
    });
  });
});

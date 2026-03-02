import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PanelPaymentCart from '../PlanningActionPanel/PanelPaymentCart';
import type { UsePanelPaymentReturn } from '../PlanningActionPanel/usePanelPayment';

// ─── Helpers ────────────────────────────────────────────────────────────────

const makePayment = (overrides?: Partial<UsePanelPaymentReturn>): UsePanelPaymentReturn => ({
  cartItems: [
    { interventionId: 1, title: 'Ménage Studio', cost: 50, selected: true },
    { interventionId: 2, title: 'Ménage Appart', cost: 75, selected: false },
  ],
  toggleCartItem: vi.fn(),
  selectAll: vi.fn(),
  deselectAll: vi.fn(),
  selectedTotal: 50,
  selectedIds: [1],
  paying: false,
  paymentError: null,
  paymentSuccess: false,
  initiatePayment: vi.fn(),
  paymentHistory: [],
  loadingHistory: false,
  refreshHistory: vi.fn(),
  ...overrides,
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PanelPaymentCart', () => {
  // ── Empty state ────────────────────────────────────────────────────────────
  describe('empty state', () => {
    it('should show empty message when no cart items', () => {
      render(<PanelPaymentCart payment={makePayment({ cartItems: [] })} />);
      expect(screen.getByText(/Aucune intervention en attente de paiement/)).toBeInTheDocument();
    });
  });

  // ── Cart items ──────────────────────────────────────────────────────────────
  describe('cart items', () => {
    it('should display cart items count in header', () => {
      render(<PanelPaymentCart payment={makePayment()} />);
      expect(screen.getByText('Panier (2)')).toBeInTheDocument();
    });

    it('should display item titles', () => {
      render(<PanelPaymentCart payment={makePayment()} />);
      expect(screen.getByText('Ménage Studio')).toBeInTheDocument();
      expect(screen.getByText('Ménage Appart')).toBeInTheDocument();
    });

    it('should display item costs', () => {
      render(<PanelPaymentCart payment={makePayment()} />);
      expect(screen.getByText('50 €')).toBeInTheDocument();
      expect(screen.getByText('75 €')).toBeInTheDocument();
    });

    it('should display selected total', () => {
      render(<PanelPaymentCart payment={makePayment()} />);
      expect(screen.getByText('50.00 €')).toBeInTheDocument();
    });

    it('should render checkboxes for each item', () => {
      render(<PanelPaymentCart payment={makePayment()} />);
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(2);
    });

    it('should check selected items and uncheck deselected ones', () => {
      render(<PanelPaymentCart payment={makePayment()} />);
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
    });
  });

  // ── Cart actions ───────────────────────────────────────────────────────────
  describe('cart actions', () => {
    it('should call toggleCartItem when item row is clicked', () => {
      const payment = makePayment();
      render(<PanelPaymentCart payment={payment} />);

      fireEvent.click(screen.getByText('Ménage Appart'));
      expect(payment.toggleCartItem).toHaveBeenCalledWith(2);
    });

    it('should call toggleCartItem when checkbox is changed', () => {
      const payment = makePayment();
      render(<PanelPaymentCart payment={payment} />);

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      expect(payment.toggleCartItem).toHaveBeenCalledWith(1);
    });

    it('should call selectAll when "Tout" button is clicked', () => {
      const payment = makePayment();
      render(<PanelPaymentCart payment={payment} />);

      fireEvent.click(screen.getByText('Tout'));
      expect(payment.selectAll).toHaveBeenCalledTimes(1);
    });

    it('should call deselectAll when "Aucun" button is clicked', () => {
      const payment = makePayment();
      render(<PanelPaymentCart payment={payment} />);

      fireEvent.click(screen.getByText('Aucun'));
      expect(payment.deselectAll).toHaveBeenCalledTimes(1);
    });
  });

  // ── Pay button ─────────────────────────────────────────────────────────────
  describe('pay button', () => {
    it('should show pay button with total', () => {
      render(<PanelPaymentCart payment={makePayment()} />);
      expect(screen.getByText('Payer 50.00 €')).toBeInTheDocument();
    });

    it('should call initiatePayment when clicked', () => {
      const payment = makePayment();
      render(<PanelPaymentCart payment={payment} />);

      fireEvent.click(screen.getByText('Payer 50.00 €'));
      expect(payment.initiatePayment).toHaveBeenCalledTimes(1);
    });

    it('should disable pay button when no items selected', () => {
      render(<PanelPaymentCart payment={makePayment({ selectedIds: [], selectedTotal: 0 })} />);
      // MUI Button with startIcon may break text across elements; use role query
      const buttons = screen.getAllByRole('button');
      const payButton = buttons.find((btn) => btn.textContent?.includes('Payer'));
      expect(payButton).toBeTruthy();
      expect(payButton).toBeDisabled();
    });

    it('should disable pay button when paying', () => {
      render(<PanelPaymentCart payment={makePayment({ paying: true })} />);
      const btn = screen.getByText('Paiement en cours...').closest('button');
      expect(btn).toBeDisabled();
    });

    it('should show loading text when paying', () => {
      render(<PanelPaymentCart payment={makePayment({ paying: true })} />);
      expect(screen.getByText('Paiement en cours...')).toBeInTheDocument();
    });
  });

  // ── Error / Success ────────────────────────────────────────────────────────
  describe('error and success states', () => {
    it('should display payment error', () => {
      render(<PanelPaymentCart payment={makePayment({ paymentError: 'Carte refusée' })} />);
      expect(screen.getByText('Carte refusée')).toBeInTheDocument();
    });

    it('should display payment success', () => {
      render(<PanelPaymentCart payment={makePayment({ paymentSuccess: true })} />);
      expect(screen.getByText(/Paiement effectué avec succès/)).toBeInTheDocument();
    });
  });
});

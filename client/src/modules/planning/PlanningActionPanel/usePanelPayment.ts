import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '../../../services/api/paymentsApi';
import type { PaymentRecord } from '../../../services/api/paymentsApi';
import type { PlanningIntervention } from '../../../services/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CartItem {
  interventionId: number;
  title: string;
  cost: number;
  selected: boolean;
}

export interface UsePanelPaymentReturn {
  // Cart
  cartItems: CartItem[];
  toggleCartItem: (interventionId: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
  selectedTotal: number;
  selectedIds: number[];
  // Payment
  paying: boolean;
  paymentError: string | null;
  paymentSuccess: boolean;
  initiatePayment: () => Promise<void>;
  // History
  paymentHistory: PaymentRecord[];
  loadingHistory: boolean;
  refreshHistory: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 2000;

// ─── Hook ───────────────────────────────────────────────────────────────────

export function usePanelPayment(
  propertyId: number,
  interventions?: PlanningIntervention[],
  onCreatePaymentSession?: (interventionIds: number[], total: number) => Promise<{ url: string; sessionId: string }>,
): UsePanelPaymentReturn {
  const queryClient = useQueryClient();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cart state ──────────────────────────────────────────────────────
  // Seules les DESELECTIONS utilisateur sont de l'etat ; le panier est derive
  // des interventions AWAITING_PAYMENT (plus d'effet de sync — les choix de
  // l'utilisateur survivent aux refetch, les nouvelles lignes arrivent cochees).
  const [deselectedIds, setDeselectedIds] = useState<ReadonlySet<number>>(new Set());
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const cartItems = useMemo<CartItem[]>(() => {
    if (!interventions) return [];
    return interventions
      .filter((i) => i.propertyId === propertyId && i.status === 'awaiting_payment')
      .map((i) => ({
        interventionId: i.id,
        title: i.title,
        cost: i.estimatedDurationHours ? i.estimatedDurationHours * 25 : 0,
        selected: !deselectedIds.has(i.id),
      }));
  }, [interventions, propertyId, deselectedIds]);

  // Fetch payment history
  const refreshHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await paymentsApi.getHistory({ size: 20 });
      // Filter by property-related interventions
      const propertyInterventionIds = new Set(
        (interventions || []).flatMap((i) => (i.propertyId === propertyId ? [i.id] : [])),
      );
      setPaymentHistory(
        data.content.filter((r) => r.referenceId != null && propertyInterventionIds.has(r.referenceId)),
      );
    } catch {
      // Silently fail
    } finally {
      setLoadingHistory(false);
    }
  }, [propertyId, interventions]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // Cleanup poll on unmount
  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  // ── Cart actions ──────────────────────────────────────────────────
  const toggleCartItem = useCallback((id: number) => {
    setDeselectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setDeselectedIds(new Set());
  }, []);

  const deselectAll = useCallback(() => {
    setDeselectedIds(new Set(cartItems.map((item) => item.interventionId)));
  }, [cartItems]);

  const selectedItems = cartItems.filter((i) => i.selected);
  const selectedTotal = selectedItems.reduce((sum, i) => sum + i.cost, 0);
  const selectedIds = selectedItems.map((i) => i.interventionId);

  // ── Payment initiation ──────────────────────────────────────────
  const initiatePayment = useCallback(async () => {
    if (selectedIds.length === 0 || !onCreatePaymentSession) return;

    setPaying(true);
    setPaymentError(null);
    setPaymentSuccess(false);

    try {
      const session = await onCreatePaymentSession(selectedIds, selectedTotal);

      // Open Stripe in popup
      const popup = window.open(
        session.url,
        'stripe_checkout',
        'width=500,height=700,menubar=no,toolbar=no,location=no',
      );

      // Poll for payment status
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;

        // Check if popup was closed
        if (popup && popup.closed) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setPaying(false);
          return;
        }

        try {
          const status = await paymentsApi.getSessionStatus(session.sessionId);
          if (status.paymentStatus === 'PAID') {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            popup?.close();
            setPaymentSuccess(true);
            setPaying(false);
            // Refresh all planning data
            queryClient.invalidateQueries({ queryKey: ['planning'] });
            refreshHistory();
          } else if (status.paymentStatus === 'FAILED') {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            popup?.close();
            setPaymentError('Le paiement a échoué');
            setPaying(false);
          }
        } catch {
          // Silently retry
        }

        if (attempts >= MAX_POLL_ATTEMPTS) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setPaying(false);
          setPaymentError('Délai d\'attente dépassé. Vérifiez le statut du paiement.');
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Erreur lors de la création du paiement');
      setPaying(false);
    }
  }, [selectedIds, selectedTotal, onCreatePaymentSession, queryClient, refreshHistory]);

  return {
    cartItems,
    toggleCartItem,
    selectAll,
    deselectAll,
    selectedTotal,
    selectedIds,
    paying,
    paymentError,
    paymentSuccess,
    initiatePayment,
    paymentHistory,
    loadingHistory,
    refreshHistory,
  };
}

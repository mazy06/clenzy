import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, Box, IconButton, Button, CircularProgress, Alert } from '@mui/material';
import {
  Close as CloseIcon,
  Lock as LockIcon,
  CheckCircle as CheckCircleIcon,
} from '../icons';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { Money } from './Money';
import { paymentsApi } from '../services/api/paymentsApi';
import { serviceRequestsApi } from '../services/api/serviceRequestsApi';
import { getErrorMessage } from '../utils/getErrorMessage';

// Ne PAS appeler loadStripe('') si la clef n'est pas configuree : ça log un
// `IntegrationError: empty string` sur les pages publiques (accept-invitation,
// landing) qui n'utilisent jamais Stripe. Meme pattern que BookingPaymentPage.
const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

export interface PaymentCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** ID de l'intervention (paiement intervention existante) */
  interventionId?: number;
  /** ID de la demande de service (paiement SR avant creation intervention) */
  serviceRequestId?: number;
  amount: number;
  interventionTitle?: string;
}

const PaymentCheckoutModal: React.FC<PaymentCheckoutModalProps> = ({
  open,
  onClose,
  onSuccess,
  interventionId,
  serviceRequestId,
  amount,
  interventionTitle,
}) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Fetch embedded session when modal opens
  useEffect(() => {
    if (!open || (!interventionId && !serviceRequestId) || !amount) return;

    let cancelled = false;
    const fetchSession = async () => {
      setLoading(true);
      setError(null);
      setClientSecret(null);
      setPaymentSuccess(false);
      try {
        // Utiliser l'endpoint SR si serviceRequestId est fourni, sinon l'endpoint intervention
        const session = serviceRequestId
          ? await serviceRequestsApi.createEmbeddedSession(serviceRequestId)
          : await paymentsApi.createEmbeddedSession({ interventionId: interventionId!, amount });
        if (!cancelled) {
          if (session.clientSecret) {
            setClientSecret(session.clientSecret);
            setSessionId(session.sessionId || null);
          } else {
            setError('Impossible de creer la session de paiement.');
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          // Le serveur explique pourquoi il refuse (statut, montant, provider) :
          // afficher « Erreur lors de la création de la session » à la place
          // laissait l'utilisateur sans aucune piste.
          setError(getErrorMessage(err, 'Erreur lors de la création de la session de paiement'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSession();
    return () => {
      cancelled = true;
    };
  }, [open, interventionId, serviceRequestId, amount]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setSessionId(null);
      setError(null);
      setLoading(false);
      setPaymentSuccess(false);
    }
  }, [open]);

  const handleComplete = useCallback(async () => {
    setClientSecret(null);
    setPaymentSuccess(true);

    // Poll the right check-payment endpoint to trigger fallback confirmation
    // (checks Stripe API directly if webhook hasn't arrived yet).
    // Retry up to 3 times with increasing delays to ensure the payment
    // is confirmed in the DB before refreshing the UI.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (serviceRequestId) {
          const result = await serviceRequestsApi.checkPaymentStatus(serviceRequestId);
          if (result.paymentStatus === 'PAID') break;
        } else if (sessionId) {
          const result = await paymentsApi.getSessionStatus(sessionId);
          if (result.paymentStatus === 'PAID') break;
        } else {
          break;
        }
      } catch {
        // Non-blocking — continue retrying
      }
      // Wait 1s, 2s, 3s between attempts
      await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
    }

    // Refresh data after confirmation
    onSuccess();
  }, [onSuccess, sessionId, serviceRequestId]);

  const embeddedOptions = useMemo(() => {
    if (!clientSecret) return null;
    return {
      clientSecret,
      onComplete: handleComplete,
    };
  }, [clientSecret, handleComplete]);

  return (
    <Dialog
      open={open}
      onClose={paymentSuccess ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        // r18 + hairline + ombre profonde : peau modale du thème global
        sx: {
          overflow: 'hidden',
          maxHeight: '90vh',
        },
      }}
    >
      {/* ── Success screen ─────────────────────────────────────────── */}
      {paymentSuccess ? (
        <DialogContent sx={{ p: 0 }}>
          <div className="flex flex-col items-center justify-center py-9 px-6 gap-3">
            <span className="inline-flex text-[var(--ok)]">
              <CheckCircleIcon size={64} strokeWidth={1.5} />
            </span>
            <h5 className="cn-text-h5 font-[var(--font-display)] font-semibold text-[20px] tracking-[-.01em] text-[var(--ink)] text-center">
              Paiement reussi !
            </h5>
            <p className="cn-text-body2 text-[var(--muted)] text-[13px] text-center max-w-[360px]">
              Le paiement de <Money value={amount} from="EUR" /> pour{' '}
              <strong>{interventionTitle || 'l\'intervention'}</strong> a ete traite avec succes.
            </p>
            <Button
              variant="contained"
              color="success"
              onClick={onClose}
              sx={{ mt: 2, minWidth: 120 }}
            >
              Fermer
            </Button>
          </div>
        </DialogContent>
      ) : (
        <>
          {/* ── Header ──────────────────────────────────────────── */}
          <DialogTitle
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex text-[var(--accent)] shrink-0">
                <LockIcon size={18} strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                  Paiement securise
                </span>
                {interventionTitle && (
                  <p className="cn-text-body2 font-[var(--font-sans)] text-[11.5px] font-normal text-[var(--muted)]">
                    {interventionTitle}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <h6 className="cn-text-h6 font-[var(--font-display)] text-[1.125rem] font-semibold tabular-nums text-[var(--accent)]">
                <Money value={amount} from="EUR" />
              </h6>
              {/* ✕ — pattern .rm-x : 34px r10 hairline, hover --err */}
              <IconButton
                onClick={onClose}
                aria-label="Fermer"
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '10px',
                  border: '1px solid var(--line-2)',
                  backgroundColor: 'var(--card)',
                  color: 'var(--muted)',
                  flexShrink: 0,
                  '&:hover': { color: 'var(--err)', borderColor: 'var(--err)', backgroundColor: 'var(--card)' },
                  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
                }}
              >
                <CloseIcon size={16} strokeWidth={1.75} />
              </IconButton>
            </div>
          </DialogTitle>

          {/* ── Content ─────────────────────────────────────────── */}
          <DialogContent sx={{ p: 0 }}>
            {/* Loading state */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <CircularProgress size={32} thickness={3.5} sx={{ color: 'var(--accent)' }} />
                <p className="cn-text-body2 text-[var(--muted)] text-[12.5px]">
                  Chargement du formulaire de paiement...
                </p>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="p-4">
                <Alert
                  severity="error"
                  sx={{
                    // Alerte -soft hairline (pattern .rm-conflict)
                    bgcolor: 'var(--err-soft)',
                    border: '1px solid color-mix(in srgb, var(--err) 30%, transparent)',
                    borderRadius: '12px',
                    color: 'var(--body)',
                    fontSize: '12.5px',
                    '& .MuiAlert-icon': { color: 'var(--err)' },
                  }}
                  onClose={() => setError(null)}
                >
                  {error}
                </Alert>
              </div>
            )}

            {/* Stripe Embedded Checkout */}
            {clientSecret && embeddedOptions && (
              <Box
                sx={{
                  p: 0,
                  '& .StripeEmbeddedCheckout': {
                    minHeight: 400,
                  },
                }}
              >
                <EmbeddedCheckoutProvider stripe={stripePromise} options={embeddedOptions}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </Box>
            )}

            {/* Footer security note */}
            {!loading && !error && clientSecret && (
              <div className="px-4 py-2 flex items-center justify-center gap-0.5 border-t border-[var(--line)] bg-[var(--surface-2)]">
                <span className="inline-flex text-[var(--faint)]"><LockIcon size={12} strokeWidth={1.75} /></span>
                <span className="cn-text-caption text-[var(--faint)] text-[11.5px]">
                  Paiement securise par Stripe. Vos donnees sont chiffrees.
                </span>
              </div>
            )}
          </DialogContent>
        </>
      )}
    </Dialog>
  );
};

export default PaymentCheckoutModal;

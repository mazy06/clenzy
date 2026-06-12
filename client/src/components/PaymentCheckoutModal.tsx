import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  Lock as LockIcon,
  CheckCircle as CheckCircleIcon,
} from '../icons';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { useCurrency } from '../hooks/useCurrency';
import { paymentsApi } from '../services/api/paymentsApi';
import { serviceRequestsApi } from '../services/api/serviceRequestsApi';

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
          setError(
            err instanceof Error
              ? err.message
              : 'Erreur lors de la creation de la session de paiement'
          );
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

  const { convertAndFormat } = useCurrency();

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
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 6,
              px: 4,
              gap: 2,
            }}
          >
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                color: 'var(--ok)',
              }}
            >
              <CheckCircleIcon size={64} strokeWidth={1.5} />
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 20,
                letterSpacing: '-.01em',
                color: 'var(--ink)',
                textAlign: 'center',
              }}
            >
              Paiement reussi !
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'var(--muted)',
                fontSize: '13px',
                textAlign: 'center',
                maxWidth: 360,
              }}
            >
              Le paiement de {convertAndFormat(amount, 'EUR')} pour{' '}
              <strong>{interventionTitle || 'l\'intervention'}</strong> a ete traite avec succes.
            </Typography>
            <Button
              variant="contained"
              color="success"
              onClick={onClose}
              sx={{ mt: 2, minWidth: 120 }}
            >
              Fermer
            </Button>
          </Box>
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
              <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', flexShrink: 0 }}>
                <LockIcon size={18} strokeWidth={1.75} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Box component="span" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Paiement securise
                </Box>
                {interventionTitle && (
                  <Typography variant="body2" sx={{ fontFamily: 'var(--font-sans)', fontSize: '11.5px', fontWeight: 400, color: 'var(--muted)' }}>
                    {interventionTitle}
                  </Typography>
                )}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--accent)',
                }}
              >
                {convertAndFormat(amount, 'EUR')}
              </Typography>
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
            </Box>
          </DialogTitle>

          {/* ── Content ─────────────────────────────────────────── */}
          <DialogContent sx={{ p: 0 }}>
            {/* Loading state */}
            {loading && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  py: 8,
                  gap: 2,
                }}
              >
                <CircularProgress size={32} thickness={3.5} sx={{ color: 'var(--accent)' }} />
                <Typography variant="body2" sx={{ color: 'var(--muted)', fontSize: '12.5px' }}>
                  Chargement du formulaire de paiement...
                </Typography>
              </Box>
            )}

            {/* Error state */}
            {error && (
              <Box sx={{ p: 3 }}>
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
              </Box>
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
              <Box
                sx={{
                  px: 3,
                  py: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  borderTop: '1px solid var(--line)',
                  bgcolor: 'var(--surface-2)',
                }}
              >
                <Box component="span" sx={{ display: 'inline-flex', color: 'var(--faint)' }}><LockIcon size={12} strokeWidth={1.75} /></Box>
                <Typography variant="caption" sx={{ color: 'var(--faint)', fontSize: '11.5px' }}>
                  Paiement securise par Stripe. Vos donnees sont chiffrees.
                </Typography>
              </Box>
            )}
          </DialogContent>
        </>
      )}
    </Dialog>
  );
};

export default PaymentCheckoutModal;

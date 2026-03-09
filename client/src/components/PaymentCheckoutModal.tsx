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
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Lock as LockIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { paymentsApi } from '../services/api/paymentsApi';
import { serviceRequestsApi } from '../services/api/serviceRequestsApi';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

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

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val);

  return (
    <Dialog
      open={open}
      onClose={paymentSuccess ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
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
            <CheckCircleIcon
              sx={{
                fontSize: 64,
                color: '#4A9B8E',
                filter: 'drop-shadow(0 2px 8px rgba(74, 155, 142, 0.3))',
              }}
            />
            <Typography
              variant="h5"
              sx={{ fontWeight: 700, fontSize: '1.25rem', textAlign: 'center' }}
            >
              Paiement reussi !
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontSize: '0.875rem',
                textAlign: 'center',
                maxWidth: 360,
              }}
            >
              Le paiement de {formatCurrency(amount)} pour{' '}
              <strong>{interventionTitle || 'l\'intervention'}</strong> a ete traite avec succes.
            </Typography>
            <Button
              variant="contained"
              onClick={onClose}
              sx={{
                mt: 2,
                px: 4,
                py: 1,
                fontSize: '0.875rem',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 2,
                backgroundColor: '#4A9B8E',
                '&:hover': { backgroundColor: '#3d8577' },
              }}
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
              pb: 1,
              pt: 2,
              px: 3,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LockIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
              <Box>
                <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700 }}>
                  Paiement securise
                </Typography>
                {interventionTitle && (
                  <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    {interventionTitle}
                  </Typography>
                )}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography
                variant="h6"
                sx={{
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: theme.palette.primary.main,
                }}
              >
                {formatCurrency(amount)}
              </Typography>
              <IconButton
                size="small"
                onClick={onClose}
                sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
              >
                <CloseIcon fontSize="small" />
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
                <CircularProgress size={36} sx={{ color: theme.palette.primary.main }} />
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8125rem' }}>
                  Chargement du formulaire de paiement...
                </Typography>
              </Box>
            )}

            {/* Error state */}
            {error && (
              <Box sx={{ p: 3 }}>
                <Alert
                  severity="error"
                  sx={{ borderRadius: 2, fontSize: '0.8125rem' }}
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
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                }}
              >
                <LockIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6875rem' }}>
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

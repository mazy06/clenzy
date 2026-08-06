import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Button, Spinner } from './ui';
import {
  Alert,
  AlertAction,
  AlertDescription,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui';
import { TriangleAlert, X } from 'lucide-react';
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
      onOpenChange={(next) => { if (!next && !paymentSuccess) onClose(); }}
    >
      {/* r18 + hairline + ombre profonde : peau modale du kit. */}
      <DialogContent
        className="sm:max-w-[600px] overflow-hidden max-h-[90vh] p-0"
        showCloseButton={false}
      >
        {paymentSuccess ? (
          <div className="flex flex-col items-center justify-center py-9 px-6 gap-3">
            {/* Icone decorative de 64 px : ce n'est pas du texte, elle garde la
                teinte vive plutot que l'encre `-ink`. */}
            <span className="inline-flex text-success">
              <CheckCircleIcon size={64} strokeWidth={1.5} />
            </span>
            <DialogTitle className="font-[family-name:var(--font-display)] font-semibold text-[20px] tracking-[-.01em] text-foreground text-center">
              Paiement reussi !
            </DialogTitle>
            <p className="max-w-[360px] text-center text-[13px] text-muted-foreground">
              Le paiement de <Money value={amount} from="EUR" /> pour{' '}
              <strong>{interventionTitle || 'l\'intervention'}</strong> a ete traite avec succes.
            </p>
            {/* Seule action de l'ecran de succes : elle est principale (default).
                Le kit n'a pas de variante « success » et la reussite est deja portee
                par la coche verte au-dessus. */}
            <Button className="mt-3 min-w-[120px]" onClick={onClose}>
              Fermer
            </Button>
          </div>
        ) : (
          <>
            {/* ── Header ──────────────────────────────────────────── */}
            <DialogHeader className="flex-row items-center justify-between gap-[9px] px-6 pt-6 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex text-primary shrink-0">
                  <LockIcon size={18} strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <DialogTitle className="block overflow-hidden text-ellipsis whitespace-nowrap">
                    Paiement securise
                  </DialogTitle>
                  {interventionTitle && (
                    <p className="text-[11.5px] font-normal text-muted-foreground">
                      {interventionTitle}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <h6 className="font-[family-name:var(--font-display)] text-[1.125rem] font-semibold tabular-nums text-primary">
                  <Money value={amount} from="EUR" />
                </h6>
                {/* ✕ : 34 px, filet de 1 px, encre destructive au survol. */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onClose}
                  aria-label="Fermer"
                  className="size-[34px] rounded-lg border-border bg-card text-muted-foreground hover:text-destructive hover:border-destructive hover:bg-card"
                >
                  <CloseIcon size={16} strokeWidth={1.75} />
                </Button>
              </div>
            </DialogHeader>

            {/* ── Content ─────────────────────────────────────────── */}
            {/* Loading state */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Spinner className="size-8 text-primary" />
                <p className="text-[12.5px] text-muted-foreground">
                  Chargement du formulaire de paiement...
                </p>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="p-4">
                <Alert variant="destructive" className="text-[12.5px]">
                  <TriangleAlert />
                  <AlertDescription>{error}</AlertDescription>
                  <AlertAction>
                    <Button variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setError(null)}>
                      <X />
                    </Button>
                  </AlertAction>
                </Alert>
              </div>
            )}

            {/* Stripe Embedded Checkout */}
            {clientSecret && embeddedOptions && (
              <div className="p-0 [&_.StripeEmbeddedCheckout]:min-h-[400px]">
                <EmbeddedCheckoutProvider stripe={stripePromise} options={embeddedOptions}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            )}

            {/* Footer security note */}
            {!loading && !error && clientSecret && (
              <div className="px-4 py-2 flex items-center justify-center gap-0.5 border-t border-border bg-muted">
                <span className="inline-flex text-faint"><LockIcon size={12} strokeWidth={1.75} /></span>
                <span className="text-[11.5px] text-faint">
                  Paiement securise par Stripe. Vos donnees sont chiffrees.
                </span>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentCheckoutModal;

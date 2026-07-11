/* ============================================================
   <FeedInvoiceModal> — détail d'une facture depuis le feed

   Ouvert depuis une ligne du journal « En direct » qui porte un `invoiceId`
   (relances de paiement de l'agent Finance). Charge la facture via
   GET /api/invoices/{id} (org-scopé serveur) et propose deux actions :
   - « Payer » : session de paiement (orchestrateur) → ouvre le checkout Stripe ;
   - « Envoyer le lien de paiement » : email au client concerné (voyageur de la
     réservation liée, sinon demandeur de l'intervention), envoyé côté serveur.
   ============================================================ */

import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../../hooks/useTranslation';
import { invoicesApi, INVOICE_STATUS_COLORS, type Invoice } from '../../../services/api/invoicesApi';
import { Money } from '../../../components/Money';

interface FeedInvoiceModalProps {
  /** Id de la facture à détailler (ouvre la modale quand non-null). */
  invoiceId: number | null;
  onClose: () => void;
}

export function FeedInvoiceModal({ invoiceId, onClose }: FeedInvoiceModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invoiceId == null) {
      setInvoice(null);
      setSentTo(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setInvoice(null);
    setSentTo(null);
    setError(null);
    invoicesApi
      .get(invoiceId)
      .then((inv) => {
        if (!cancelled) setInvoice(inv);
      })
      .catch(() => {
        if (!cancelled) setError(t('supervision.invoiceModal.loadError', 'Facture introuvable ou inaccessible.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId, t]);

  const payable = invoice != null && ['SENT', 'ISSUED', 'OVERDUE'].includes(invoice.status);

  const handlePay = async () => {
    if (invoiceId == null || paying) return;
    setPaying(true);
    setError(null);
    try {
      const result = await invoicesApi.initiatePayment(invoiceId);
      const url = result.paymentResult?.redirectUrl;
      if (url) {
        window.open(url, '_blank', 'noopener');
      } else {
        setError(t('supervision.invoiceModal.payError', 'Lien de paiement non généré.'));
      }
    } catch {
      setError(t('supervision.invoiceModal.payError', 'Lien de paiement non généré.'));
    } finally {
      setPaying(false);
    }
  };

  const handleSendLink = async () => {
    if (invoiceId == null || sending) return;
    setSending(true);
    setError(null);
    try {
      const { sentTo: email } = await invoicesApi.sendPaymentLink(invoiceId);
      setSentTo(email);
    } catch {
      setError(t('supervision.invoiceModal.sendError', "Envoi impossible — aucun email client résolvable ou facture non payable."));
    } finally {
      setSending(false);
    }
  };

  const row = (label: string, value: ReactNode) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" component="div" sx={{ fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );

  return (
    <Dialog open={invoiceId != null} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('supervision.invoiceModal.title', 'Facture')}</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : invoice ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>{invoice.invoiceNumber}</Typography>
              <Chip
                size="small"
                label={t(`supervision.invoiceModal.status.${invoice.status}`, invoice.status)}
                sx={{
                  bgcolor: `color-mix(in srgb, ${INVOICE_STATUS_COLORS[invoice.status] ?? 'var(--muted)'} 18%, transparent)`,
                  color: INVOICE_STATUS_COLORS[invoice.status] ?? 'var(--muted)',
                  fontWeight: 700,
                }}
              />
            </Box>
            {row(
              t('supervision.invoiceModal.amount', 'Montant TTC'),
              <Money value={invoice.totalTtc} from={invoice.currency || 'EUR'} />,
            )}
            {invoice.dueDate
              && row(t('supervision.invoiceModal.dueDate', 'Échéance'), new Date(invoice.dueDate).toLocaleDateString())}
            {invoice.buyerName
              && row(t('supervision.invoiceModal.buyer', 'Client'), invoice.buyerName)}
            {invoice.reservationId != null
              && row(
                t('supervision.invoiceModal.reservation', 'Réservation'),
                <Button
                  size="small"
                  sx={{ p: 0, minWidth: 0, fontWeight: 600 }}
                  onClick={() => { onClose(); navigate(`/reservations?highlight=${invoice.reservationId}`); }}
                >
                  {`#${invoice.reservationId}`}
                </Button>,
              )}
            {invoice.interventionId != null
              && row(
                t('supervision.invoiceModal.intervention', 'Prestation'),
                <Button
                  size="small"
                  sx={{ p: 0, minWidth: 0, fontWeight: 600 }}
                  onClick={() => { onClose(); navigate(`/interventions/${invoice.interventionId}`); }}
                >
                  {`#${invoice.interventionId}`}
                </Button>,
              )}
            {sentTo && (
              <Alert severity="success" sx={{ mt: 1.5 }}>
                {t('supervision.invoiceModal.sentTo', 'Lien de paiement envoyé à')} {sentTo}
              </Alert>
            )}
            {error && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                {error}
              </Alert>
            )}
            {!payable && (
              <Alert severity="info" sx={{ mt: 1.5 }}>
                {t('supervision.invoiceModal.notPayable', 'Cette facture n’est pas (ou plus) payable en ligne.')}
              </Alert>
            )}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 2 }}>
            {error ?? t('supervision.invoiceModal.loadError', 'Facture introuvable ou inaccessible.')}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button
          size="small"
          onClick={() => { onClose(); navigate(`/billing?highlight=${invoiceId}`); }}
        >
          {t('supervision.invoiceModal.openBilling', 'Ouvrir dans Facturation')}
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>{t('supervision.invoiceModal.close', 'Fermer')}</Button>
        {payable && (
          <>
            <Button
              variant="outlined"
              disabled={sending || sentTo != null}
              onClick={handleSendLink}
              startIcon={sending ? <CircularProgress size={14} /> : undefined}
            >
              {t('supervision.invoiceModal.sendLink', 'Envoyer le lien de paiement')}
            </Button>
            <Button
              variant="contained"
              disabled={paying}
              onClick={handlePay}
              startIcon={paying ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : undefined}
            >
              {t('supervision.invoiceModal.pay', 'Payer')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

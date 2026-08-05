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
import StatusChip from '../../../components/StatusChip';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui';
import { CircleCheck, TriangleAlert, Info } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../../hooks/useTranslation';
import { invoicesApi, INVOICE_STATUS_COLORS, type Invoice } from '../../../services/api/invoicesApi';
import { Money } from '../../../components/Money';

interface FeedInvoiceModalProps {
  /** Id de la facture à détailler (ouvre la modale quand non-null). */
  invoiceId: number | null;
  onClose: () => void;
}

const row = (label: string, value: ReactNode) => (
  <div className="flex justify-between gap-3 py-0.5">
    <p className="text-xs text-muted-foreground">{label}</p>
    <div className="text-xs font-semibold text-end tabular-nums text-foreground">
      {value}
    </div>
  </div>
);

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

  return (
    // maxWidth="xs" MUI = 444 px.
    <Dialog open={invoiceId != null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-[444px]">
        <DialogHeader>
          <DialogTitle>{t('supervision.invoiceModal.title', 'Facture')}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner className="size-6" />
          </div>
        ) : invoice ? (
          <>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-semibold text-foreground">{invoice.invoiceNumber}</p>
              {/* Couleur de statut hors palette sémantique (une teinte par statut
                  de facture) : la prop `color` de la primitive dérive elle-même
                  le fond doux — pas de color-mix recopié ici. */}
              <StatusChip
                color={INVOICE_STATUS_COLORS[invoice.status] ?? 'var(--bui-muted-foreground)'}
                label={t(`supervision.invoiceModal.status.${invoice.status}`, invoice.status)}
              />
            </div>
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
                // Rendu au sein d'une ligne cle/valeur : c'est un lien dans une
                // phrase, pas un bouton — variante `link`, sans gabarit.
                <Button
                  variant="link"
                  size="xs"
                  className="h-auto p-0 font-semibold"
                  onClick={() => { onClose(); navigate(`/reservations?highlight=${invoice.reservationId}`); }}
                >
                  {`#${invoice.reservationId}`}
                </Button>,
              )}
            {invoice.interventionId != null
              && row(
                t('supervision.invoiceModal.intervention', 'Prestation'),
                <Button
                  variant="link"
                  size="xs"
                  className="h-auto p-0 font-semibold"
                  onClick={() => { onClose(); navigate(`/interventions/${invoice.interventionId}`); }}
                >
                  {`#${invoice.interventionId}`}
                </Button>,
              )}
            {sentTo && (
              <Alert variant="success" className="mt-2">
                <CircleCheck />
                <AlertDescription>{t('supervision.invoiceModal.sentTo', 'Lien de paiement envoyé à')}{sentTo}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive" className="mt-2">
                <TriangleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {!payable && (
              <Alert variant="info" className="mt-2">
                <Info />
                <AlertDescription>{t('supervision.invoiceModal.notPayable', 'Cette facture n’est pas (ou plus) payable en ligne.')}</AlertDescription>
              </Alert>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground italic py-3">
            {error ?? t('supervision.invoiceModal.loadError', 'Facture introuvable ou inaccessible.')}
          </p>
        )}
        {/* Pied de modale : une seule action principale (Payer). Les autres
            descendent d'un cran. Taille unique pour aligner la rangee. */}
        {/* flex-row force : DialogActions MUI reste en ligne a toutes les tailles,
            et l'entretoise flex-1 ci-dessous suppose un axe horizontal. */}
        <DialogFooter className="gap-[6px] flex-row flex-wrap justify-start sm:justify-start">
          <Button
            variant="ghost"
            onClick={() => { onClose(); navigate(`/billing?highlight=${invoiceId}`); }}
          >
            {t('supervision.invoiceModal.openBilling', 'Ouvrir dans Facturation')}
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>{t('supervision.invoiceModal.close', 'Fermer')}</Button>
          {payable && (
            <>
              <Button
                variant="outline"
                disabled={sending || sentTo != null}
                onClick={handleSendLink}
              >
                {sending && <Spinner className="size-3.5" />}
                {t('supervision.invoiceModal.sendLink', 'Envoyer le lien de paiement')}
              </Button>
              <Button disabled={paying} onClick={handlePay}>
                {paying && <Spinner className="size-3.5" />}
                {t('supervision.invoiceModal.pay', 'Payer')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Spinner,
} from '../../../components/ui';
import StatusChip from '../../../components/StatusChip';
import { CheckCircleOutline, Home, LocationOn, Receipt } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { useNotification } from '../../../hooks/useNotification';
import { useAuth } from '../../../hooks/useAuth';
import { formatCurrency } from '../../../utils/currencyUtils';
import { formatDate } from '../../../utils/formatUtils';
import { documentsApi } from '../../../services/api/documentsApi';
import { serviceQuotesApi } from '../../../services/api/serviceQuotesApi';
import type { QuoteCardPayload } from '../../../services/api/contactApi';

/**
 * Devis presente DANS la discussion : le logement concerne, le detail chiffre,
 * le PDF a ouvrir sans quitter le fil, et la decision.
 *
 * <p>Le recapitulatif etait du texte : pour ouvrir le devis ou l'approuver, il
 * fallait retrouver l'intervention. Tout est ici.</p>
 */
export default function QuoteMessageCard({ card }: { card: QuoteCardPayload }) {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const { hasAnyRole } = useAuth();
  // La decision appartient a la conciergerie et au proprietaire. Le serveur en
  // est l'autorite (`assertCanDecide`) ; l'ecran ne doit pas proposer un geste
  // qui sera refuse — l'intervenant voyait « Accepter » sur son propre devis.
  const canDecide = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST']);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const queryClient = useQueryClient();

  // L'etat de la decision vient du SERVEUR, pas d'un useState : la carte est
  // figee au moment ou le message a ete poste, et une pastille tenue en memoire
  // locale disparaissait au moindre remontage — un abandon de paiement, un
  // changement de conversation, un simple rechargement.
  const quotesKey = ['service-quotes', card.interventionId] as const;
  const { data: quotes } = useQuery({
    queryKey: quotesKey,
    queryFn: () => serviceQuotesApi.list(card.interventionId),
    staleTime: 30_000,
  });
  const status = quotes?.find((quote) => quote.id === card.quoteId)?.status ?? null;
  const decision = status === 'APPROVED' || status === 'REJECTED' ? status : null;

  const fileName = `devis-${card.quoteId}.pdf`;

  const loadPdf = async () => {
    if (blobUrl || loadingPdf || card.documentGenerationId == null) return;
    setLoadingPdf(true);
    try {
      setBlobUrl(await documentsApi.fetchGenerationBlobUrl(card.documentGenerationId));
    } catch {
      setBlobUrl(null);
    } finally {
      setLoadingPdf(false);
    }
  };

  // L'URL d'objet immobilise le PDF en memoire tant qu'on ne la libere pas.
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  const decide = async (accept: boolean) => {
    setDeciding(true);
    try {
      if (accept) {
        await serviceQuotesApi.approve(card.quoteId);
        notify.success(t('messagingHub.quote.approved', 'Devis approuvé'));
      } else {
        await serviceQuotesApi.reject(card.quoteId);
        notify.success(t('messagingHub.quote.rejected', 'Devis écarté'));
      }
      queryClient.invalidateQueries({ queryKey: quotesKey });
    } catch {
      notify.error(t('messagingHub.quote.decisionFailed', 'L’action a échoué, réessayez.'));
    } finally {
      setDeciding(false);
    }
  };

  return (
    <span className="flex w-full max-w-[340px] flex-col gap-2 p-3">
      {/* L'intervention concernee — sans elle, un montant flotte. */}
      <span className="flex items-start gap-2">
        <span className="mt-px inline-flex shrink-0 text-muted-foreground">
          <Home size={15} strokeWidth={1.75} />
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-foreground">
            {card.interventionTitle}
          </span>
          {card.propertyName && (
            <span className="block text-xs text-muted-foreground">{card.propertyName}</span>
          )}
          {card.propertyAddress && (
            <span className="mt-0.5 flex items-center gap-1 text-2xs text-faint">
              <LocationOn size={11} strokeWidth={1.75} />
              {card.propertyAddress}
            </span>
          )}
        </span>
      </span>

      <span className="flex flex-wrap items-baseline gap-x-2 border-t border-solid border-border pt-2">
        <span className="text-[17px] font-semibold tabular-nums text-foreground">
          {formatCurrency(card.amount, card.currency)}
        </span>
        {card.providerName && (
          <span className="text-xs text-muted-foreground">{card.providerName}</span>
        )}
        {decision && (
          <StatusChip
            tone={decision === 'APPROVED' ? 'ok' : 'neutral'}
            label={decision === 'APPROVED'
              ? t('interventions.quotes.status.APPROVED', 'Approuvé')
              : t('interventions.quotes.status.REJECTED', 'Écarté')}
            size="sm"
            dot
          />
        )}
      </span>

      {(card.lines?.length ?? 0) > 0 && (
        <span className="flex flex-col gap-0.5">
          {card.lines!.map((line, index) => (
            <span key={`${line.label}-${index}`} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-muted-foreground">
                {line.label}
                {line.quantity > 1 && <span className="ms-1 tabular-nums">× {line.quantity}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-foreground">
                {formatCurrency(line.unitPrice * (line.quantity || 1), card.currency)}
              </span>
            </span>
          ))}
        </span>
      )}

      {!decision && !canDecide && (
        <span className="border-t border-solid border-border pt-2 text-xs text-muted-foreground">
          {t('messagingHub.quote.awaitingDecision',
            'En attente de la décision du propriétaire ou de la conciergerie.')}
        </span>
      )}

      {card.depositAmount != null && card.depositAmount > 0 && (
        <span className="rounded-md bg-warning-soft px-2 py-1 text-xs text-warning-ink">
          {t('messagingHub.quote.deposit',
            'Acompte de {{amount}} à la validation ({{percent}} % du devis).', {
              amount: formatCurrency(card.depositAmount, card.currency),
              percent: card.depositPercent ?? 0,
            })}
        </span>
      )}

      {(card.earliestStartDate || card.validUntil) && (
        <span className="text-2xs tabular-nums text-faint">
          {[
            card.earliestStartDate && t('interventions.quotes.fromDate',
              'dispo. dès le {{date}}', { date: formatDate(card.earliestStartDate) }),
            card.validUntil && t('interventions.quotes.untilDate',
              'valable jusqu’au {{date}}', { date: formatDate(card.validUntil) }),
          ].filter(Boolean).join(' · ')}
        </span>
      )}

      {/* Le PDF, ouvrable sans quitter la discussion. */}
      {card.documentGenerationId != null && (
        <Dialog onOpenChange={(open) => { if (open) loadPdf(); }}>
          <Attachment className="w-full">
            <AttachmentMedia>
              <Receipt />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{fileName}</AttachmentTitle>
              <AttachmentDescription>
                {t('interventions.quotes.openPreview', 'Ouvrir l’aperçu')}
              </AttachmentDescription>
            </AttachmentContent>
            <DialogTrigger asChild>
              <AttachmentTrigger aria-label={t('interventions.quotes.preview', 'Aperçu du devis')} />
            </DialogTrigger>
          </Attachment>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{fileName}</DialogTitle>
            </DialogHeader>
            {loadingPdf ? (
              <div className="flex h-[60vh] items-center justify-center"><Spinner className="size-8" /></div>
            ) : blobUrl ? (
              <>
                <iframe src={blobUrl} title={fileName}
                  className="h-[60vh] w-full rounded-md border border-solid border-border" />
                <div className="flex justify-end text-xs">
                  <a href={blobUrl} target="_blank" rel="noopener noreferrer"
                    className="text-primary underline-offset-2 hover:underline">
                    {t('interventions.quotes.openInTab', 'Ouvrir dans un nouvel onglet')}
                  </a>
                </div>
              </>
            ) : (
              <p className="m-0 py-8 text-center text-sm text-muted-foreground">
                {t('interventions.quotes.previewFailed', 'Le document n’a pas pu être chargé.')}
              </p>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* La decision se prend ici : c'est le propriétaire ou la conciergerie
          qui tranche, et c'est dans ce fil qu'on leur a soumis le prix. */}
      {!decision && canDecide && (
        <span className="flex flex-wrap gap-2 border-t border-solid border-border pt-2">
          <Button variant="secondary" size="sm" disabled={deciding} onClick={() => decide(true)}>
            {deciding ? <Spinner className="size-4" /> : <CheckCircleOutline size={15} strokeWidth={2} />}
            {t('messagingHub.quote.accept', 'Accepter le devis')}
          </Button>
          <Button
            variant="ghost" size="sm" disabled={deciding}
            className="text-muted-foreground hover:text-destructive-ink"
            onClick={() => decide(false)}
          >
            {t('messagingHub.quote.reject', 'Refuser')}
          </Button>
        </span>
      )}
    </span>
  );
}

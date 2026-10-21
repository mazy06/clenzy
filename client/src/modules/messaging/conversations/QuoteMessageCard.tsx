import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Spinner,
} from '../../../components/ui';
import StatusChip from '../../../components/StatusChip';
import { CheckCircleOutline, Home, LocationOn } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { useNotification } from '../../../hooks/useNotification';
import { useAuth } from '../../../hooks/useAuth';
import { formatCurrency } from '../../../utils/currencyUtils';
import { formatDate } from '../../../utils/formatUtils';
import BaitlyQuoteDocument from '../../quotes/BaitlyQuoteDocument';
import { serviceQuotesApi } from '../../../services/api/serviceQuotesApi';
import { quoteRequestsApi } from '../../../services/api/quoteRequestsApi';
import type { QuoteCardPayload } from '../../../services/api/contactApi';
import { invalidateMissionWorkflow } from '../../../hooks/invalidateMissionWorkflow';
import QuoteAmendments from './QuoteAmendments';

/**
 * Devis presente DANS la discussion : le logement concerne, le detail chiffre,
 * le PDF a ouvrir sans quitter le fil, et la decision.
 *
 * <p>Le recapitulatif etait du texte : pour ouvrir le devis ou l'approuver, il
 * fallait retrouver l'intervention. Tout est ici.</p>
 */
export default function QuoteMessageCard({ card }: { card: QuoteCardPayload }) {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return <QuoteMessageContent key={JSON.stringify([user.id, user.organizationId, card.quoteId, card.marketplaceRequestId])} card={card} />;
}

function QuoteMessageContent({ card }: { card: QuoteCardPayload }) {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const { hasAnyRole, user } = useAuth();
  // La decision appartient a la conciergerie et au proprietaire. Le serveur en
  // est l'autorite (`assertCanDecide`) ; l'ecran ne doit pas proposer un geste
  // qui sera refuse — l'intervenant voyait « Accepter » sur son propre devis.
  const [deciding, setDeciding] = useState(false);
  const queryClient = useQueryClient();

  // L'etat de la decision vient du SERVEUR, pas d'un useState : la carte est
  // figee au moment ou le message a ete poste, et une pastille tenue en memoire
  // locale disparaissait au moindre remontage — un abandon de paiement, un
  // changement de conversation, un simple rechargement.
  const scope = JSON.stringify([user?.id, user?.organizationId]);
  const quotesKey = ['service-quotes', card.interventionId, scope] as const;
  const { data: quotes } = useQuery({
    queryKey: quotesKey,
    queryFn: () => serviceQuotesApi.list(card.interventionId!),
    enabled: card.marketplaceRequestId == null && card.interventionId != null,
    staleTime: 30_000,
    refetchInterval: 15_000,
  });
  const { data: request } = useQuery({
    queryKey: ['quote-requests', 'detail', card.marketplaceRequestId, scope],
    queryFn: () => quoteRequestsApi.getById(card.marketplaceRequestId!),
    enabled: card.marketplaceRequestId != null,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const { data: commercial } = useQuery({
    queryKey: ['service-quotes', 'marketplace', card.marketplaceRequestId, scope],
    queryFn: () => quoteRequestsApi.commercial(card.marketplaceRequestId!),
    enabled: card.marketplaceRequestId != null,
    staleTime: 10_000,
    refetchInterval: 15_000,
    retry: false,
  });
  const currentQuote = commercial ?? quotes?.find(quote => quote.id === card.quoteId);
  const status = currentQuote?.status ?? (card.marketplaceRequestId != null
    ? request?.status === 'ACCEPTED' ? 'APPROVED'
      : request?.status === 'DECLINED' ? 'REJECTED'
        : request?.status === 'QUOTED' && !request.expired ? 'RECEIVED' : null
    : null);
  const documentGenerationId = currentQuote ? currentQuote.documentGenerationId : card.documentGenerationId;
  const amount = currentQuote?.amount ?? card.amount;
  const currency = currentQuote?.currency ?? card.currency;
  const validUntil = currentQuote ? currentQuote.validUntil : card.validUntil;
  const lines = currentQuote?.lines ?? card.lines;
  const depositAmount = currentQuote ? currentQuote.depositAmount : card.depositAmount;
  const depositPercent = currentQuote ? currentQuote.depositPercent : card.depositPercent;
  const decision = status === 'APPROVED' || status === 'REJECTED' ? status : null;
  const canDecide = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'])
    && (card.marketplaceRequestId == null || request?.requesterOrganizationId === user?.organizationId);

  const interventionId = request?.interventionId ?? card.interventionId;

  const decide = async (accept: boolean) => {
    setDeciding(true);
    try {
      if (accept) {
        if (card.marketplaceRequestId != null) await quoteRequestsApi.accept(card.marketplaceRequestId);
        else await serviceQuotesApi.approve(card.quoteId);
        notify.success(t('messagingHub.quote.approved', 'Devis approuvé'));
      } else {
        if (card.marketplaceRequestId != null) await quoteRequestsApi.decline(card.marketplaceRequestId);
        else await serviceQuotesApi.reject(card.quoteId);
        notify.success(t('messagingHub.quote.rejected', 'Devis écarté'));
      }
      await invalidateMissionWorkflow(queryClient);
    } catch {
      void invalidateMissionWorkflow(queryClient);
      notify.error(t('messagingHub.quote.decisionFailed', 'L’action a échoué, réessayez.'));
    } finally {
      setDeciding(false);
    }
  };

  return (
    <article className="baitly-thread-quote" data-status={status ?? undefined}>
      {/* L'intervention concernee — sans elle, un montant flotte. */}
      <span className="baitly-thread-quote-heading">
        <span className="baitly-thread-quote-icon">
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
            <span className="mt-0.5 flex items-center gap-1 text-2xs text-muted-foreground">
              <LocationOn size={11} strokeWidth={1.75} />
              {card.propertyAddress}
            </span>
          )}
        </span>
      </span>

      <span className="baitly-thread-quote-summary">
        {status === 'APPROVED' && <span className="text-xs text-muted-foreground">{t('quoteAmendments.initial')}</span>}
        <span className="baitly-thread-quote-amount">
          {formatCurrency(amount, currency)}
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

      {(lines?.length ?? 0) > 0 && (
        <span className="flex flex-col gap-0.5">
          {lines!.map((line, index) => (
            <span key={`${line.label}-${index}`} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-muted-foreground">
                {line.label}
                {line.quantity > 1 && <span className="ms-1 tabular-nums">× {line.quantity}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-foreground">
                {formatCurrency(line.unitPrice * (line.quantity || 1), currency)}
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

      {depositAmount != null && depositAmount > 0 && (
        <span className="rounded-md bg-warning-soft px-2 py-1 text-xs text-warning-ink">
          {t('messagingHub.quote.deposit',
            'Acompte de {{amount}} à la validation ({{percent}} % du devis).', {
              amount: formatCurrency(depositAmount, currency),
              percent: depositPercent ?? 0,
            })}
        </span>
      )}

      {(card.earliestStartDate || validUntil) && (
        <span className="text-2xs tabular-nums text-muted-foreground">
          {[
            card.earliestStartDate && t('interventions.quotes.fromDate',
              'dispo. dès le {{date}}', { date: formatDate(card.earliestStartDate) }),
            validUntil && t('interventions.quotes.untilDate',
              'valable jusqu’au {{date}}', { date: formatDate(validUntil) }),
          ].filter(Boolean).join(' · ')}
        </span>
      )}

      {/* Le PDF, ouvrable sans quitter la discussion. */}
      {documentGenerationId != null && <BaitlyQuoteDocument generationId={documentGenerationId} quoteId={commercial?.id ?? card.quoteId} />}

      {interventionId != null && (
        <Link to={`/interventions/${interventionId}`}
          className="baitly-thread-quote-link">
          {t('payments.history.viewIntervention', "Voir l'intervention")}
        </Link>
      )}

      {status === 'APPROVED' && interventionId != null && (
        <QuoteAmendments key={commercial?.id ?? card.quoteId} quoteId={commercial?.id ?? card.quoteId} />
      )}

      {status === 'RECEIVED' && !request?.expired && canDecide && (
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
    </article>
  );
}

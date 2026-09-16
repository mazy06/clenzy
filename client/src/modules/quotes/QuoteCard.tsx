import { useTranslation } from '../../hooks/useTranslation';
import { Card } from '../../components/ui';
import { Link } from 'react-router-dom';
import StatusChip from '../../components/baitly/StatusChip';
import { cn } from '../../utils/cn';
import {
  formatAmount,
  formatDate,
  PROVIDER_STATUS_LABELS,
  REQUESTER_STATUS_LABELS,
  STATUS_TONES,
} from './quotePresentation';
import type { QuoteRequestDto } from '../../services/api/quoteRequestsApi';

/**
 * Une demande de devis dans une liste.
 *
 * <p>Le même composant sert les deux côtés, avec des libellés différents : un
 * même état ne se dit pas pareil selon qu'on attend une réponse ou qu'on doit
 * la donner.</p>
 */
export default function QuoteCard({ quote, side, actions }: {
  quote: QuoteRequestDto;
  side: 'requester' | 'provider';
  actions?: React.ReactNode;
}) {
  const { t, currentLanguage } = useTranslation();
  const labels = side === 'provider' ? PROVIDER_STATUS_LABELS : REQUESTER_STATUS_LABELS;
  const counterpart = side === 'provider'
    ? quote.requesterOrganizationName ?? t('marketplaceQuotes.organization', { id: quote.requesterOrganizationId })
    : quote.providerName ?? t('marketplaceQuotes.provider', { id: quote.providerId });

  return (
    <Card className={cn('shrink-0 gap-0 px-4 py-3.5', quote.expired && 'border-destructive/40')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 truncate text-sm font-semibold text-foreground">{quote.title}</p>
          <p className="m-0 mt-0.5 text-xs text-muted-foreground">
            {counterpart} · {t('marketplaceQuotes.requestedOn', { date: formatDate(quote.createdAt, currentLanguage) })}
            {quote.propertyId ? ' · ' + t('marketplaceQuotes.property', { id: quote.propertyId }) : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusChip size="sm" tone={STATUS_TONES[quote.status]} label={t('marketplaceQuotes.status.' + side + '.' + quote.status, labels[quote.status])} />
          {/* Un devis périmé garde l'état QUOTED côté serveur : la date ne ment
              pas, mais l'écran doit le dire avant qu'on clique « Accepter ». */}
          {quote.expired && <StatusChip size="sm" tone="err" label={t('marketplaceQuotes.expired')} />}
        </div>
      </div>

      {quote.message && (
        <p className="m-0 mt-2 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
          {quote.message}
        </p>
      )}

      {quote.desiredDate && <p className="m-0 mt-2 text-xs tabular-nums">{t('marketplaceWorkflow.date')}: {formatDate(quote.desiredDate, currentLanguage)}</p>}
      {quote.requestedStartTime && <p className="m-0 mt-1 text-xs tabular-nums">{t('quoteReplacement.slot', { time: quote.requestedStartTime.slice(0, 5), minutes: quote.requestedDurationMinutes ?? '—' })}</p>}
      {quote.replacesQuoteId && side === 'requester' && <p className="m-0 mt-1 text-xs text-muted-foreground">{t('quoteReplacement.origin', { id: quote.replacesQuoteId })}</p>}

      {quote.quotedAt && (
        <div className="mt-2.5 rounded-md bg-muted px-2.5 py-2">
          <p className="m-0 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold tabular-nums text-foreground">
              {formatAmount(quote.quotedAmount, quote.quotedCurrency, currentLanguage)}
            </span>
            <span className="text-xs text-muted-foreground">
              {quote.quoteValidUntil
                ? t('marketplaceQuotes.validThrough', { date: formatDate(quote.quoteValidUntil, currentLanguage) })
                : t('marketplaceQuotes.noExpiry')}
            </span>
          </p>
          {quote.quoteMessage && (
            <p className="m-0 mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
              {quote.quoteMessage}
            </p>
          )}
        </div>
      )}

      {quote.decisionReason && (
        <p className="m-0 mt-2 text-xs leading-relaxed text-muted-foreground">
          {t('marketplaceQuotes.reason')} : {quote.decisionReason}
        </p>
      )}

      {quote.interventionId && (
        <p className="m-0 mt-2 text-xs text-muted-foreground">
          <Link className="underline underline-offset-2" to={`/interventions/${quote.interventionId}`}>
            {t('marketplaceQuotes.openMission', { id: quote.interventionId })}
          </Link>
        </p>
      )}

      {actions && <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-2.5">{actions}</div>}
    </Card>
  );
}

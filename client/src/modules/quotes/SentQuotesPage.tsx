import { useTranslation } from '../../hooks/useTranslation';
import { Link } from "react-router-dom";
import PagePagination from "../../components/PagePagination";
import { useState } from 'react';
import { useUserPreference } from '../../hooks/useUserPreference';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { Button, Skeleton, Textarea } from '../../components/ui';
import { RequestQuote } from '../../icons';
import QuoteCard from './QuoteCard';
import QuoteRecurrencePanel from './QuoteRecurrencePanel';
import QuoteReviewPanel from './QuoteReviewPanel';
import { REQUESTER_FILTERS } from './quotePresentation';
import { useQuoteTransition, useSentQuotes } from '../../hooks/useQuoteRequests';
import type { QuoteRequestDto } from '../../services/api/quoteRequestsApi';

/**
 * Les devis que mon organisation a demandés.
 *
 * <p>L'ordre des filtres suit ce qui demande une action : « à décider » avant
 * « en attente », parce que c'est là que quelqu'un doit faire quelque chose.</p>
 */
export default function SentQuotesPage() {
  const { t } = useTranslation();
  const [storedFilter, setFilterIndex] = useUserPreference<number>('marketplace.requester.filter', 0);
  const filterIndex = [0, 1, 2, 3].includes(storedFilter) ? storedFilter : 0;
  const [page, setPage] = useState(0);
  const [decliningId, setDecliningId] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  const filter = REQUESTER_FILTERS[filterIndex];
  const { data, isLoading, isError } = useSentQuotes(filter.statuses, page);
  const transition = useQuoteTransition();

  const actionsFor = (quote: QuoteRequestDto) => {
    if (quote.status === 'QUOTED') {
      return (
        <>
          <Button
            size="sm"
            // Un devis périmé ne s'accepte pas : le serveur refuse, autant ne
            // pas proposer le geste.
            disabled={quote.expired || transition.isPending}
            title={quote.expired ? t('marketplaceQuotes.expiredHint') : undefined}
            onClick={() => transition.mutate({ id: quote.id, action: 'accept' })}
          >
            {t('marketplaceQuotes.accept')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={transition.isPending}
            onClick={() => { setDecliningId(quote.id); setReason(''); }}
          >
            {t('marketplaceQuotes.decline')}
          </Button>
        </>
      );
    }
    if (quote.status === 'SENT') {
      return (
        <Button
          size="sm"
          variant="outline"
          disabled={transition.isPending}
          onClick={() => transition.mutate({ id: quote.id, action: 'withdraw' })}
        >
          {t('marketplaceQuotes.withdraw')}
        </Button>
      );
    }
    return null;
  };

  return (
    <>
      <PageHeader
        actions={<Button variant="outline" size="sm" asChild><Link to="/devis/recus">{t('marketplaceQuotes.received')}</Link></Button>}
        title={t('marketplaceQuotes.sentTitle')}
        subtitle={t('marketplaceQuotes.sentHelp')}
      />

      <div className="flex shrink-0 flex-wrap gap-2">
        {REQUESTER_FILTERS.map((option, index) => (
          <Button
            key={t('marketplaceQuotes.' + ["all", "toDecide", "waiting", "accepted"][index])}
            size="sm"
            variant={index === filterIndex ? 'default' : 'outline'}
            aria-pressed={index === filterIndex}
            onClick={() => { setFilterIndex(index); setPage(0); }}
          >
            {t('marketplaceQuotes.' + ["all", "toDecide", "waiting", "accepted"][index])}
          </Button>
        ))}
      </div>

      {transition.isError && <p role="alert" className="text-sm text-destructive-ink">
        {(transition.error as Error)?.message || t('marketplaceWorkflow.sendFailed')}
      </p>}
      {isLoading && (
        <div className="mt-4 flex shrink-0 flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[120px] w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && <p role="alert" className="text-sm text-destructive-ink">{t('marketplaceWorkflow.loadFailed')}</p>}
      {data && data.items.length === 0 && (
        <div className="mt-4 shrink-0">
          <EmptyState
            icon={<RequestQuote />}
            title={t('marketplaceQuotes.emptySent')}
            description={t('marketplaceQuotes.emptySentHelp')}
          />
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="mt-4 flex shrink-0 flex-col gap-3">
          {data.items.map((quote) => (
            <div key={quote.id}>
              <QuoteCard quote={quote} side="requester" actions={actionsFor(quote)} />
              {quote.status === 'ACCEPTED' && quote.interventionId && <QuoteRecurrencePanel quoteId={quote.id} />}
              {quote.status === 'ACCEPTED' && quote.interventionId && <QuoteReviewPanel quoteId={quote.id} />}
              {decliningId === quote.id && quote.status === 'QUOTED' && (
                <div className="mt-2 flex flex-col gap-2 rounded-md border border-border px-3 py-2.5">
                  <Textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder={t('marketplaceQuotes.declinePlaceholder')}
                    aria-label={t('marketplaceQuotes.declineReason')}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={transition.isPending}
                      onClick={() => transition.mutate(
                        { id: quote.id, action: 'decline', reason: reason.trim() || undefined },
                        { onSuccess: () => setDecliningId(null) },
                      )}
                    >
                      {t('marketplaceQuotes.confirmDecline')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDecliningId(null)}>
                      {t('marketplaceQuotes.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <PagePagination page={page} onPageChange={setPage} totalPages={data.totalPages} />
        </div>
      )}
    </>
  );
}

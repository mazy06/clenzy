import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useUserPreference } from '../../hooks/useUserPreference';
import { useBaitlyQuotes, useBaitlyQuoteDecision, type BaitlyQuoteEntry, type BaitlyQuoteView } from '../../hooks/useBaitlyQuotes';
import ModuleFirstUsePage from '../../components/first-use/ModuleFirstUsePage';
import PageHeader from '../../components/PageHeader';
import PagePagination from '../../components/PagePagination';
import EmptyState from '../../components/EmptyState';
import { Button, Skeleton, Textarea } from '../../components/ui';
import { RequestQuote } from '../../icons';
import { ArrowUpRight, MessageSquare } from '../../icons/glyphs';
import FinanceWorkspace, { type FinanceRecord } from '../billing/components/FinanceWorkspace';
import StatusChip from '../../components/StatusChip';
import BaitlyQuoteDocument from './BaitlyQuoteDocument';
import { formatAmount, formatDate } from './quotePresentation';
import { quoteInboxMessages } from './baitlyQuoteInboxMessages';
import BaitlyQuoteStatusFilter from './BaitlyQuoteStatusFilter';
import QuoteRecurrencePanel from './QuoteRecurrencePanel';
import QuoteReviewPanel from './QuoteReviewPanel';
import './baitly-quotes.css';

const VIEWS: BaitlyQuoteView[] = ['ALL', 'DECIDE', 'WAITING', 'ACCEPTED', 'CLOSED'];

/** Tous les devis accessibles, indépendamment de leur parcours de création. */
export default function SentQuotesPage() {
  const { t, currentLanguage } = useTranslation();
  const copy = quoteInboxMessages(currentLanguage);
  const [storedFilter, setFilterIndex] = useUserPreference<number>('marketplace.requester.filter', 0);
  const filterIndex = VIEWS[storedFilter] ? storedFilter : 0;
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [decliningKey, setDecliningKey] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const { data, isLoading, isError } = useBaitlyQuotes(VIEWS[filterIndex], page, rowsPerPage);
  const transition = useBaitlyQuoteDecision();
  const reset = () => { setFilterIndex(0); setPage(0); setSelectedId(null); };
  const changePage = (next: number) => { setPage(next); setSelectedId(null); setDecliningKey(null); };
  const changePageSize = useCallback((measured: number) => {
    const next = Math.min(50, measured);
    if (next !== rowsPerPage) { setRowsPerPage(next); setPage(0); }
  }, [rowsPerPage]);
  const actionsFor = (entry: BaitlyQuoteEntry) => entry.canDecide ? <>
    <Button size="sm" disabled={transition.isPending} onClick={() => transition.mutate({ entry, action: 'accept' })}>
      {t('marketplaceQuotes.accept')}</Button>
    <Button size="sm" variant="outline" disabled={transition.isPending} onClick={() => {
      if (entry.requestId != null) { setDecliningKey(entry.key); setReason(''); }
      else transition.mutate({ entry, action: 'decline' });
    }}>{t('marketplaceQuotes.decline')}</Button>
  </> : entry.canWithdraw ? <Button size="sm" variant="outline" disabled={transition.isPending}
    onClick={() => transition.mutate({ entry, action: 'withdraw' })}>{t('marketplaceQuotes.withdraw')}</Button> : undefined;

  const records: FinanceRecord[] = !isError ? (data?.items ?? []).map(entry => {
    const changed = entry.originalAmount != null && entry.agreedAmount != null && entry.originalAmount !== entry.agreedAmount;
    const label = entry.quoteId != null
      ? entry.expired ? copy.expired : copy.status[entry.status as keyof typeof copy.status] ?? entry.status
      : t(`marketplaceQuotes.status.${entry.customerSide ? 'requester' : 'provider'}.${entry.status}`, entry.status);
    const tone = entry.stage === 'ACCEPTED' ? 'ok' : entry.stage === 'DECIDE' ? 'info' : entry.expired ? 'warn' : 'neutral';
    const record: FinanceRecord = {
      id: entry.key,
      title: <span className="baitly-quotes-row-title"><span>{entry.title || copy.reference(entry.quoteId ?? entry.requestId)}</span>
        <small>{[entry.propertyName, entry.providerName].filter(Boolean).join(' · ')}</small></span>,
      subtitle: copy.reference(entry.quoteId ?? entry.requestId),
      amount: formatAmount(entry.agreedAmount ?? undefined, entry.currency ?? undefined, currentLanguage),
      status: <StatusChip tone={tone} label={label} size="sm" dot />,
      headerActions: <nav className="baitly-quotes-header-actions" aria-label={copy.links}>
        {entry.discussionUrl && <Button variant="outline" size="icon-sm" asChild>
          <Link to={entry.discussionUrl} title={copy.discussion} aria-label={copy.discussion}><MessageSquare size={17} aria-hidden /></Link>
        </Button>}
        {(entry.interventionId != null || entry.serviceRequestId != null) && <Button variant="outline" size="icon-sm" asChild>
          <Link to={entry.interventionId != null ? `/interventions/${entry.interventionId}` : `/service-requests/${entry.serviceRequestId}`}
            title={copy.service} aria-label={copy.service}><ArrowUpRight size={17} aria-hidden /></Link>
        </Button>}
      </nav>,
      fields: [
        { label: copy.provider, value: entry.providerName || copy.notSpecified },
        { label: copy.property, value: entry.propertyName || copy.notSpecified },
        { label: copy.created, value: formatDate(entry.createdAt, currentLanguage) },
        ...(entry.validUntil ? [{ label: copy.validUntil, value: formatDate(entry.validUntil, currentLanguage) }] : []),
        ...(changed ? [{ label: copy.originalAmount, value: formatAmount(entry.originalAmount!, entry.currency ?? undefined, currentLanguage) }] : []),
      ],
      actions: actionsFor(entry),
      detail: <div className="baitly-quotes-detail" key={entry.key}>
        {decliningKey === entry.key && entry.canDecide && <div className="flex flex-col gap-2 py-3">
          <Textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={2}
            placeholder={t('marketplaceQuotes.declinePlaceholder')} aria-label={t('marketplaceQuotes.declineReason')} />
          <div className="flex gap-2"><Button size="sm" disabled={transition.isPending} onClick={() => transition.mutate(
            { entry, action: 'decline', reason: reason.trim() || undefined }, { onSuccess: () => setDecliningKey(null) })}>{t('marketplaceQuotes.confirmDecline')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setDecliningKey(null)}>{t('marketplaceQuotes.cancel')}</Button></div>
        </div>}
        <section className="baitly-quotes-document" aria-label={copy.document}>
          {entry.documentGenerationId != null && entry.quoteId != null
            ? <BaitlyQuoteDocument generationId={entry.documentGenerationId} quoteId={entry.quoteId} inlinePreview />
            : <p>{copy.noDocument}</p>}
        </section>
        {entry.requestId != null && entry.stage === 'ACCEPTED' && entry.interventionId != null && <>
          <QuoteRecurrencePanel quoteId={entry.requestId} /><QuoteReviewPanel quoteId={entry.requestId} /></>}
      </div>,
    };
    return { ...record, detailBody: <div className="baitly-quotes-dossier">
      <div className="baitly-quotes-summary">
        <div className="baitly-quotes-summary-value"><strong>{record.amount}</strong>{record.status}</div>
        <dl>{record.fields.map((field, index) => <div key={index}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
        {record.actions && <div className="baitly-quotes-decisions">{record.actions}</div>}
      </div>
      {record.detail}
    </div> };
  }) : [];

  return <ModuleFirstUsePage module="quotes" ready={!isLoading && !isError && !!data && filterIndex === 0 && page === 0} hasContent={(data?.items.length ?? 0) > 0}>
    <PageHeader title={copy.title} subtitle={copy.help}
      filtersActive={filterIndex !== 0}
      inlineControls={<BaitlyQuoteStatusFilter value={VIEWS[filterIndex]} onChange={view => { setFilterIndex(VIEWS.indexOf(view)); changePage(0); }} />}
      actions={<Button variant="outline" size="sm" asChild><Link to="/devis/recus">{t('marketplaceQuotes.received')}</Link></Button>} />
    <section className="baitly-quotes-page" aria-label={copy.title} aria-busy={isLoading}>
      {transition.isError && <p role="alert" className="text-sm text-destructive-ink">{t('messagingHub.quote.decisionFailed', 'L’action a échoué, réessayez.')}</p>}
      {isError && <p role="alert" className="text-sm text-destructive-ink">{t('marketplaceWorkflow.loadFailed')}</p>}
      {!isError && data && data.items.length === 0 && <div className="baitly-quotes-workspace"><div className="baitly-quotes-empty"><EmptyState icon={<RequestQuote />} variant="transparent" minHeight={280}
        title={t(filterIndex === 0 ? 'marketplaceQuotes.startTitle' : 'marketplaceQuotes.emptyFilteredTitle')}
        description={t(filterIndex === 0 ? 'marketplaceQuotes.emptySentHelp' : 'marketplaceQuotes.emptyFilteredHelp')}
        action={filterIndex === 0 ? <Button asChild><Link to="/prestataires?view=catalog">{t('marketplaceQuotes.findProvider')}</Link></Button>
          : <Button variant="outline" onClick={reset}>{t('marketplaceQuotes.showAllRequests')}</Button>} /></div></div>}
      {!isError && (isLoading || !!data?.items.length) && <div className="baitly-quotes-list">
        <FinanceWorkspace items={records} selectedId={selectedId} onSelect={id => { setSelectedId(id); setDecliningKey(null); }}
          onPageSizeChange={changePageSize}
          pagination={<PagePagination compact hideOnSinglePage={false} page={page} onPageChange={changePage}
            rowsPerPage={rowsPerPage} count={data?.totalElements ?? 0} totalPages={data?.totalPages} />} />
        {isLoading && <div className="baitly-quotes-loading" role="status" aria-label={t('common.loading', 'Chargement')}>
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-12 w-full rounded-md" />)}
        </div>}
      </div>}
    </section>
  </ModuleFirstUsePage>;
}

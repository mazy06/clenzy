import QuoteFinancialCase from './QuoteFinancialCase';
import { useId, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Textarea } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { serviceQuotesApi } from '../../../services/api/serviceQuotesApi';
import { invalidateMissionWorkflow } from '../../../hooks/invalidateMissionWorkflow';
import { formatDate } from '../../quotes/quotePresentation';

/** Décision explicite depuis le fil contractuel ; aucune réaffectation implicite. */
export default function QuoteCancellation({ quoteId, accountScope }: { quoteId: number; accountScope: string }) {
  const { t, currentLanguage } = useTranslation();
  const client = useQueryClient();
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const submitting = useRef(false);
  const query = useQuery({
    queryKey: ['service-quotes', quoteId, 'cancellation', accountScope],
    queryFn: () => serviceQuotesApi.cancellation(quoteId),
    staleTime: 10_000, refetchInterval: 15_000, retry: false,
  });
  const data = query.isError ? undefined : query.data;
  const cancel = async () => {
    if (submitting.current || !data?.canCancel || !reason.trim()) return;
    submitting.current = true; setBusy(true); setError(false);
    try {
      await serviceQuotesApi.cancelAgreement(quoteId, data.missionVersion, reason.trim());
      setReason(''); setExpanded(false);
      await invalidateMissionWorkflow(client);
    } catch {
      setError(true);
      await invalidateMissionWorkflow(client);
    } finally { submitting.current = false; setBusy(false); }
  };
  return <div className="flex min-w-0 flex-col gap-2 border-t border-solid border-border pt-2 text-xs" aria-busy={busy}>
    {query.isPending && <span role="status">{t('quoteCancellation.loading')}</span>}
    {query.isError && <span role="alert">
      {t('quoteCancellation.loadFailed')}
      <Button variant="ghost" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>{t('quoteCancellation.retry')}</Button>
    </span>}
    {data?.cancelledAt ? <>
      <strong>{t('quoteCancellation.cancelled')}</strong>
      <span className="tabular-nums">{formatDate(data.cancelledAt, currentLanguage)}</span>
      <span className="whitespace-pre-wrap break-words">{data.reason}</span>
      <span>{t('quoteCancellation.replacement')}</span>
      <a href={`/prestataires?replaceQuoteId=${quoteId}`} className="cursor-pointer underline focus-visible:outline focus-visible:outline-2">{t('quoteCancellation.findProvider')}</a>
    </> : data?.canCancel ? <>
      <Button variant="ghost" size="sm" aria-expanded={expanded} aria-controls={id}
        disabled={busy} onClick={() => setExpanded(!expanded)}>{t('quoteCancellation.title')}</Button>
      {expanded && <span id={id} className="flex flex-col gap-2">
        <span>{t('quoteCancellation.explanation')}</span>
        <label htmlFor={id + '-reason'}>{t('quoteCancellation.reason')}</label>
        <Textarea id={id + '-reason'} value={reason} maxLength={1000} disabled={busy}
          onChange={event => setReason(event.target.value)} />
        <Button variant="destructive" size="sm" disabled={busy || query.isFetching || !reason.trim()}
          onClick={() => void cancel()}>{t('quoteCancellation.confirm')}</Button>
      </span>}
    </> : data?.unavailableReason === 'PAYMENT_REVIEW_REQUIRED' ?
      <span>{t('quoteCancellation.paymentPending')}</span> : data?.unavailableReason === 'LINKED_REQUEST' ?
      <span>{t('quoteCancellation.linkedRequest')}</span> : data?.unavailableReason === 'NO_MISSION' &&
      <span>{t('quoteCancellation.noMission')}</span>}
    {data?.cancelledAt && <QuoteFinancialCase quoteId={quoteId} accountScope={accountScope} />}
    {error && <span role="alert">{t('quoteCancellation.failed')}</span>}
  </div>;
}

import { useId, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Textarea } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAuth } from '../../../contexts/AuthContext';
import { invalidateMissionWorkflow } from '../../../hooks/invalidateMissionWorkflow';
import { serviceQuotesApi, type QuoteAmendment } from '../../../services/api/serviceQuotesApi';
import { formatCurrency } from '../../../utils/currencyUtils';
import { formatDate } from '../../../utils/formatUtils';
import QuoteCancellation from './QuoteCancellation';

/** Accord courant et avenants dans le fil du devis Baitly. */
export default function QuoteAmendments({ quoteId }: { quoteId: number }) {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  const accountScope = JSON.stringify([user.id, user.organizationId]);
  // Réinitialiser également le brouillon et les actions en cours, pas seulement le cache.
  return <span key={`${accountScope}:${quoteId}`} className="flex flex-col gap-2">
    <QuoteAmendmentPanel quoteId={quoteId} accountScope={accountScope} />
    <QuoteCancellation quoteId={quoteId} accountScope={accountScope} />
  </span>;
}

function QuoteAmendmentPanel({ quoteId, accountScope }: { quoteId: number; accountScope: string }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const query = useQuery({
    queryKey: ['service-quotes', quoteId, 'amendment-panel', accountScope],
    queryFn: async () => {
      const [agreement, amendments, access] = await Promise.all([
        serviceQuotesApi.agreement(quoteId), serviceQuotesApi.amendments(quoteId), serviceQuotesApi.amendmentAccess(quoteId),
      ]);
      return { agreement, amendments, access };
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
    retry: false,
  });
  // React Query conserve les dernières données après une erreur de rafraîchissement.
  // Un refus d'accès doit masquer l'accord et son historique immédiatement.
  const data = query.isError ? undefined : query.data;
  const run = async (action: () => Promise<unknown>, proposal = false) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      if (proposal) { setAmount(''); setReason(''); }
      await invalidateMissionWorkflow(client);
    } catch (failure) {
      setError(failure && typeof failure === 'object' && 'message' in failure && typeof failure.message === 'string'
        ? failure.message : t('quoteAmendments.failed'));
      void invalidateMissionWorkflow(client);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const decide = (amendment: QuoteAmendment, decision: 'accept' | 'reject' | 'withdraw') =>
    run(() => serviceQuotesApi.decideAmendment(amendment.id, amendment.version, decision));
  const download = (amendment: QuoteAmendment) => run(async () => {
    try { await serviceQuotesApi.downloadAmendment(amendment.id); }
    catch { throw new Error(t('quoteAmendments.pdfFailed')); }
  });
  const normalized = amount.trim().replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776)).replace(/[٫,]/g, '.');
  const validAmount = /^\d+(\.\d{1,2})?$/.test(normalized) && Number.isFinite(Number(normalized))
    && Number(normalized) <= 9999999999.99 && Number(normalized) !== data?.agreement.agreedAmount;
  const disabled = busy || query.isFetching || query.isError;

  return <span className="flex min-w-0 flex-col gap-2 border-t border-solid border-border pt-2 text-xs" aria-busy={busy}>
    {query.isPending ? <span role="status">{t('quoteAmendments.loading')}</span> : data &&
      <span className="flex flex-wrap items-baseline justify-between gap-2">
        <span>{t('quoteAmendments.current')}</span>
        <strong className="tabular-nums">{formatCurrency(data.agreement.agreedAmount, data.agreement.currency)}</strong>
      </span>}
    {query.isError && <span role="alert" className="text-[var(--bui-destructive-ink)]">
      {t('quoteAmendments.loadFailed')}
      <Button variant="ghost" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>{t('quoteAmendments.retry')}</Button>
    </span>}
    <Button variant="ghost" size="sm" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}>
      {t('quoteAmendments.title')}
    </Button>
    {expanded && <span id={id} className="flex min-w-0 flex-col gap-3">
      <span className="text-muted-foreground">{t('quoteAmendments.initialPreserved')}</span>
      {error && <span role="alert" className="text-[var(--bui-destructive-ink)]">{error}</span>}
      {data && <>
        {!data.access.canPropose && !data.access.canAccept &&
          <span className="text-muted-foreground">{t('quoteAmendments.unavailable')}</span>}
        {data.amendments.length === 0 && <span className="text-muted-foreground">{t('quoteAmendments.empty')}</span>}
        <span role="list" className="flex max-h-80 flex-col gap-3 overflow-y-auto">
          {data.amendments.map(amendment => <span role="listitem" key={amendment.id} className="flex flex-col gap-1 border-b border-solid border-border pb-2">
            <span className="font-medium">{t(`quoteAmendments.status.${amendment.status}`)}</span>
            <span className="tabular-nums">{formatCurrency(amendment.originalAmount, amendment.currency)} → {formatCurrency(amendment.proposedAmount, amendment.currency)}</span>
            <span className="whitespace-pre-wrap break-words">{amendment.reason}</span>
            <span className="tabular-nums text-muted-foreground">{formatDate(amendment.decidedAt ?? amendment.createdAt)}</span>
            {amendment.status === 'ACCEPTED' && <Button size="sm" variant="ghost" disabled={disabled}
              onClick={() => void download(amendment)}>{t('quoteAmendments.downloadPdf')}</Button>}
            {amendment.status === 'PROPOSED' && <span className="flex flex-wrap gap-2">
              {data.access.canDecide && amendment.proposedBy !== data.access.actorId && <>
                {data.access.canAccept && <Button size="sm" variant="secondary" disabled={disabled} onClick={() => void decide(amendment, 'accept')}>{t('quoteAmendments.accept')}</Button>}
                <Button size="sm" variant="ghost" disabled={disabled} onClick={() => void decide(amendment, 'reject')}>{t('quoteAmendments.reject')}</Button>
              </>}
              {data.access.canWithdrawOwn && amendment.proposedBy === data.access.actorId &&
                <Button size="sm" variant="ghost" disabled={disabled} onClick={() => void decide(amendment, 'withdraw')}>{t('quoteAmendments.withdraw')}</Button>}
            </span>}
          </span>)}
        </span>
        {data.access.canPropose && <span className="flex flex-col gap-2">
          <label htmlFor={`${id}-amount`}>{t('quoteAmendments.amount', { currency: data.agreement.currency })}</label>
          <Input id={`${id}-amount`} inputMode="decimal" value={amount} disabled={busy} onChange={event => setAmount(event.target.value)} className="min-w-0 tabular-nums" />
          <label htmlFor={`${id}-reason`}>{t('quoteAmendments.reason')}</label>
          <Textarea id={`${id}-reason`} value={reason} maxLength={1000} disabled={busy} onChange={event => setReason(event.target.value)} />
          <Button size="sm" variant="secondary" disabled={disabled || !validAmount || !reason.trim()}
            onClick={() => void run(() => serviceQuotesApi.proposeAmendment(quoteId, Number(normalized), reason.trim()), true)}>
            {t('quoteAmendments.propose')}
          </Button>
        </span>}
      </>}
    </span>}
  </span>;
}

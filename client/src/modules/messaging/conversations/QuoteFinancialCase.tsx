import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Skeleton, Textarea } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import apiClient from '../../../services/apiClient';

interface Payment { id: number; provider: string; currency: string | null; collected: number; refunded: number; shared: boolean; state: string }
interface Decision { id: string; payment_id: number; amount: number; reason: string; state: string; error: string | null; refund_ref?: string | null }
interface View { canManage: boolean; dossier: { version: number; state: string; accounting_state: string; amount_due: number | null; agreed_amount: number; currency: string; last_error: string | null } | null;
  payments: Payment[]; decisions: Decision[]; events: { id: number; action: string; detail: string; created_at: string }[] }

function digits(currency: string) { return ['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'].includes(currency.toUpperCase()) ? 0 : 2; }

export default function QuoteFinancialCase({ quoteId, accountScope }: { quoteId: number; accountScope: string }) {
  const { t, currentLanguage } = useTranslation();
  const client = useQueryClient();
  const key = ['mission-financial', quoteId, accountScope];
  const path = `/service-quotes/${quoteId}/financial-case`;
  const query = useQuery({ queryKey: key, queryFn: () => apiClient.get<View>(path), refetchInterval: 15_000, retry: false });
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState('');
  const [amountDue, setAmountDue] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [refundRef, setRefundRef] = useState('');
  const [allocation, setAllocation] = useState('');
  const [externalPaymentId, setExternalPaymentId] = useState('');
  const [externalCurrency, setExternalCurrency] = useState('');
  const [externalCollected, setExternalCollected] = useState('');
  const [externalRefunded, setExternalRefunded] = useState('');
  const externalProviders = ['PAYTABS', 'CMI', 'PAYZONE', 'PAYPAL'];
  const submitting = useRef(false);
  const mutation = useMutation({ mutationFn: (body: object) => apiClient.post<View>(path, body),
    onSettled: () => client.invalidateQueries({ queryKey: key }) });
  const data = query.isError ? undefined : query.data;
  const selected = data?.payments.find(p => p.id === Number(paymentId));
  const money = (minor: number, currency: string | null) => currency
    ? new Intl.NumberFormat(currentLanguage, { style: 'currency', currency }).format(minor / 10 ** digits(currency)) : '…';
  const send = async (action: string, decisionId?: string) => {
    if (submitting.current || !data?.dossier || !reason.trim()) return;
    const minor = selected?.currency ? Math.round(Number(amount) * 10 ** digits(selected.currency)) : undefined;
    if (action === 'PROPOSE' && (!minor || !Number.isSafeInteger(minor))) return;
    submitting.current = true;
    try {
      await mutation.mutateAsync({ version: data.dossier.version, action, decisionId,
        allocation: action === 'PROPOSE' && selected?.shared && selected.currency ? Math.round(Number(allocation) * 10 ** digits(selected.currency)) : undefined, amountDue: action === 'ASSESS' ? amountDue ?? String(data.dossier.amount_due ?? 0) : undefined, paymentId: action === 'VERIFY_EXTERNAL' ? Number(externalPaymentId) : selected?.id, external: action === 'VERIFY_EXTERNAL' ? { currency: externalCurrency.toUpperCase(), collected: Math.round(Number(externalCollected) * 10 ** digits(externalCurrency)), refunded: Math.round(Number(externalRefunded) * 10 ** digits(externalCurrency)) } : undefined, amount: action === 'PROPOSE' ? minor : undefined, reason: reason.trim(), evidence: action === 'RECONCILE' ? refundRef.trim() : evidence.trim() || undefined });
      setReason(''); setAmount(''); setEvidence('');
    } catch { /* Erreur visible, aucune confirmation de remboursement anticipée. */ }
    finally { submitting.current = false; }
  };
  if (query.isPending) return <Skeleton className="h-12 w-full" />;
  if (query.isError) return <span role="alert">{t('financialCase.error')} <Button variant="ghost" onClick={() => void query.refetch()}>{t('financialCase.refresh')}</Button></span>;
  if (!data?.canManage || !data.dossier) return null;
  const disabled = mutation.isPending || query.isFetching || !reason.trim();
  return <section className="flex min-w-0 flex-col gap-3 border-t border-border pt-3 text-sm" aria-busy={mutation.isPending}>
    <h3 className="m-0 font-medium">{t('financialCase.title')}</h3>
    <p className="m-0 text-muted-foreground">{t('financialCase.explanation')}</p>
    <strong>{t(`financialCase.states.${data.dossier.state}`)}</strong>
    {data.dossier.last_error && <p role="alert">{t('financialCase.reconciliation')}</p>}
    {data.payments.length === 0 && <p role="status">{t('financialCase.noPayments')}</p>}
    {data.payments.map(p => <div key={p.id} className="flex flex-wrap justify-between gap-2 border-b border-border pb-2">
      <span>{p.provider} · {t(`financialCase.states.${p.state}`)} {p.shared && t('financialCase.shared')}</span>
      <span className="tabular-nums">{t('financialCase.collected')}: {money(p.collected, p.currency)} · {t('financialCase.refunded')}: {money(p.refunded, p.currency)}</span>
    </div>)}
    <label className="flex flex-col gap-1">{t('financialCase.reason')}
      <Textarea value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} disabled={mutation.isPending} />
    </label>
    {data.dossier.state === 'OPEN' && <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">{t('financialCase.amountDue')} {data.dossier.currency}
        <Input type="number" min="0" max={data.dossier.agreed_amount} step={10 ** -digits(data.dossier.currency)} value={amountDue ?? String(data.dossier.amount_due ?? 0)} onChange={e => setAmountDue(e.target.value)} disabled={mutation.isPending} className="tabular-nums" />
      </label>
      <span className="text-muted-foreground">{t('financialCase.assessmentHelp')}</span>
      {data.dossier.amount_due != null && <span className="tabular-nums">{t('financialCase.assessed')}: {new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: data.dossier.currency }).format(data.dossier.amount_due)}</span>}
      <Button variant="outline" disabled={disabled || amountDue === ''} onClick={() => void send('ASSESS')}>{t('financialCase.assess')}</Button>
    </div>}
    {data.decisions.map(d => { const payment = data.payments.find(p => p.id === d.payment_id); return <div key={d.id} className="flex flex-col gap-2 border-b border-border pb-2">
      <strong className="tabular-nums">{money(d.amount, payment?.currency ?? null)} · {t(`financialCase.states.${d.state}`)}</strong>
      <span className="whitespace-pre-wrap break-words">{d.reason}</span>
      {d.error && <span role="alert">{t('financialCase.reconciliation')}</span>}
      <div className="flex flex-wrap gap-2">
        {d.state === 'REVIEW' && payment?.provider === 'STRIPE' && <label className="flex flex-col gap-1">{t('financialCase.refundReference')}
          <Input value={refundRef} onChange={e => setRefundRef(e.target.value)} />
          <Button variant="outline" disabled={disabled || !refundRef.startsWith('re_')} onClick={() => void send('RECONCILE', d.id)}>{t('financialCase.reconcileRefund')}</Button>
        </label>}
        {d.state === 'REVIEW' && payment?.provider === 'STRIPE' && !d.refund_ref && <Button variant="outline" disabled={disabled || data.dossier?.state !== 'OPEN'} onClick={() => void send('RETRY_REVIEW', d.id)}>{t('financialCase.retryReview')}</Button>}
        {d.state === 'REVIEW' && payment && externalProviders.includes(payment.provider) && <label className="flex flex-col gap-1">{t('financialCase.externalRefundProof')}
          <Textarea value={evidence} maxLength={800} onChange={e => setEvidence(e.target.value)} disabled={mutation.isPending} />
          <Button variant="outline" disabled={disabled || !evidence.trim()} onClick={() => void send('CONFIRM_EXTERNAL', d.id)}>{t('financialCase.confirmExternal')}</Button>
        </label>}
        {d.state === 'PROPOSED' && <Button disabled={disabled || data.dossier?.state !== 'OPEN'} onClick={() => void send('APPROVE', d.id)}>{t('financialCase.approve')}</Button>}
        {['PROPOSED', 'APPROVED'].includes(d.state) && <Button variant="outline" disabled={disabled} onClick={() => void send('WITHDRAW', d.id)}>{t('financialCase.withdraw')}</Button>}
      </div>
    </div>; })}
    {data.payments.some(p => externalProviders.includes(p.provider)) && <details>
      <summary className="cursor-pointer">{t('financialCase.externalReconciliation')}</summary>
      <div className="flex flex-col gap-2 pt-2">
        <p className="text-muted-foreground">{t('financialCase.externalHelp')}</p>
        <label className="flex flex-col gap-1">{t('financialCase.source')}
          <select className="min-h-10 rounded-md border border-border bg-background p-2 text-foreground" value={externalPaymentId} onChange={e => setExternalPaymentId(e.target.value)}>
            <option value="">{t('financialCase.select')}</option>
            {data.payments.filter(p => externalProviders.includes(p.provider)).map(p => <option key={p.id} value={p.id}>{p.provider} · {p.id}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">{t('financialCase.currency')}
          <Input value={externalCurrency} maxLength={3} onChange={e => setExternalCurrency(e.target.value.toUpperCase())} />
        </label>
        <label className="flex flex-col gap-1">{t('financialCase.collected')}
          <Input type="number" min="0" step={10 ** -digits(externalCurrency)} value={externalCollected} onChange={e => setExternalCollected(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">{t('financialCase.refunded')}
          <Input type="number" min="0" step={10 ** -digits(externalCurrency)} value={externalRefunded} onChange={e => setExternalRefunded(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">{t('financialCase.externalProof')}
          <Textarea value={evidence} maxLength={800} onChange={e => setEvidence(e.target.value)} />
        </label>
        <Button variant="outline" disabled={disabled || !externalPaymentId || externalCurrency.length !== 3 || externalCollected === '' || externalRefunded === '' || !evidence.trim()} onClick={() => void send('VERIFY_EXTERNAL')}>{t('financialCase.verifyExternal')}</Button>
      </div>
    </details>}
    {data.dossier.state === 'OPEN' && <form className="flex flex-col gap-2" onSubmit={e => { e.preventDefault(); void send('PROPOSE'); }}>
      <label className="flex flex-col gap-1">{t('financialCase.source')}
        <select className="min-h-10 rounded-md border border-border bg-background p-2 text-foreground" value={paymentId} onChange={e => setPaymentId(e.target.value)} disabled={mutation.isPending} required>
          <option value="">{t('financialCase.select')}</option>
          {data.payments.filter(p => p.state === 'VERIFIED' && p.collected > p.refunded).map(p => <option value={p.id} key={p.id}>{p.provider} · {money(p.collected - p.refunded, p.currency)}{p.shared ? ` · ${t('financialCase.shared')}` : ''}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">{t('financialCase.amount')} {selected?.currency?.toUpperCase()}
        <Input inputMode="decimal" type="number" min="0" step={selected?.currency ? 10 ** -digits(selected.currency) : 0.01}
          value={amount} onChange={e => setAmount(e.target.value)} disabled={mutation.isPending} required className="tabular-nums" />
      </label>
      {selected?.shared && <label className="flex flex-col gap-1">{t('financialCase.allocated')}
        <Input type="number" min="0" step={selected?.currency ? 10 ** -digits(selected.currency) : 0.01} required value={allocation} onChange={e => setAllocation(e.target.value)} className="tabular-nums" />
      </label>}
      {selected && (selected.shared || selected.currency?.toUpperCase() !== data.dossier.currency?.toUpperCase()) && <label className="flex flex-col gap-1">{t('financialCase.allocation')}
        <Textarea value={evidence} maxLength={1000} onChange={e => setEvidence(e.target.value)} required disabled={mutation.isPending} />
      </label>}
      <Button type="submit" variant="outline" disabled={disabled || data.dossier.amount_due == null || !selected || !Number(amount) || (selected.shared && !evidence.trim())}>{t('financialCase.propose')}</Button>
    </form>}
    {data.dossier.accounting_state === 'REVIEW' && <p role="status">{t('financialCase.accountingRequired')}</p>}
    <div className="flex flex-wrap gap-2">
      {data.dossier.accounting_state === 'REVIEW' && <Button variant="outline" disabled={disabled} onClick={() => void send('ACCOUNTED')}>{t('financialCase.accounted')}</Button>}
      {data.dossier.state === 'OPEN' && <Button variant="outline" disabled={disabled} onClick={() => void send('DISPUTE')}>{t('financialCase.dispute')}</Button>}
      {data.dossier.state !== 'OPEN' && <Button variant="outline" disabled={disabled} onClick={() => void send('REOPEN')}>{t('financialCase.reopen')}</Button>}
      {data.dossier.state !== 'CLOSED' && <Button variant="outline" disabled={disabled} onClick={() => void send('CLOSE')}>{t('financialCase.close')}</Button>}
      <Button variant="ghost" disabled={disabled} onClick={() => void send('REFRESH')}>{t('financialCase.refresh')}</Button>
    </div>
    {mutation.isError && <p role="alert">{t('financialCase.error')}</p>}
    <details><summary className="cursor-pointer">{t('financialCase.history')}</summary>
      <ol className="flex flex-col gap-2 ps-4">{data.events.map(e => <li key={e.id}><time className="tabular-nums">{new Date(e.created_at).toLocaleString(currentLanguage)}</time> · {e.detail}</li>)}</ol>
    </details>
  </section>;
}

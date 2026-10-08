import { BaitlyCommerceEvidenceDisclosure } from '../../payments/BaitlyCommerceEvidencePanel';
import { useCommerceScope } from '../../../hooks/useCommerceScope';
import { useRef, useState } from 'react';
import BaitlyCommercePayoutPanel from '../../payments/BaitlyCommercePayoutPanel';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../hooks/useTranslation';
import { Button, Input, Label, Skeleton } from '../../../components/ui';
import { activitiesApi as api, type ImportedAffiliateEarning } from '../../../services/api/activitiesApi';

export default function BaitlyAffiliateAdjustments({ row, canEdit, onSaved }: { row: ImportedAffiliateEarning; canEdit: boolean; onSaved: () => Promise<void> }) {
  const scope = useCommerceScope();
  const { t, currentLanguage } = useTranslation();const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');const [proof, setProof] = useState('');const [reason, setReason] = useState('');
  const [error, setError] = useState('');const [busy, setBusy] = useState(false);const pending = useRef(false);
  const attempt = useRef<{ key: string; id: string } | null>(null);
  const history = useQuery({ enabled: !!scope, queryKey: ['affiliate-adjustments', scope, row.id], queryFn: () => api.commissionAdjustments(row.id), retry: false });
  const money = (value: number) => new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: row.currency }).format(value);
  async function save() {
    if (pending.current) return;pending.current = true;setBusy(true);setError('');
    try {
      const body = { expectedGross: row.grossCommission, gross: Number(amount), currency: row.currency, proof: proof.trim(), reason: reason.trim() };
      const key = JSON.stringify(body);if (attempt.current?.key !== key) attempt.current = { key, id: crypto.randomUUID() };
      await api.adjustCommission(row.id, { ...body, requestId: attempt.current.id });
      setEditing(false);setAmount('');setProof('');setReason('');await onSaved();await history.refetch();
    } catch (e) { setError(e instanceof Error ? e.message : t('affiliateReceipts.saveError')); }
    finally { pending.current = false;setBusy(false); }
  }
  return <section className="space-y-3 border-t border-border pt-3">
    {canEdit && ['RECEIVED', 'CANCELLED'].includes(row.status) && <><BaitlyCommercePayoutPanel key={`${row.id}-${row.grossCommission}`} source="AFFILIATE" sourceId={row.id} /><BaitlyCommerceEvidenceDisclosure key={`evidence-${row.id}`} source="AFFILIATE" sourceId={row.id} /></>}
    <h5 className="text-sm font-medium">{t('affiliateReceipts.adjustments.title')}</h5>
    {history.isPending && <Skeleton className="h-10 w-full" />}
    {(error || history.error) && <p role="alert" className="text-sm text-destructive-ink">{error || history.error?.message}</p>}
    {history.data?.map(change => <div key={change.id} className="space-y-1 border-b border-border pb-2 text-sm">
      <p className="tabular-nums">{money(change.beforeGross)} → {money(change.afterGross)}</p>
      <p>{change.reason}</p><p className="text-xs text-muted-foreground">{change.proof} · {new Date(change.createdAt).toLocaleString(currentLanguage)}</p>
    </div>)}
    {canEdit && ['PENDING', 'CONFIRMED', 'RECEIVED'].includes(row.status) && !editing && <Button variant="outline" onClick={() => { setAmount(String(row.grossCommission));setEditing(true); }}>{t('affiliateReceipts.adjustments.edit')}</Button>}
    {editing && <form className="space-y-3" onSubmit={e => { e.preventDefault();void save(); }}>
      <Label className="grid gap-1.5">{t('affiliateReceipts.adjustments.amount')} ({row.currency})<Input required type="number" min="0" step="0.01" value={amount} disabled={busy} onChange={e => setAmount(e.target.value)} /></Label>
      <Label className="grid gap-1.5">{t('affiliateReceipts.reference')}<Input required maxLength={255} value={proof} disabled={busy} onChange={e => setProof(e.target.value)} /></Label>
      <Label className="grid gap-1.5">{t('affiliateReceipts.adjustments.reason')}<Input required maxLength={1000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></Label>
      <p className="text-xs text-muted-foreground">{t('affiliateReceipts.adjustments.hint')}</p>
      <div className="flex gap-2"><Button type="submit" disabled={busy || !proof.trim() || !reason.trim() || !amount || !Number.isFinite(Number(amount)) || Number(amount) < 0 || Number(amount) === row.grossCommission}>{t('common.save')}</Button>
        <Button variant="ghost" type="button" disabled={busy} onClick={() => setEditing(false)}>{t('common.cancel')}</Button></div>
    </form>}
  </section>;
}

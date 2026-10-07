import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, Badge, Button, Input, Label, Skeleton, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../../components/ui';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';
import { activitiesApi, type ImportedAffiliateEarning } from '../../../services/api/activitiesApi';
import { propertiesApi } from '../../../services/api/propertiesApi';
import BaitlyAffiliateAdjustments from './BaitlyAffiliateAdjustments';

/** Les rapports importés restent attendus jusqu'à déclaration d'une réception justifiée. */
export default function BaitlyAffiliateReceipts() {
  const { t, currentLanguage } = useTranslation();
  const { hasAnyRole } = useAuth();
  const canReconcile = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']);
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ['affiliate-commissions'], queryFn: activitiesApi.listCommissions });
  const properties = useQuery({ queryKey: ['affiliate-receipt-properties'], queryFn: () => propertiesApi.getAll(), enabled: canReconcile });
  const [selected, setSelected] = useState<number | null>(null);
  const row = query.data?.find(item => item.id === selected);
  return <section className="mt-4 border-t border-border pt-4" aria-label={t('affiliateReceipts.title')}>
    <h3 className="text-sm font-semibold">{t('affiliateReceipts.title')}</h3>
    <p className="mt-1 text-xs text-muted-foreground">{t('affiliateReceipts.hint')}</p>
    {query.isLoading ? <Skeleton className="mt-3 h-24 w-full" /> : query.isError ?
      <Alert variant="destructive"><AlertDescription>{t('affiliateReceipts.loadError')} <Button variant="ghost" onClick={() => void query.refetch()}>{t('common.retry')}</Button></AlertDescription></Alert> :
      !query.data?.length ? <p className="py-5 text-sm text-muted-foreground">{t('affiliateReceipts.empty')}</p> :
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <ul className="divide-y divide-border rounded-lg border border-border">
          {query.data.map(item => <li key={item.id}>
            <button type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}
              className="flex w-full cursor-pointer flex-wrap items-center gap-2 p-3 text-start text-sm transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary aria-pressed:bg-primary/10">
              <span>{item.provider} · {item.externalBookingId}</span>
              <strong className="ms-auto tabular-nums">{new Intl.NumberFormat(currentLanguage, {style:'currency',currency:item.currency}).format(item.grossCommission)}</strong>
              <Badge variant={item.status === 'RECEIVED' ? 'success' : 'secondary'}>{t(`affiliateReceipts.status.${item.status}`)}</Badge>
            </button>
          </li>)}
        </ul>
        {row ? <ReceiptForm key={row.id} row={row} canReconcile={canReconcile} properties={properties.data ?? []} onSaved={async () => {
          await Promise.all([cache.invalidateQueries({queryKey:['affiliate-commissions']}), cache.invalidateQueries({queryKey:['activity-commission-summary']})]);
        }} /> : <p className="py-3 text-sm text-muted-foreground">{t('affiliateReceipts.select')}</p>}
      </div>}
  </section>;
}

function ReceiptForm({row, canReconcile, properties, onSaved}: {row: ImportedAffiliateEarning; canReconcile: boolean;
  properties: Array<{id:number;name:string}>; onSaved: () => Promise<void>}) {
  const { t } = useTranslation();
  const [propertyId, setPropertyId] = useState(row.propertyId ? String(row.propertyId) : '');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const expected = row.status === 'PENDING' || row.status === 'CONFIRMED';
  const action = async (cancel = false) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (cancel) await activitiesApi.cancelCommission(row.id);
      else await activitiesApi.receiveCommission(row.id, { amount:Number(amount),currency:row.currency,propertyId:Number(propertyId),reference:reference.trim(),receivedAt:new Date(date).toISOString().slice(0,-1) });
      await onSaved();
    } catch (failure) { setError(failure instanceof Error ? failure.message : t('affiliateReceipts.saveError')); }
    finally { pending.current = false; setBusy(false); }
  };
  return <div className="space-y-3">
    <h4 className="text-sm font-semibold">{row.provider} · {row.externalBookingId}</h4>
    {row.receiptReference && <p className="text-sm">{t('affiliateReceipts.reference')}: {row.receiptReference}</p>}
    {row.status === 'PAID' && <Alert variant="warning"><AlertDescription>{t('affiliateReceipts.legacy')}</AlertDescription></Alert>}
    {expected && canReconcile && <form className="space-y-3" onSubmit={event => {event.preventDefault(); void action();}}>
      <Label className="grid gap-1.5">{t('affiliateReceipts.property')}
        <Select value={propertyId} onValueChange={setPropertyId} disabled={busy || row.propertyId !== null}>
          <SelectTrigger className="w-full"><SelectValue placeholder={t('affiliateReceipts.property')} /></SelectTrigger>
          <SelectContent>{properties.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </Label>
      <Label className="grid gap-1.5">{t('affiliateReceipts.reference')}<Input required maxLength={255} value={reference} disabled={busy} onChange={e => setReference(e.target.value)} /></Label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1.5">{t('affiliateReceipts.amount')} ({row.currency})<Input required type="number" min="0.01" step="0.01" value={amount} disabled={busy} onChange={e => setAmount(e.target.value)} /></Label>
        <Label className="grid gap-1.5">{t('affiliateReceipts.date')}<Input required type="datetime-local" value={date} disabled={busy} onChange={e => setDate(e.target.value)} /></Label>
      </div>
      <p className="text-xs text-muted-foreground">{t('affiliateReceipts.declaration')}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !propertyId || !reference.trim() || !date || Number(amount)!==row.grossCommission}>{t('affiliateReceipts.receive')}</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => void action(true)}>{t('affiliateReceipts.cancel')}</Button>
      </div>
    </form>}
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <BaitlyAffiliateAdjustments row={row} canEdit={canReconcile} onSaved={onSaved} />
  </div>;
}

import { useCommerceScope } from '../../hooks/useCommerceScope';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Input, Label, NativeSelect, Skeleton } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { baitlyCommerceApi as api } from '../../services/api/baitlyCommerceApi';

const upsell: Record<string, string[]> = { PAID: ['SCHEDULED', 'FULFILLED', 'CANCELLED'], SCHEDULED: ['FULFILLED', 'CANCELLED'] };
const hardware: Record<string, string[]> = { PAID: ['PREPARING', 'SHIPPED', 'CANCELLED'], PREPARING: ['SHIPPED', 'CANCELLED'], SHIPPED: ['DELIVERED', 'RETURN_REQUESTED'], DELIVERED: ['RETURN_REQUESTED'], RETURN_REQUESTED: ['RETURNED'] };
export default function BaitlyCommerceOperationsPanel({ source, sourceId, canEdit, canRestock = false }: { source: string; sourceId: number; canEdit: boolean; canRestock?: boolean }) {
  const scope = useCommerceScope();
  const { t, currentLanguage } = useTranslation();const [action, setAction] = useState('');const [proof, setProof] = useState('');const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);const [error, setError] = useState('');const pending = useRef(false);const attempt = useRef<{ key: string; id: string } | null>(null);
  const [restocked, setRestocked] = useState(false);
  const query = useQuery({ enabled: !!scope, queryKey: ['commerce-operations', scope, source, sourceId], queryFn: () => api.operations(source, sourceId), retry: false });
  const history = query.data;const state = history?.at(-1)?.action || 'PAID';const next = (source === 'UPSELL' ? upsell : hardware)[state] || [];
  const choice = next.includes(action) ? action : next[0] || '';
  async function save() {
    if (pending.current) return;pending.current = true;setBusy(true);setError('');
    try {
      const body = { source, sourceId, action: choice, proof: proof.trim(), note: note.trim() };const key = JSON.stringify(body);
      if (attempt.current?.key !== key) attempt.current = { key, id: crypto.randomUUID() };
      await api.recordOperation({ ...body, requestId: attempt.current.id });await query.refetch();setProof('');setNote('');setAction('');
    } catch (e) { setError(e instanceof Error ? e.message : t('common.error')); }
    finally { pending.current = false;setBusy(false); }
  }
  async function restock() {
    if (pending.current) return;pending.current = true;setBusy(true);setError('');
    try { await api.restock(sourceId, proof.trim());setRestocked(true); }
    catch (e) { setError(e instanceof Error ? e.message : t('common.error')); }
    finally { pending.current = false;setBusy(false); }
  }
  return <section className="w-full space-y-3 border-t border-border pt-3">
    <h4 className="text-sm font-medium">{t('commerceOperations.title')}</h4>
    {query.isPending && <Skeleton className="h-12 w-full" />}
    {(query.error || error) && <p role="alert" className="text-sm text-destructive-ink">{error || query.error?.message}</p>}
    {history?.length === 0 && <p className="text-xs text-muted-foreground">{t('commerceOperations.empty')}</p>}
    {history?.map(row => <div key={row.id} className="border-b border-border pb-2 text-xs">
      <p className="font-medium">{t(`commerceOperations.states.${row.action}`, row.action)}</p>
      <p>{row.note}</p><p className="text-muted-foreground">{row.proof} · {new Date(row.createdAt).toLocaleString(currentLanguage)}</p>
    </div>)}
    {history && canEdit && next.length > 0 && <form className="space-y-3" onSubmit={e => { e.preventDefault();void save(); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1.5">{t('commerceOperations.action')}<NativeSelect value={choice} disabled={busy} onChange={e => setAction(e.target.value)}>{next.map(value => <option key={value} value={value}>{t(`commerceOperations.states.${value}`)}</option>)}</NativeSelect></Label>
        <Label className="grid gap-1.5">{t('commerceOperations.proof')}<Input required maxLength={255} value={proof} disabled={busy} onChange={e => setProof(e.target.value)} /></Label>
      </div>
      <Label className="grid gap-1.5">{t('commerceOperations.note')}<Input maxLength={1000} value={note} disabled={busy} onChange={e => setNote(e.target.value)} /></Label>
      <p className="text-xs text-muted-foreground">{t('commerceOperations.hint')}</p>
      <Button type="submit" variant="outline" disabled={busy || !proof.trim()}>{t('common.save')}</Button>
    </form>}
    {canRestock && source === 'HARDWARE_ORDER' && state === 'RETURNED' && !restocked && <form className="space-y-3" onSubmit={e => { e.preventDefault();void restock(); }}>
      <Label className="grid gap-1.5">{t('commerceOperations.restockProof')}<Input required maxLength={255} value={proof} disabled={busy} onChange={e => setProof(e.target.value)} /></Label>
      <Button variant="outline" disabled={busy || !proof.trim()} type="submit">{t('commerceOperations.restock')}</Button>
    </form>}
    {restocked && <p role="status" className="text-sm">{t('commerceOperations.restocked')}</p>}
  </section>;
}

import { useCommerceScope } from '../../hooks/useCommerceScope';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Label, NativeSelect, Skeleton, Textarea } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { baitlyCommerceApi as api, type CommerceOperation } from '../../services/api/baitlyCommerceApi';
import { RefreshCw } from '../../icons/glyphs';

const upsell: Record<string, string[]> = { PAID: ['SCHEDULED', 'FULFILLED', 'CANCELLED'], SCHEDULED: ['FULFILLED', 'CANCELLED'] };
const hardware: Record<string, string[]> = { PAID: ['PREPARING', 'SHIPPED', 'CANCELLED'], PREPARING: ['SHIPPED', 'CANCELLED'], SHIPPED: ['DELIVERED', 'RETURN_REQUESTED'], DELIVERED: ['RETURN_REQUESTED'], RETURN_REQUESTED: ['RETURNED'] };
interface OperationsProps { source: string; sourceId: number; canEdit: boolean; canRestock?: boolean }
export default function BaitlyCommerceOperationsPanel(props: OperationsProps) {
  const scope = useCommerceScope();
  return <CommerceOperations key={`${scope}:${props.source}:${props.sourceId}`} {...props} scope={scope} />;
}
function CommerceOperations({ source, sourceId, canEdit, canRestock = false, scope }: OperationsProps & { scope: string | null }) {
  const client = useQueryClient();
  const { t, currentLanguage } = useTranslation();const [action, setAction] = useState('');const [proof, setProof] = useState('');const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);const [error, setError] = useState('');const pending = useRef(false);const attempt = useRef<{ key: string; id: string } | null>(null);
  const [restocked, setRestocked] = useState(false);
  const queryKey = ['commerce-operations', scope, source, sourceId];
  const query = useQuery({ enabled: !!scope, queryKey, queryFn: () => api.operations(source, sourceId), retry: false, staleTime: 0, refetchOnWindowFocus: 'always' });
  const history = query.isError ? undefined : query.data;const state = history?.at(-1)?.action || 'PAID';const next = (source === 'UPSELL' ? upsell : hardware)[state] || [];
  const choice = next.includes(action) ? action : next[0] || '';
  async function save() {
    if (pending.current || !scope || !canEdit || !history || query.isFetching || !choice || !proof.trim() || proof.trim().length > 255 || note.trim().length > 1000) return;
    pending.current = true;setBusy(true);setError('');
    try {
      const body = { source, sourceId, action: choice, proof: proof.trim(), note: note.trim() };const key = JSON.stringify(body);
      if (attempt.current?.key !== key) attempt.current = { key, id: crypto.randomUUID() };
      const recorded = await api.recordOperation({ ...body, requestId: attempt.current.id });
      // La réponse confirmée suffit : une relecture en échec ne doit pas rejouer une action déjà acceptée.
      client.setQueryData<CommerceOperation[]>(queryKey, previous => {
        const rows = previous ?? [];
        return rows.some(row => row.id === recorded.id) ? rows : [...rows, recorded];
      });
      if (source === 'UPSELL') {
        void client.invalidateQueries({ queryKey: ['paid-service-execution', sourceId] });
        void client.invalidateQueries({ queryKey: ['upsell-orders'] });
      }
      setProof('');setNote('');setAction('');
    } catch (e) { setError(e instanceof Error ? e.message : t('common.error')); }
    finally { pending.current = false;setBusy(false); }
  }
  async function restock() {
    if (pending.current || !scope || !canRestock || source !== 'HARDWARE_ORDER' || !history || query.isFetching || state !== 'RETURNED' || restocked || !proof.trim() || proof.trim().length > 255) return;
    pending.current = true;setBusy(true);setError('');
    try { await api.restock(sourceId, proof.trim());setRestocked(true); }
    catch (e) { setError(e instanceof Error ? e.message : t('common.error')); }
    finally { pending.current = false;setBusy(false); }
  }
  return <section className="w-full space-y-3 border-t border-border pt-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-medium">{t('commerceOperations.title')}</h4>
      <Button type="button" variant="ghost" size="sm" className="min-h-[44px] max-w-full whitespace-normal" disabled={!scope || busy || query.isFetching} onClick={() => { setError('');void query.refetch(); }}>
        <RefreshCw className="size-4" />{t('commerceOperations.refresh')}
      </Button>
    </div>
    {query.isPending && <Skeleton className="h-12 w-full" />}
    {(query.error || error) && <p role="alert" className="text-sm text-destructive-ink">{error || query.error?.message}</p>}
    {history?.length === 0 && <p className="text-xs text-muted-foreground">{t('commerceOperations.empty')}</p>}
    {history?.map(row => <div key={row.id} className="border-b border-border pb-2 text-xs whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
      <p className="font-medium">{t(`commerceOperations.states.${row.action}`, row.action)}</p>
      <p>{row.note}</p><p className="text-muted-foreground tabular-nums">{row.proof} · {new Date(row.createdAt).toLocaleString(currentLanguage)}</p>
    </div>)}
    {history && canEdit && next.length > 0 && <form className="space-y-3" onSubmit={e => { e.preventDefault();void save(); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid min-w-0 gap-1.5">{t('commerceOperations.action')}<NativeSelect className="w-full max-w-full [&_select]:min-h-[44px] [&_select]:w-full" value={choice} disabled={busy || query.isFetching} onChange={e => setAction(e.target.value)}>{next.map(value => <option key={value} value={value}>{t(`commerceOperations.states.${value}`)}</option>)}</NativeSelect></Label>
        <Label className="grid min-w-0 gap-1.5">{t('commerceOperations.proof')}<Input className="min-h-[44px]" required maxLength={255} value={proof} disabled={busy || query.isFetching} onChange={e => setProof(e.target.value)} /></Label>
      </div>
      <Label className="grid gap-1.5">{t('commerceOperations.note')}<Textarea rows={3} maxLength={1000} value={note} disabled={busy || query.isFetching} onChange={e => setNote(e.target.value)} /></Label>
      <p className="text-xs text-muted-foreground">{t('commerceOperations.hint')}</p>
      <Button type="submit" variant="outline" className="min-h-[44px]" disabled={busy || query.isFetching || !proof.trim()}>{t('common.save')}</Button>
    </form>}
    {history && canRestock && source === 'HARDWARE_ORDER' && state === 'RETURNED' && !restocked && <form className="space-y-3" onSubmit={e => { e.preventDefault();void restock(); }}>
      <Label className="grid gap-1.5">{t('commerceOperations.restockProof')}<Input required maxLength={255} value={proof} disabled={busy} onChange={e => setProof(e.target.value)} /></Label>
      <Button variant="outline" disabled={busy || !proof.trim()} type="submit">{t('commerceOperations.restock')}</Button>
    </form>}
    {restocked && <p role="status" className="text-sm">{t('commerceOperations.restocked')}</p>}
  </section>;
}

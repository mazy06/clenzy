import { useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, RotateCcw } from 'lucide-react';
import { Button, Input, Skeleton, Alert, AlertDescription } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { baitlyOtaSettlementsApi as api, type OtaSettlementContext } from '../../services/api/baitlyOtaSettlementsApi';

export default function BaitlyOtaSettlementPanel({ reservationId }: { reservationId: number }) {
  const { user, hasRole } = useAuth();
  if (!user || !(hasRole('SUPER_ADMIN') || hasRole('SUPER_MANAGER'))) return null;
  return <Panel key={`${user.id}:${user.organizationId}:${reservationId}`} reservationId={reservationId} scope={`${user.id}:${user.organizationId}`} />;
}
function Panel({ reservationId, scope }: { reservationId: number; scope: string }) {
  const { t, currentLanguage } = useTranslation(); const queries = useQueryClient();
  const key = ['ota-settlements', scope, reservationId];
  const rows = useQuery({ queryKey: key, queryFn: () => api.list(reservationId) });
  const context = useQuery({ queryKey: [...key, 'context'], queryFn: () => api.context(reservationId) });
  const [editing, setEditing] = useState(false); const [correction, setCorrection] = useState<number | null>(null);
  const [reason, setReason] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const money = (n: number, currency: string) => new Intl.NumberFormat(currentLanguage, { style: 'currency', currency }).format(n);
  const run = async (task: () => Promise<void>) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await task(); } catch (e) { setError(getErrorMessage(e)); } finally { lock.current = false; setBusy(false); }
  };
  return <section className="border-t border-border pt-4 text-sm" aria-label={t('otaSettlement.title')}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{t('otaSettlement.title')}</h3>
      {!editing && context.data?.payment_collection === 'CHANNEL' && !rows.isError && !rows.isFetching && <Button size="sm" variant="outline" disabled={busy}
        onClick={() => setEditing(true)}><Plus size={16} />{t('otaSettlement.add')}</Button>}
    </div>
    <p className="mt-2 text-muted-foreground">{t('otaSettlement.help')}</p>
    {(rows.isPending || context.isPending) && <Skeleton className="mt-3 h-10 w-full" />}
    {(rows.isError || context.isError) && <div role="alert" className="mt-3"><p>{t('otaSettlement.loadError')}</p><Button variant="ghost" onClick={() => { void rows.refetch(); void context.refetch(); }}>{t('common.retry')}</Button></div>}
    {error && <Alert className="mt-3"><AlertDescription>{error}</AlertDescription></Alert>}
    {rows.data?.length === 0 && <p className="mt-3 text-muted-foreground">{t('otaSettlement.empty')}</p>}
    <ul className="mt-3 divide-y divide-border">{rows.data?.map(row => <li key={row.id} className="py-3">
      <div className="flex flex-wrap justify-between gap-2"><span>{row.ota_reference} · {row.beneficiary_name}</span><strong className="tabular-nums">{money(row.net, row.currency)}</strong></div>
      <p className="mt-1 text-muted-foreground">{row.void_reason ? t('otaSettlement.voided', { reason: row.void_reason }) : t('otaSettlement.documented', { date: row.received_on })}</p>
      <p className="mt-1 tabular-nums text-muted-foreground">{t('otaSettlement.breakdown', { gross: money(row.gross, row.currency), fees: money(row.fees, row.currency), refunds: money(row.refunds, row.currency) })}</p>
      <div className="mt-2 flex flex-wrap gap-2">{(['statement', 'bank'] as const).map(kind => <Button key={kind} size="sm" variant="ghost" disabled={busy}
        onClick={() => void run(async () => { const blob = await api.document(row.id, kind); const url = URL.createObjectURL(blob); const link = document.createElement('a');
          link.href = url; link.download = `baitly-ota-${row.id}-${kind}.${blob.type === 'application/pdf' ? 'pdf' : blob.type === 'image/png' ? 'png' : 'jpg'}`;
          document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); })}><Download size={14} />{t(`otaSettlement.${kind}`)}</Button>)}
        {!row.void_reason && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setCorrection(row.id); setReason(''); }}><RotateCcw size={14} />{t('otaSettlement.correct')}</Button>}
      </div>
      {correction === row.id && <form className="mt-2 space-y-2" onSubmit={e => { e.preventDefault(); void run(async () => { await api.void(row.id, reason); setCorrection(null); await queries.invalidateQueries({ queryKey: key }); }); }}>
        <label className="block">{t('otaSettlement.reason')}<Input className="mt-1" value={reason} onChange={e => setReason(e.target.value)} minLength={10} maxLength={500} required disabled={busy} /></label>
        <div className="flex flex-wrap gap-2"><Button disabled={busy || reason.trim().length < 10}>{t('otaSettlement.confirmCorrection')}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setCorrection(null)}>{t('common.cancel')}</Button></div>
      </form>}
    </li>)}</ul>
    {editing && context.data && <SettlementForm reservationId={reservationId} context={context.data} scope={scope} onCancel={() => setEditing(false)}
      onSaved={async () => { setEditing(false); await queries.invalidateQueries({ queryKey: key }); }} />}
  </section>;
}
function SettlementForm({ reservationId, context, scope, onSaved, onCancel }: { reservationId: number; context: OtaSettlementContext; scope: string; onSaved: () => Promise<void>; onCancel: () => void }) {
  const { t, currentLanguage } = useTranslation(); const lock = useRef(false);
  const [requestId] = useState(() => crypto.randomUUID()); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [draft, setDraft] = useState({ ota: '', bank: '', date: '', gross: String(context.total_price), fees: '0', refunds: '0', recipient: context.owner_id ? 'owner' : 'organization' });
  const candidates = useQuery({ queryKey: ['ota-candidates', scope, reservationId], queryFn: () => api.candidates(reservationId) });
  const [extra, setExtra] = useState<{ id: number; gross: string; fees: string; refunds: string }[]>([]);
  const [addition, setAddition] = useState('');
  const [statement, setStatement] = useState<File>(); const [receipt, setReceipt] = useState<File>();
  // Addition en centimes, avant toute conversion au contrat décimal de l'API.
  const cents = (v: string) => /^\d+(?:[.,]\d{1,2})?$/.test(v) ? Math.round(Number(v.replace(',', '.')) * 100) : NaN;
  const lines = [{ id: reservationId, gross: draft.gross, fees: draft.fees, refunds: draft.refunds }, ...extra].map(line => ({
    reservationId: line.id, gross: cents(line.gross), fees: cents(line.fees), refunds: cents(line.refunds), net: cents(line.gross) - cents(line.fees) - cents(line.refunds),
  }));
  const valid = lines.every(line => Number.isSafeInteger(line.net) && line.net > 0);
  const totalNet = lines.reduce((sum, line) => sum + line.net, 0);
  const mixedOwners = extra.some(line => candidates.data?.find(candidate => candidate.id === line.id)?.owner_id !== context.owner_id);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (lock.current || !statement || !receipt || !valid || (draft.recipient === 'owner' && mixedOwners)) return;
    if (statement.size > 5 * 1024 * 1024 || receipt.size > 5 * 1024 * 1024 || statement.size + receipt.size > 9 * 1024 * 1024) { setError(t('otaSettlement.fileLimit')); return; }
    lock.current = true; setBusy(true); setError('');
    try { await api.record({ requestId, otaReference: draft.ota, bankReference: draft.bank, receivedOn: draft.date, currency: context.currency,
      beneficiaryUserId: draft.recipient === 'owner' ? context.owner_id : null,
      lines: lines.map(line => ({ reservationId: line.reservationId, gross: (line.gross / 100).toFixed(2), fees: (line.fees / 100).toFixed(2), refunds: (line.refunds / 100).toFixed(2), net: (line.net / 100).toFixed(2) })) }, statement, receipt); await onSaved(); }
    catch (e) { setError(getErrorMessage(e)); } finally { lock.current = false; setBusy(false); }
  };
  return <form className="mt-3 space-y-3 rounded-lg bg-muted p-3" onSubmit={e => void submit(e)}>
    <fieldset disabled={busy} className="space-y-3"><legend className="font-medium">{t('otaSettlement.add')}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{(['ota', 'bank', 'date', 'gross', 'fees', 'refunds'] as const).map(field => <label key={field} className="block min-w-0">{t(`otaSettlement.fields.${field}`)}
        <Input className="mt-1" required type={field === 'date' ? 'date' : 'text'} inputMode={['gross', 'fees', 'refunds'].includes(field) ? 'decimal' : undefined}
          maxLength={160} value={draft[field]} onChange={e => setDraft(old => ({ ...old, [field]: e.target.value }))} /></label>)}</div>
      <div className="space-y-3 border-t border-border pt-3">
        <p>{t('otaSettlement.batchHelp')}</p>
        {extra.map(line => <fieldset key={line.id} className="space-y-2 border-t border-border pt-2"><legend>{t('otaSettlement.stay', { id: line.id })} · {candidates.data?.find(c => c.id === line.id)?.property_name}</legend>
          <div className="grid gap-2 sm:grid-cols-3">{(['gross', 'fees', 'refunds'] as const).map(field => <label key={field}>{t(`otaSettlement.fields.${field}`)}
            <Input required inputMode="decimal" value={line[field]} onChange={e => setExtra(old => old.map(item => item.id === line.id ? { ...item, [field]: e.target.value } : item))} /></label>)}</div>
          <Button type="button" variant="ghost" onClick={() => setExtra(old => old.filter(item => item.id !== line.id))}>{t('otaSettlement.removeStay')}</Button>
        </fieldset>)}
        {candidates.isError ? <p role="alert">{t('otaSettlement.loadError')}</p> : <label className="block">{t('otaSettlement.addStay')}<select disabled={extra.length >= 99 || candidates.isPending} value={addition} className="mt-1 w-full rounded-md border border-border bg-card p-2" onChange={e => setAddition(e.target.value)}>
          <option value="">{t('otaSettlement.chooseStay')}</option>{candidates.data?.filter(c => c.id !== reservationId && c.remaining > 0 && !extra.some(line => line.id === c.id)).map(c => <option key={c.id} value={c.id}>{t('otaSettlement.stay', { id: c.id })} · {c.property_name}</option>)}
        </select></label>}
        <Button type="button" variant="outline" disabled={!addition || extra.length >= 99} onClick={() => {
          const candidate = candidates.data?.find(c => String(c.id) === addition); if (!candidate) return;
          setExtra(old => [...old, { id: candidate.id, gross: String(candidate.remaining), fees: '0', refunds: '0' }]); setAddition('');
          if (candidate.owner_id !== context.owner_id) setDraft(old => ({ ...old, recipient: 'organization' }));
        }}>{t('otaSettlement.addStay')}</Button>
      </div>
      <fieldset><legend>{t('otaSettlement.recipient')}</legend><div className="mt-1 flex flex-wrap gap-4">
        {(['owner', 'organization'] as const).filter(value => value !== 'owner' || context.owner_id).map(value => <label key={value} className="flex cursor-pointer items-center gap-2"><input type="radio" disabled={value === 'owner' && mixedOwners} className="accent-[var(--bui-primary)]" name={`ota-recipient-${reservationId}`}
          value={value} checked={draft.recipient === value} onChange={() => setDraft(old => ({ ...old, recipient: value }))} />{value === 'owner' ? context.owner_name : context.organization_name}</label>)}
      </div></fieldset>
      <div className="grid gap-3 sm:grid-cols-2">{(['statement', 'bank'] as const).map(kind => <label key={kind} className="block min-w-0">{t(`otaSettlement.${kind}`)}
        <Input className="mt-1" type="file" accept="application/pdf,image/png,image/jpeg" required onChange={e => (kind === 'statement' ? setStatement : setReceipt)(e.target.files?.[0])} /></label>)}</div>
      <p className="text-muted-foreground">{t('otaSettlement.fileLimit')}</p>
      <p className="tabular-nums font-semibold">{t('otaSettlement.net')} {Number.isFinite(totalNet) ? new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: context.currency }).format(totalNet / 100) : '…'}</p>
      {error && <p role="alert">{error}</p>}
      <p className="text-muted-foreground">{t('otaSettlement.confirmHelp')}</p>
      <div className="flex flex-wrap gap-2"><Button className="baitly-hitl-primary" disabled={!statement || !receipt || !valid || (draft.recipient === 'owner' && mixedOwners)}>{t(busy ? 'otaSettlement.saving' : 'otaSettlement.confirm')}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button></div>
    </fieldset>
  </form>;
}

import FinanceStatusIcon from '../../billing/components/FinanceStatusIcon';
import { useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, ExternalLink, Download, Link2 } from '../../../icons/glyphs';
import { Button, Input, Skeleton, Alert, AlertDescription } from '../../../components/ui';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';
import { usePageHeaderActions } from '../../../components/PageHeaderActionsContext';
import { useScreenSearch } from '../../../components/ScreenChrome';
import FinanceWorkspace from '../../billing/components/FinanceWorkspace';
import { baitlySupplierPurchasesApi as api, type SupplierPurchase } from '../../../services/api/baitlySupplierPurchasesApi';
import { propertiesApi } from '../../../services/api/propertiesApi';
import { getErrorMessage } from '../../../utils/getErrorMessage';

export default function BaitlySupplierPurchases() {
  const { user, hasRole } = useAuth();
  if (!user || !(hasRole('SUPER_ADMIN') || hasRole('SUPER_MANAGER'))) return null;
  return <Purchases key={`${user.id}:${user.organizationId}`} scope={`${user.id}:${user.organizationId}`} />;
}
function Purchases({ scope }: { scope: string }) {
  const { t, currentLanguage } = useTranslation(); const queries = useQueryClient();
  const [creating, setCreating] = useState(false); const [search, setSearch] = useState('');
  const key = ['supplier-purchases', scope];
  const list = useQuery({ queryKey: key, queryFn: api.list });
  useScreenSearch(search, value => { setSearch(value); }, t('supplierPurchase.search'));
  const actions = usePageHeaderActions(<Button variant="outline" size="icon" aria-label={t('supplierPurchase.new')} onClick={() => setCreating(true)}><Plus size={18} /></Button>);
  const refresh = async () => { await Promise.all([queries.invalidateQueries({ queryKey: key }), queries.invalidateQueries({ queryKey: ['provider-expenses'] })]); };
  const rows = (list.data ?? []).filter(r => `${r.supplier_name} ${r.invoice_reference} ${r.property_name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const status = (r: SupplierPurchase) => r.external_reference ? 'externalDocumented' : r.expense_id ? 'expensePrepared'
    : r.beneficiary_user_id ? 'accepted' : r.mode === 'BAITLY' ? 'invited' : r.mode === 'EXTERNAL' ? 'externalPending' : 'toChoose';
  return <div className="space-y-3">{actions}
    {creating && <PurchaseForm scope={scope} onCancel={() => setCreating(false)} onSaved={async () => { setCreating(false); await refresh(); }} />}
    {list.isPending && <Skeleton className="h-32 w-full" />}
    {list.isError && <Alert><AlertDescription>{t('supplierPurchase.loadError')} <Button variant="ghost" onClick={() => void list.refetch()}>{t('common.retry')}</Button></AlertDescription></Alert>}
    {!list.isPending && !list.isError && rows.length === 0 && <p className="py-4 text-sm">{t('supplierPurchase.empty')}</p>}
    {!list.isError && rows.length > 0 && <FinanceWorkspace items={rows.map(row => ({
      id: row.id, title: row.supplier_name, subtitle: row.invoice_reference, identity: { propertyId: row.property_id, propertyName: row.property_name, actorName: row.supplier_name },
      amount: new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: row.currency }).format(row.amount_ttc),
      status: <FinanceStatusIcon value={status(row)} label={t(`supplierPurchase.states.${status(row)}`)} />, fields: [],
      detailBody: <PurchaseDetail key={row.id} row={row} refresh={refresh} />,
    }))} />}
  </div>;
}
function PurchaseDetail({ row, refresh }: { row: SupplierPurchase; refresh: () => Promise<void> }) {
  const { t, currentLanguage } = useTranslation(); const sending = useRef(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [path, setPath] = useState('');
  const [url, setUrl] = useState(row.external_url ?? ''); const [external, setExternal] = useState(false); const [inviteConfirm, setInviteConfirm] = useState(false);
  const [reference, setReference] = useState(''); const [paidOn, setPaidOn] = useState(''); const [receipt, setReceipt] = useState<File>();
  const amount = new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: row.currency }).format(row.amount_ttc);
  const run = async (work: () => Promise<void>) => {
    if (sending.current) return; sending.current = true; setBusy(true); setError('');
    try { await work(); await refresh(); } catch (e) { setError(getErrorMessage(e)); } finally { sending.current = false; setBusy(false); }
  };
  const download = (kind: 'invoice' | 'receipt') => void run(async () => {
    const blob = await api.document(row.id, kind), href = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = href; link.download = `baitly-achat-${row.id}-${kind}.${blob.type === 'application/pdf' ? 'pdf' : blob.type === 'image/png' ? 'png' : 'jpg'}`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(href), 1000);
  });
  return <div className="space-y-4 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-3"><strong className="text-xl tabular-nums">{amount}</strong><Button variant="outline" disabled={busy} onClick={() => download('invoice')}><Download size={16} />{t('supplierPurchase.invoice')}</Button></div>
    <p>{row.description}</p><p className="text-muted-foreground">{row.property_name} · {row.expense_date}</p>
    {error && <Alert><AlertDescription>{error}</AlertDescription></Alert>}
    {!row.mode && !external && !inviteConfirm && <div className="flex flex-wrap gap-2">
      <Button disabled={busy} onClick={() => setInviteConfirm(true)}>{t('supplierPurchase.invite')}</Button>
      <Button variant="outline" disabled={busy} onClick={() => setExternal(true)}>{t('supplierPurchase.external')}</Button>
    </div>}
    {inviteConfirm && !row.mode && <div className="space-y-3 border-t border-border pt-3"><p>{t('supplierPurchase.inviteConfirm')}</p>
      <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void run(async () => { setPath((await api.invite(row.id)).path); setInviteConfirm(false); })}>{t('supplierPurchase.confirmInvite')}</Button>
        <Button variant="ghost" disabled={busy} onClick={() => setInviteConfirm(false)}>{t('common.cancel')}</Button></div></div>}
    {(external && !row.mode) && <form className="space-y-3 border-t border-border pt-3" onSubmit={e => { e.preventDefault(); void run(async () => { await api.chooseExternal(row.id, url); setExternal(false); }); }}>
      <p>{t('supplierPurchase.externalConfirm')}</p><label className="block">{t('supplierPurchase.site')}<Input type="url" pattern="https://.*" required value={url} onChange={e => setUrl(e.target.value)} disabled={busy} /></label>
      <div className="flex flex-wrap gap-2"><Button disabled={busy}>{t('supplierPurchase.confirmExternal')}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setExternal(false)}>{t('common.cancel')}</Button></div>
    </form>}
    {row.mode === 'BAITLY' && <div className="space-y-3 border-t border-border pt-3">
      <p>{t(row.beneficiary_user_id ? 'supplierPurchase.acceptedHelp' : 'supplierPurchase.invitedHelp')}</p>
      {!row.beneficiary_user_id && !path && <Button variant="outline" disabled={busy} onClick={() => void run(async () => setPath((await api.invite(row.id)).path))}><Link2 size={16} />{t('supplierPurchase.renew')}</Button>}
      {row.beneficiary_user_id && !row.expense_id && <Button disabled={busy} onClick={() => void run(async () => { await api.prepareExpense(row.id); })}>{t('supplierPurchase.prepareExpense')}</Button>}
      {row.expense_id && <p>{t('supplierPurchase.preparedHelp')} <Link className="underline underline-offset-4" to={`/billing?tab=expenses&view=providers&highlight=${row.expense_id}`}>{t('supplierPurchase.openExpense', { id: row.expense_id })}</Link></p>}
    </div>}
    {path && <div className="space-y-2"><label className="block">{t('supplierPurchase.link')}<Input readOnly value={`${window.location.origin}${path}`} onFocus={e => e.target.select()} /></label><p className="text-muted-foreground">{t('supplierPurchase.linkHelp')}</p></div>}
    {row.mode === 'EXTERNAL' && <div className="space-y-3 border-t border-border pt-3">
      {row.external_reference ? <><p role="status">{t('supplierPurchase.externalRecorded', { reference: row.external_reference })}</p><Button variant="outline" disabled={busy} onClick={() => download('receipt')}><Download size={16} />{t('supplierPurchase.receipt')}</Button></>
        : <><p className="text-muted-foreground">{t('supplierPurchase.externalHelp')}</p>
          {row.external_url?.startsWith('https://') && <Button asChild variant="outline"><a href={row.external_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} />{t('supplierPurchase.openSite')}</a></Button>}
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (!receipt) return;
            if (receipt.size > 5 * 1024 * 1024) { setError(t('supplierPurchase.fileLimit')); return; }
            void run(async () => { await api.recordExternal(row.id, reference, paidOn, row.amount_ttc, row.currency, receipt); }); }}>
            <fieldset disabled={busy} className="space-y-3"><legend className="font-semibold">{t('supplierPurchase.recordExternal')}</legend>
              <label className="block">{t('supplierPurchase.paymentReference')}<Input required maxLength={160} value={reference} onChange={e => setReference(e.target.value)} /></label>
              <label className="block">{t('supplierPurchase.paidOn')}<Input required type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} /></label>
              <label className="block">{t('supplierPurchase.receipt')}<Input required type="file" accept="application/pdf,image/png,image/jpeg" onChange={e => setReceipt(e.target.files?.[0])} /></label>
              <p>{t('supplierPurchase.receiptConfirm', { amount })}</p><Button disabled={!receipt || busy}>{t('supplierPurchase.confirmReceipt')}</Button>
            </fieldset>
          </form></>}
    </div>}
  </div>;
}
function PurchaseForm({ scope, onSaved, onCancel }: { scope: string; onSaved: () => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation(); const lock = useRef(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [requestId] = useState(() => crypto.randomUUID()); const [invoice, setInvoice] = useState<File>();
  const properties = useQuery({ queryKey: ['supplier-properties', scope], queryFn: () => propertiesApi.getAll() });
  const [draft, setDraft] = useState({ propertyId: '', supplierName: '', supplierEmail: '', invoiceReference: '', description: '', expenseDate: '', amountHt: '', taxRate: '0.20' });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (lock.current || !invoice) return;
    if (invoice.size > 5 * 1024 * 1024) { setError(t('supplierPurchase.fileLimit')); return; }
    lock.current = true; setBusy(true); setError('');
    try { await api.create({ ...draft, requestId, propertyId: Number(draft.propertyId), amountHt: draft.amountHt.replace(',', '.'), taxRate: draft.taxRate.replace(',', '.') }, invoice); await onSaved(); }
    catch (failure) { setError(getErrorMessage(failure)); } finally { lock.current = false; setBusy(false); }
  };
  return <form className="space-y-3 rounded-lg bg-muted p-4 text-sm" onSubmit={e => void submit(e)}>
    <fieldset disabled={busy} className="space-y-3"><legend className="font-semibold">{t('supplierPurchase.new')}</legend>
      <label className="block">{t('supplierPurchase.property')}<select className="mt-1 block w-full rounded-md border border-border bg-card p-2 text-foreground focus-visible:outline focus-visible:outline-2" required value={draft.propertyId} onChange={e => setDraft(old => ({ ...old, propertyId: e.target.value }))}>
        <option value="">{t('supplierPurchase.chooseProperty')}</option>{properties.data?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      {properties.isError && <p role="alert">{t('supplierPurchase.loadError')}</p>}
      <div className="grid gap-3 sm:grid-cols-2">{(['supplierName', 'supplierEmail', 'invoiceReference', 'description', 'expenseDate', 'amountHt', 'taxRate'] as const).map(field => <label className="block min-w-0" key={field}>{t(`supplierPurchase.fields.${field}`)}
        <Input required className="mt-1" type={field === 'expenseDate' ? 'date' : field === 'supplierEmail' ? 'email' : 'text'}
          value={draft[field]} onChange={e => setDraft(old => ({ ...old, [field]: e.target.value }))} /></label>)}</div>
      <label className="block">{t('supplierPurchase.invoice')}<Input required type="file" accept="application/pdf,image/png,image/jpeg" onChange={e => setInvoice(e.target.files?.[0])} /></label>
      <p className="text-muted-foreground">{t('supplierPurchase.createHelp')}</p>{error && <p role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2"><Button disabled={!invoice || !draft.propertyId || properties.isError || busy}>{t('supplierPurchase.save')}</Button><Button type="button" variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button></div>
    </fieldset>
  </form>;
}

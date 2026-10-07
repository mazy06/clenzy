import DocumentStatusIcon from '../documents/components/DocumentStatusIcon';
import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileCheck2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, Button, Field, FieldLabel, Input, Skeleton, Textarea } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useCommerceScope } from '../../hooks/useCommerceScope';
import { useTranslation } from '../../hooks/useTranslation';
import { baitlyDocumentVerificationApi as api, type InvoiceDraft } from '../../services/api/baitlyDocumentVerificationApi';
import { invoicesApi, type Invoice } from '../../services/api/invoicesApi';
import BaitlyInvoiceFiscalPanel from './BaitlyInvoiceFiscalPanel';

export default function BaitlyDocumentVerificationPanel({ invoice, inHub = false }: { invoice: Invoice; inHub?: boolean }) {
  const { user, isPlatformStaff } = useAuth();const scope = useCommerceScope();
  if (!scope || !(isPlatformStaff() || ['OWNER', 'ADMIN'].includes(user?.orgRole ?? ''))) return null;
  return <Verification key={`${scope}:${invoice.id}`} scope={scope} invoice={invoice} inHub={inHub} />;
}

function Verification({ invoice, scope, inHub }: { invoice: Invoice; scope: string; inHub: boolean }) {
  const { t } = useTranslation();const id = useId();const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<InvoiceDraft>(() => ({ ...invoice, sourceHash: '' }));
  const key = ['document-verification', scope, invoice.id];
  const query = useQuery({ queryKey: key, queryFn: () => api.get(invoice.id), retry: false });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['document-verification'] });
    void client.invalidateQueries({ queryKey: ['invoices'] });
    void client.invalidateQueries({ queryKey: ['invoice-fiscal-document'] });
  };
  const check = useMutation({ mutationFn: () => api.check(invoice.id), onSuccess: value => { client.setQueryData(key, value);refresh(); } });
  const save = useMutation({ mutationFn: () => api.update(invoice.id, draft), onSuccess: value => { client.setQueryData(key, value);setEditing(false);refresh(); } });
  const issue = useMutation({ mutationFn: () => invoicesApi.issue(invoice.id), onSuccess: refresh, onError: refresh });
  const busy = check.isPending || save.isPending || issue.isPending;
  const error = query.error || check.error || save.error || issue.error;
  const fields = ['sellerName', 'sellerAddress', 'sellerTaxId', 'buyerName', 'buyerAddress', 'buyerTaxId'] as const;
  return <section className="mt-4 space-y-4 border-t border-border pt-4 text-sm" aria-label={t('documentVerification.title')}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-semibold"><FileCheck2 size={18} aria-hidden="true" />{t('documentVerification.title')}</h3>
      {query.data && <DocumentStatusIcon value={query.data.state} label={t(`documentVerification.states.${query.data.state}`)} />}
    </div>
    <p className="max-w-[70ch] text-muted-foreground">{t('documentVerification.hint')}</p>
    {query.isPending && <Skeleton className="h-20 w-full" />}
    {error && <Alert variant="destructive" role="alert"><AlertDescription>{error.message}<Button variant="ghost" size="sm" onClick={() => void query.refetch()}>{t('common.retry')}</Button></AlertDescription></Alert>}
    {!!query.data?.issues.length && <Alert variant="warning"><AlertDescription><ul className="list-disc space-y-2 ps-4">{query.data.issues.map(value => <li key={value.code}>{value.message}</li>)}</ul></AlertDescription></Alert>}
    {invoice.paidAt && invoice.status === 'DRAFT' && <p className="text-muted-foreground">{t('documentVerification.paymentPreserved')}</p>}
    {query.data && <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy} onClick={() => check.mutate()}>{t('documentVerification.check')}</Button>
      {invoice.status === 'DRAFT' && !editing && <Button variant="outline" disabled={busy} onClick={() => { setDraft({ ...invoice, sourceHash: query.data!.sourceHash });setEditing(true); }}>{t('documentVerification.complete')}</Button>}
      {invoice.status === 'DRAFT' && <Button disabled={busy || editing || query.data.state !== 'CHECKED'} onClick={() => issue.mutate()}>{t('documentVerification.issue')}</Button>}
    </div>}
    {editing && <form className="space-y-3" onSubmit={event => { event.preventDefault();save.mutate(); }}>
      <fieldset className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2" disabled={busy}>{fields.map(field => <Field key={field}>
        <FieldLabel htmlFor={`${id}-${field}`}>{t(`documentVerification.fields.${field}`)}</FieldLabel>
        <Input id={`${id}-${field}`} value={draft[field] ?? ''} maxLength={field.endsWith('TaxId') ? 50 : field.endsWith('Address') ? 2000 : 255} onChange={event => setDraft(value => ({ ...value, [field]: event.target.value }))} />
      </Field>)}</fieldset>
      <Field><FieldLabel htmlFor={`${id}-mentions`}>{t('documentVerification.fields.legalMentions')}</FieldLabel><Textarea id={`${id}-mentions`} rows={3} maxLength={10000} value={draft.legalMentions ?? ''} disabled={busy} onChange={event => setDraft(value => ({ ...value, legalMentions: event.target.value }))} /></Field>
      <Field><FieldLabel htmlFor={`${id}-due`}>{t('documentVerification.fields.dueDate')}</FieldLabel><Input id={`${id}-due`} type="date" value={draft.dueDate ?? ''} disabled={busy} onChange={event => setDraft(value => ({ ...value, dueDate: event.target.value || null }))} /></Field>
      <div className="flex gap-2"><Button type="submit" disabled={busy}>{t('documentVerification.save')}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>{t('common.cancel')}</Button></div>
    </form>}
    {query.data && <p className="text-xs text-muted-foreground">{t(query.data.pdfArchived ? 'documentVerification.archived' : 'documentVerification.notArchived')}</p>}
    {!!query.data?.history.length && <details className="border-t border-border pt-3"><summary className="cursor-pointer rounded-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">{t('documentVerification.history')}</summary>
      <ol className="mt-3 divide-y divide-border">{query.data.history.map(review => <li key={review.id} className="space-y-1 py-2">
        <p>{t(`documentVerification.states.${review.state}`)}{!review.current && ` · ${t('documentVerification.previous')}`}</p>
        <p className="tabular-nums text-xs text-muted-foreground">{new Date(review.checkedAt).toLocaleString()} · {review.actor}</p>
        <p className="text-xs text-muted-foreground">{review.version}</p>
        {review.issues.map(value => <p key={value.code} className="text-xs">{value.message}</p>)}
      </li>)}</ol>
    </details>}
    {!inHub && <Link className="inline-flex min-h-9 items-center gap-2 rounded-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring" to={`/documents?tab=compliance&invoice=${invoice.id}`}><ExternalLink size={15} aria-hidden="true" />{t('documentVerification.openHub')}</Link>}
    <BaitlyInvoiceFiscalPanel invoice={invoice} />
  </section>;
}

import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Download, FileCheck2 } from 'lucide-react';
import { Alert, AlertDescription, Button, Field, FieldLabel, Input, NativeSelect, NativeSelectOption, Textarea, Skeleton } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import type { Invoice } from '../../services/api/invoicesApi';
import { baitlyInvoiceFiscalApi as api, type FiscalCheck, type FiscalParty, type FiscalPreparation, type FiscalRequest } from '../../services/api/baitlyInvoiceFiscalApi';

const empty = (): FiscalParty => ({ postcode: '', city: '', legalId: '', routingId: '' });

/** Le serveur contrôle à nouveau la gestion de l'organisation et la facture ciblée. */
export default function BaitlyInvoiceFiscalPanel({ invoice }: { invoice: Invoice }) {
  const { user, isPlatformStaff } = useAuth();
  if (!user?.organizationId || !(isPlatformStaff() || ['OWNER', 'ADMIN'].includes(user.orgRole ?? ''))
    || invoice.countryCode !== 'FR' || invoice.status === 'DRAFT' || invoice.duplicateOfId) return null;
  const scope = `${user.id}:${user.organizationId}`;
  return <Panel key={`${scope}:${invoice.id}`} invoice={invoice} scope={scope} />;
}

function Panel({ invoice, scope }: { invoice: Invoice; scope: string }) {
  const { t } = useTranslation();const id = useId();const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<FiscalPreparation>({ seller: empty(), buyer: empty(), terms: { processCode: '', recoveryCosts: '', latePenalties: '', discount: '' } });
  const [check, setCheck] = useState<FiscalCheck | null>(null);
  const [checkedHash, setCheckedHash] = useState('');
  const key = ['invoice-fiscal-document', scope, invoice.id];
  const query = useQuery({ queryKey: key, enabled: open, queryFn: () => api.get(invoice.id), retry: false });
  const sourceHash = query.data?.sourceHash ?? '';
  const validation = useMutation({ mutationFn: (request: FiscalRequest) => api.check(invoice.id, request), onSuccess: (result, request) => { setCheck(result);setCheckedHash(request.sourceHash); } });
  const archive = useMutation({ mutationFn: () => api.archive(invoice.id, { sourceHash, data }), onSuccess: result => {
    client.setQueryData(key, result);setCheck(null);void client.invalidateQueries({ queryKey: ['fiscal-submissions', scope] });
  }, onError: () => { setCheck(null);void client.invalidateQueries({ queryKey: key }); } });
  const download = useMutation({ mutationFn: async () => {
    const blob = await api.download(invoice.id);const url = URL.createObjectURL(blob);const anchor = document.createElement('a');
    try { anchor.href = url;anchor.download = `baitly-invoice-${invoice.id}.xml`;anchor.click(); } finally { URL.revokeObjectURL(url); }
  } });
  const busy = validation.isPending || archive.isPending;
  const error = validation.error || (!query.data?.archivedAt && archive.error) || download.error || query.error;
  const archived = !!query.data?.archivedAt;
  const transmissionIssues = (archived ? query.data?.transmissionIssues : check?.transmissionIssues) ?? [];
  const fields: (keyof FiscalParty)[] = ['postcode', 'city', 'legalId', 'routingId'];
  const change = (party: 'seller' | 'buyer', field: keyof FiscalParty, value: string) => {
    setData(old => ({ ...old, [party]: { ...old[party], [field]: value } }));setCheck(null);validation.reset();archive.reset();
  };

  return <section className="mt-5 border-t border-border pt-4 text-sm">
    <Button variant="ghost" className="w-full justify-between whitespace-normal text-start" aria-expanded={open} aria-controls={`${id}-content`} onClick={() => setOpen(value => !value)}>
      <span className="flex items-center gap-2"><FileCheck2 size={18} aria-hidden="true" />{t('fiscalDocument.title')}</span>
      <ChevronDown size={16} aria-hidden="true" className={open ? 'rotate-180' : ''} />
    </Button>
    {open && <div id={`${id}-content`} className="mt-3 space-y-4">
      <p className="text-muted-foreground">{t('fiscalDocument.hint')}</p>
      {query.isPending && <Skeleton className="h-24 w-full" />}
      {error && <Alert variant="destructive" role="alert"><AlertDescription>{t('fiscalDocument.error')} {error.message}
        {query.error && <Button variant="ghost" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>{t('common.retry', 'Réessayer')}</Button>}
      </AlertDescription></Alert>}
      {query.data?.issues.length ? <Alert variant="warning"><AlertDescription><ul className="list-disc space-y-1 ps-4">{query.data.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></AlertDescription></Alert> : null}
      {transmissionIssues.length > 0 && <Alert variant="warning"><AlertDescription>
        <p className="font-medium">{t('fiscalDocument.transmissionBlocked')}</p>
        <ul className="mt-2 list-disc space-y-2 ps-4">{transmissionIssues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul>
      </AlertDescription></Alert>}
      {archived ? <>
        <p role="status" className="font-medium">{t(query.data?.state === 'LOCAL_VALIDATED' ? 'fiscalDocument.archived' : 'fiscalDocument.review')}</p>
        <p className="text-xs text-muted-foreground break-words">{query.data?.validation}</p>
        <Button variant="outline" size="sm" disabled={download.isPending || query.data?.state !== 'LOCAL_VALIDATED'} onClick={() => download.mutate()}>
          <Download size={16} aria-hidden="true" />{t('fiscalDocument.download')}
        </Button>
      </> : query.data && !query.data.issues.length && <form className="space-y-5" onSubmit={event => { event.preventDefault();setCheck(null);validation.mutate({ sourceHash, data }); }}>
        {(['seller', 'buyer'] as const).map(party => <fieldset key={party} className="min-w-0 space-y-3" disabled={busy}>
          <legend className="font-medium">{t(`fiscalDocument.${party}`)}</legend>
          <p className="break-words text-muted-foreground">{party === 'seller' ? invoice.sellerName : invoice.buyerName}<br />{party === 'seller' ? invoice.sellerAddress : invoice.buyerAddress}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{fields.map(field => <Field key={field}>
            <FieldLabel htmlFor={`${id}-${party}-${field}`}>{t(`fiscalDocument.${field}`)}</FieldLabel>
            <Input id={`${id}-${party}-${field}`} value={data[party][field]} required autoComplete="off"
              inputMode={field === 'postcode' || field === 'legalId' ? 'numeric' : 'text'}
              maxLength={field === 'postcode' ? 5 : field === 'legalId' ? 9 : 100}
              pattern={field === 'postcode' ? '[0-9]{5}' : field === 'legalId' ? '[0-9]{9}' : undefined}
              onChange={event => change(party, field, event.target.value)} />
          </Field>)}</div>
        </fieldset>)}
        <fieldset className="min-w-0 space-y-3" disabled={busy}>
          <legend className="font-medium">{t('fiscalDocument.termsTitle')}</legend>
          <p className="text-muted-foreground">{t('fiscalDocument.termsHint')}</p>
          <blockquote className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{invoice.legalMentions || t('fiscalDocument.missingTerms')}</blockquote>
          <Field><FieldLabel htmlFor={`${id}-process`}>{t('fiscalDocument.processCode')}</FieldLabel>
            <NativeSelect id={`${id}-process`} required value={data.terms.processCode} onChange={event => {
              setData(old => ({ ...old, terms: { ...old.terms, processCode: event.target.value } }));setCheck(null);
            }}>
              <NativeSelectOption value="">{t('fiscalDocument.chooseProcess')}</NativeSelectOption>
              {['B1', 'S1', 'M1'].map(code => <NativeSelectOption key={code} value={code}>{t(`fiscalDocument.process.${code}`)}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          {(['recoveryCosts', 'latePenalties', 'discount'] as const).map(field => <Field key={field}>
            <FieldLabel htmlFor={`${id}-${field}`}>{t(`fiscalDocument.${field}`)}</FieldLabel>
            <Textarea id={`${id}-${field}`} value={data.terms[field]} required maxLength={2000} rows={2} onChange={event => {
              setData(old => ({ ...old, terms: { ...old.terms, [field]: event.target.value } }));setCheck(null);
            }} />
          </Field>)}
        </fieldset>
        {check && <div role="status"><p className="font-medium">{t(check.valid ? 'fiscalDocument.checked' : 'fiscalDocument.invalid')}</p>
          <ul className="mt-2 space-y-2 text-muted-foreground">{check.issues.map((issue, index) => <li key={`${issue.code}-${index}`}><span className="font-medium">{issue.code}</span> · {issue.message}</li>)}</ul>
        </div>}
        <p className="text-xs text-muted-foreground">{t('fiscalDocument.archiveHint')}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline" disabled={busy}>{t(validation.isPending ? 'fiscalDocument.checking' : 'fiscalDocument.check')}</Button>
          <Button type="button" disabled={busy || !check?.valid || checkedHash !== sourceHash} onClick={() => archive.mutate()}>{t(archive.isPending ? 'fiscalDocument.archiving' : 'fiscalDocument.archive')}</Button>
        </div>
      </form>}
    </div>}
  </section>;
}

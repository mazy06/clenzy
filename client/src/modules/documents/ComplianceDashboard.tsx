import { forwardRef, useImperativeHandle, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, Button, NativeSelect, NativeSelectOption, Skeleton } from '../../components/ui';
import PagePagination from '../../components/PagePagination';
import { useAuth } from '../../hooks/useAuth';
import { useCommerceScope } from '../../hooks/useCommerceScope';
import { useTranslation } from '../../hooks/useTranslation';
import { baitlyDocumentVerificationApi as api } from '../../services/api/baitlyDocumentVerificationApi';
import DocumentsWorkspace, { DOCUMENT_ART, DocumentFacts } from './components/DocumentsWorkspace';
import BaitlyDocumentVerificationPanel from '../invoices/BaitlyDocumentVerificationPanel';
import BaitlyFiscalSubmissions from '../settings/BaitlyFiscalSubmissions';
import BaitlySaleDocuments from '../payments/BaitlySaleDocuments';

export interface ComplianceDashboardRef { fetchData: () => void; searchByNumber: (number: string) => void }
function amount(value: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value); } catch { return '—'; }
}
const ComplianceDashboard = forwardRef<ComplianceDashboardRef>((_, ref) => {
  const { t } = useTranslation();const { user, isPlatformStaff } = useAuth();const scope = useCommerceScope();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');const [country, setCountry] = useState('');const [state, setState] = useState('');const [page, setPage] = useState(0);
  const [copiesOpen, setCopiesOpen] = useState(false);const [copySource, setCopySource] = useState('SUBSCRIPTION');
  const allowed = !!scope && (isPlatformStaff() || ['OWNER', 'ADMIN'].includes(user?.orgRole ?? ''));
  const query = useQuery({ queryKey: ['document-verification', scope, 'list'], enabled: allowed, queryFn: api.list, retry: false });
  useImperativeHandle(ref, () => ({ fetchData: () => { if (allowed) void query.refetch(); }, searchByNumber: value => { setSearch(value);setPage(0); } }));
  const rows = query.data?.filter(row => (!country || row.invoice.countryCode === country) && (!state || row.state === state)
    && `${row.invoice.invoiceNumber} ${row.invoice.buyerName} ${row.invoice.sellerName}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())) ?? [];
  const pageIndex = Math.min(page, Math.max(0, Math.ceil(rows.length / 20) - 1));
  const selected = params.get('invoice') ?? query.data?.find(row => params.has('generation') && String(row.invoice.documentGenerationId) === params.get('generation'))?.invoice.id.toString() ?? null;
  const select = (value: string | number | null) => setParams(previous => { const next = new URLSearchParams(previous);next.delete('generation');if (value == null) next.delete('invoice');else next.set('invoice', String(value));return next; }, { replace: true });
  const record = (row: typeof rows[number]) => ({ id: String(row.invoice.id), title: row.invoice.invoiceNumber, subtitle: row.invoice.buyerName,
    meta: amount(row.invoice.totalTtc, row.invoice.currency), image: DOCUMENT_ART.compliance,
    status: { value: row.state, label: t(`documentVerification.states.${row.state}`) },
    detail: <><DocumentFacts items={[
      { label: t('documentsWorkspace.recipient'), value: row.invoice.buyerName },
      { label: t('documentVerification.fields.sellerName'), value: row.invoice.sellerName },
      { label: t('documentVerification.country'), value: row.invoice.countryCode },
      { label: t('documentsWorkspace.total'), value: amount(row.invoice.totalTtc, row.invoice.currency) },
    ]} /><BaitlyDocumentVerificationPanel invoice={row.invoice} inHub /></> });
  const selectedIndex = rows.findIndex(row => String(row.invoice.id) === selected);
  const visiblePage = selectedIndex >= 0 ? Math.floor(selectedIndex / 20) : pageIndex;
  if (!allowed) return <p className="py-6 text-sm text-muted-foreground">{t('documentVerification.restricted')}</p>;
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-3">
      <NativeSelect aria-label={t('documentVerification.country')} value={country} onChange={event => { setCountry(event.target.value);setPage(0); select(null); }}><NativeSelectOption value="">{t('documentVerification.allCountries')}</NativeSelectOption>{['FR', 'MA', 'SA'].map(value => <NativeSelectOption key={value}>{value}</NativeSelectOption>)}</NativeSelect>
      <NativeSelect aria-label={t('documentVerification.stage')} value={state} onChange={event => { setState(event.target.value);setPage(0); select(null); }}><NativeSelectOption value="">{t('documentVerification.allStates')}</NativeSelectOption>{['TO_CHECK', 'BLOCKED', 'CHECKED', 'COPY'].map(value => <NativeSelectOption key={value} value={value}>{t(`documentVerification.states.${value}`)}</NativeSelectOption>)}</NativeSelect>
    </div>
    {query.isPending && <Skeleton className="h-64 w-full" />}
    {query.error && <Alert variant="destructive" role="alert"><AlertDescription>{t('documentVerification.loadError')} <Button variant="ghost" onClick={() => void query.refetch()}>{t('common.retry')}</Button></AlertDescription></Alert>}
    {query.data && !query.error && <DocumentsWorkspace label={t('documentsWorkspace.views.checks')} records={rows.slice(visiblePage * 20, (visiblePage + 1) * 20).map(record)} selectedId={selected} onSelect={select}
      empty={t('documentVerification.empty')}
      pagination={<PagePagination page={visiblePage} rowsPerPage={20} count={rows.length} onPageChange={value => { select(null); setPage(value); }} />} />}
    <BaitlyFiscalSubmissions compactStatus country={country || undefined} onSelectInvoice={id => { setState('');setSearch('');setPage(0);select(id); }} />
    <details className="border-t border-border pt-4" open={copiesOpen} onToggle={event => setCopiesOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">{t('documentVerification.copies')}</summary>
      <p className="my-3 max-w-[75ch] text-sm text-muted-foreground">{t('documentVerification.copiesHint')}</p>
      {copiesOpen && <><NativeSelect aria-label={t('documentVerification.copySource')} value={copySource} onChange={event => setCopySource(event.target.value)}>
        {['SUBSCRIPTION', 'AI_CREDIT_TOPUP', 'HARDWARE_ORDER'].map(value => <NativeSelectOption key={value} value={value}>{t(`documentVerification.sources.${value}`)}</NativeSelectOption>)}
      </NativeSelect><BaitlySaleDocuments key={`${scope}:${copySource}`} source={copySource} /></>}
    </details>
  </div>;
});
ComplianceDashboard.displayName = 'ComplianceDashboard';
export default ComplianceDashboard;

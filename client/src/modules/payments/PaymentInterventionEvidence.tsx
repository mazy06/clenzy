import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ExternalLink, FileText, MapPin } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Skeleton, Spinner } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { activeIntlLocale } from '../../utils/activeLocale';
import { buildApiUrl } from '../../config/api';
import { getAccessToken } from '../../keycloak';
import { documentsApi } from '../../services/api/documentsApi';
import { invoicesApi } from '../../services/api/invoicesApi';
import { serviceQuotesApi } from '../../services/api/serviceQuotesApi';
import { providerExpensesApi } from '../../services/api/providerExpensesApi';
import { propertiesApi } from '../../services/api/propertiesApi';
import type { InterventionDetailsData } from '../interventions/interventionUtils';
import { MapTile } from '../notifications/NotificationFieldParts';
import { StockThumbnail } from '../stock/StockThumbnail';
import FinanceStatusIcon from '../billing/components/FinanceStatusIcon';

import PaymentDetailPager from './PaymentDetailPager';

type DocumentLink = { key: string; title: string; caption: string; generationId?: number; path?: string };

/** Les pièces sont rapprochées par identifiant de mission, jamais par nom ou date. */
export default function PaymentInterventionEvidence({ intervention, view }: { intervention: InterventionDetailsData; view: 'location' | 'documents' | 'restock' }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const scope = `${user?.id}:${user?.organizationId}`;
  const enabled = !!user;
  const property = useQuery({ queryKey: ['finance-property', scope, intervention.propertyId],
    enabled: enabled && view === 'location' && !!intervention.propertyId, queryFn: () => propertiesApi.getById(intervention.propertyId), staleTime: 300_000, retry: false });
  const generations = useQuery({ queryKey: ['payment-documents', scope, intervention.id], enabled: enabled && view === 'documents',
    queryFn: () => documentsApi.getGenerationsByReference('INTERVENTION', intervention.id), staleTime: 60_000, retry: false });
  const quotes = useQuery({ queryKey: ['payment-quotes', scope, intervention.id], enabled: enabled && view === 'documents',
    queryFn: () => serviceQuotesApi.list(intervention.id), staleTime: 60_000, retry: false });
  const invoices = useQuery({ queryKey: ['payment-invoices', scope], enabled: enabled && view === 'documents',
    queryFn: () => invoicesApi.list(), staleTime: 60_000, retry: false });
  const expenses = useQuery({ queryKey: ['payment-expenses', scope], enabled: enabled && view === 'restock',
    queryFn: () => providerExpensesApi.getAll(), staleTime: 60_000, retry: false });
  const linkedInvoices = (invoices.data ?? []).filter(item => item.interventionId === intervention.id);
  const linkedExpenses = (expenses.data ?? []).filter(item => item.interventionId === intervention.id && item.status !== 'CANCELLED');
  const links: DocumentLink[] = [];
  const seen = new Set<number>();
  for (const invoice of linkedInvoices) {
    if (invoice.documentGenerationId) seen.add(invoice.documentGenerationId);
    links.push({ key: `invoice-${invoice.id}`, title: t(invoice.status === 'CREDIT_NOTE' ? 'invoices.status.CREDIT_NOTE' : 'paymentDetail.invoice'), caption: invoice.invoiceNumber,
      generationId: invoice.documentGenerationId ?? undefined, path: `/invoices/${invoice.id}/pdf` });
  }
  for (const quote of quotes.data ?? []) {
    if (quote.interventionId !== intervention.id || !quote.documentGenerationId || seen.has(quote.documentGenerationId)) continue;
    seen.add(quote.documentGenerationId);
    links.push({ key: `quote-${quote.id}`, title: t('paymentDetail.quote'), caption: `${quote.providerName} · #${quote.id}`, generationId: quote.documentGenerationId });
  }
  for (const document of generations.data ?? []) {
    if (document.referenceId !== intervention.id || document.referenceType !== 'INTERVENTION' || seen.has(document.id) || !['DEVIS', 'DEVIS_PRESTATAIRE', 'DEVIS_MENAGE', 'FACTURE'].includes(document.documentType) || document.status !== 'COMPLETED') continue;
    seen.add(document.id);
    links.push({ key: `document-${document.id}`, title: t(document.documentType === 'FACTURE' ? 'paymentDetail.invoice' : 'paymentDetail.quote'),
      caption: document.legalNumber || document.fileName, generationId: document.id });
  }
  const [preview, setPreview] = useState<{ title: string; url?: string; error?: boolean } | null>(null);
  const request = useRef(0);
  const blob = useRef<string | null>(null);
  const clearPreview = () => {
    request.current++;
    if (blob.current) URL.revokeObjectURL(blob.current);
    blob.current = null;
    setPreview(null);
  };
  useEffect(() => () => { request.current++; if (blob.current) URL.revokeObjectURL(blob.current); }, []);
  const openDocument = async (item: DocumentLink) => {
    const version = ++request.current;
    if (blob.current) URL.revokeObjectURL(blob.current);
    blob.current = null;
    setPreview({ title: `${item.title} · ${item.caption}` });
    try {
      let url: string;
      if (item.generationId) url = await documentsApi.fetchGenerationBlobUrl(item.generationId);
      else {
        const token = getAccessToken();
        const response = await fetch(buildApiUrl(item.path!), { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!response.ok) throw new Error('Document unavailable');
        url = URL.createObjectURL(await response.blob());
      }
      if (version !== request.current) { URL.revokeObjectURL(url); return; }
      blob.current = url;
      setPreview({ title: `${item.title} · ${item.caption}`, url });
    } catch { if (version === request.current) setPreview({ title: item.title, error: true }); }
  };
  const address = [intervention.propertyAddress || property.data?.address,
    [intervention.propertyPostalCode || property.data?.postalCode, intervention.propertyCity || property.data?.city].filter(Boolean).join(' '),
    intervention.propertyCountry || property.data?.country].filter(Boolean).join(' · ');
  const money = (amount: number, currency: string) => new Intl.NumberFormat(activeIntlLocale(), { style: 'currency', currency }).format(amount);
  const totals = linkedExpenses.reduce<Record<string, number>>((sum, expense) => ({ ...sum, [expense.currency]: (sum[expense.currency] ?? 0) + expense.amountTtc }), {});

  return <>
    {view === 'location' && <section className="payment-record-detail__location">
      <div><h4>{t('paymentDetail.address')}</h4><p><MapPin size={15} /><span>{address || t('paymentDetail.notProvided')}</span></p></div>
      {!!address && <MapTile key={intervention.propertyId} property={property.data ?? null} address={address} />}
    </section>}
    {view === 'documents' && <PaymentDetailPager items={[
      ...((generations.isLoading || invoices.isLoading || quotes.isLoading) ? [<Skeleton className="h-12 w-full" />] : []),
      ...links.map(item => <div className="payment-record-detail__documents"><button type="button" aria-label={`${item.title} ${item.caption}`} onClick={() => void openDocument(item)}>
        <img src="/images/finance-kpis/documents.png" alt="" width={36} height={36} /><span><strong>{item.title}</strong><small>{item.caption}</small></span><ExternalLink size={15} />
      </button></div>),
      ...((generations.isError || invoices.isError || quotes.isError) ? [<p className="payment-record-detail__muted" role="status">{t('paymentDetail.documentsUnavailable')}</p>] : []),
      ...(!links.length && !generations.isLoading && !quotes.isLoading && !invoices.isLoading && !generations.isError && !quotes.isError && !invoices.isError ? [<p className="payment-record-detail__muted">{t('paymentDetail.noDocuments')}</p>] : []),
    ]} />}
    {view === 'restock' && <PaymentDetailPager items={[
      <div className="payment-record-detail__section-heading"><h4>{t('paymentDetail.restockExpenses')}</h4><div className="payment-record-detail__expense-totals">{Object.entries(totals).map(([currency, amount]) => <strong key={currency}>{money(amount, currency)}</strong>)}</div></div>,
      ...(expenses.isLoading ? [<Skeleton className="h-16 w-full" />] : []),
      ...(expenses.isError ? [<p className="payment-record-detail__muted" role="alert">{t('paymentDetail.expensesUnavailable')}</p>] : []),
      ...(!expenses.isLoading && !expenses.isError && !linkedExpenses.length ? [<p className="payment-record-detail__muted">{t('paymentDetail.noRestock')}</p>] : []),
      ...linkedExpenses.map(expense => <div className="payment-record-detail__expense">
        {expense.category === 'SUPPLIES' ? <StockThumbnail name={expense.description} size={44} /> : <img src="/images/finance-kpis/documents.png" alt="" width={44} height={44} />}
        <div><strong>{expense.description}</strong><small>{[expense.providerName, expense.invoiceReference].filter(Boolean).join(' · ')}</small>
          <FinanceStatusIcon value={expense.status} label={t(`accounting.expenses.statuses.${expense.status}`, expense.status)} />
        </div><span className="payment-record-detail__expense-amount">{money(expense.amountTtc, expense.currency)}</span>
        {expense.receiptPath && <Button variant="ghost" size="icon" aria-label={t('paymentDetail.receiptFor', { name: expense.description })} onClick={() => void openDocument({ key: `expense-${expense.id}`, title: t('paymentDetail.receipt'), caption: expense.description, path: `/provider-expenses/${expense.id}/receipt` })}><FileText size={17} /></Button>}
      </div>),
      ...(linkedExpenses.length ? [<p className="payment-record-detail__muted">{t('paymentDetail.restockNote')}</p>] : []),
    ]} />}
    <Dialog open={!!preview} onOpenChange={open => { if (!open) clearPreview(); }}><DialogContent className="sm:max-w-3xl">
      <DialogHeader><DialogTitle>{preview?.title}</DialogTitle></DialogHeader>
      {preview?.error ? <p role="alert">{t('paymentDetail.documentError')}</p> : preview?.url ? <>
        <iframe title={preview.title} src={preview.url} className="h-[60dvh] w-full rounded-lg border border-border" />
        <a href={preview.url} target="_blank" rel="noopener noreferrer" className="payment-record-detail__document-link"><Download size={16} />{t('paymentDetail.openDocument')}</a>
      </> : <div className="flex h-48 items-center justify-center"><Spinner /></div>}
    </DialogContent></Dialog>
  </>;
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText } from '../../icons/glyphs';
import { Button, Skeleton } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { useCommerceScope } from '../../hooks/useCommerceScope';
import apiClient from '../../services/apiClient';

export interface SaleDocument {
  id: number; sourceRef: string; kind: 'INVOICE' | 'CREDIT_NOTE'; state: string; number: string | null;
  currency: string | null; netCents: number | null; totalCents: number | null; pdfUrl: string | null;
  issuedAt: string | null; failure: string | null;
}
export default function BaitlySaleDocuments({ source, sourceId, reference }: { source: string; sourceId?: number; reference?: string }) {
  const scope = useCommerceScope();const { t, currentLanguage } = useTranslation();
  const query = useQuery({ queryKey: ['sale-documents', scope, source, sourceId], enabled: !!scope, retry: false,
    queryFn: () => apiClient.get<SaleDocument[]>(source === 'HARDWARE_ORDER' && sourceId
      ? `/shop/orders/${sourceId}/documents` : `/commerce/documents?source=${encodeURIComponent(source)}${sourceId === undefined ? '' : `&sourceId=${sourceId}`}`) });
  const [exportError, setExportError] = useState(false);const [exporting, setExporting] = useState<number | null>(null);
  async function exportDocument(row: SaleDocument) {
    if (exporting !== null) return;setExporting(row.id);setExportError(false);
    try {
      const path = source === 'HARDWARE_ORDER' && sourceId ? `/shop/orders/${sourceId}/documents/${row.id}/export` : `/commerce/documents/${row.id}/export`;
      const data = await apiClient.get<Record<string, unknown>>(path);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');link.href = url;link.download = `baitly-document-${row.id}.json`;document.body.append(link);link.click();link.remove();setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setExportError(true); } finally { setExporting(null); }
  }
  const rows = query.data?.filter(row => !reference || row.sourceRef === reference);
  const money = (value: number, currency: string) => new Intl.NumberFormat(currentLanguage, { style: 'currency', currency }).format(value / 100);
  return <section className="space-y-3 border-t border-border pt-3" aria-label={t('saleDocuments.title')}>
    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium">{t('saleDocuments.title')}</h3>
      <Button size="sm" variant="ghost" disabled={query.isFetching} onClick={() => void query.refetch()}>{t('common.refresh')}</Button></div>
    {query.isPending && <Skeleton className="h-12 w-full" />}
    {query.error && <p role="alert" className="text-sm text-destructive-ink">{t('saleDocuments.loadError')}</p>}
    {exportError && <p role="alert" className="text-sm text-destructive-ink">{t('saleDocuments.exportError')}</p>}
    {rows?.length === 0 && <p className="text-sm text-muted-foreground">{t('saleDocuments.pending')}</p>}
    <ul className="divide-y divide-border">{rows?.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
      <div className="min-w-0"><p>{t(`saleDocuments.${row.kind}`)} {row.number || ''}</p>
        {row.totalCents !== null && row.netCents !== null && row.currency && <p className="text-xs text-muted-foreground tabular-nums">{t('saleDocuments.amounts', { total: money(row.totalCents, row.currency), net: money(row.netCents, row.currency) })}</p>}
        {row.failure && <p className="mt-1 text-xs text-warning-ink">{t('saleDocuments.review')}</p>}
        {row.state !== 'READY' && !row.failure && <p className="text-xs text-muted-foreground">{t('saleDocuments.pending')}</p>}</div>
      {row.state === 'READY' && row.pdfUrl && safePdf(row.pdfUrl) && <a className="inline-flex cursor-pointer items-center gap-1.5 text-primary-ink underline underline-offset-4 focus-visible:outline focus-visible:outline-2" href={row.pdfUrl} target="_blank" rel="noreferrer"><FileText size={16} aria-hidden />{t('saleDocuments.open')}</a>}
      {row.state === 'READY' && <Button variant="ghost" size="sm" disabled={exporting !== null} onClick={() => void exportDocument(row)}>{t('saleDocuments.export')}</Button>}
    </li>)}</ul>
  </section>;
}
function safePdf(value: string) { try { const url = new URL(value);return url.protocol === 'https:' && !url.username && !url.password && (url.hostname === 'stripe.com' || url.hostname.endsWith('.stripe.com')); } catch { return false; } }

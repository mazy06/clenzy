import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, RefreshCw } from '../../icons/glyphs';
import { Alert, AlertDescription, Button, Skeleton } from '../../components/ui';
import PagePagination from '../../components/PagePagination';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import { useScreenSearch } from '../../components/ScreenChrome';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../contexts/AuthContext';
import { serviceQuotesApi } from '../../services/api/serviceQuotesApi';
import DocumentsWorkspace, { DOCUMENT_ART, DocumentFacts } from './components/DocumentsWorkspace';
import { formatCurrency } from '../../utils/currencyUtils';
import { intlLocale } from '../../utils/localeDate';

/** Bibliothèque Baitly des décisions acceptées, sans commande de modification du devis. */
export default function AmendmentArchives() {
  const { t, currentLanguage } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [search, setSearch] = useState('');
  const [querySearch, setQuerySearch] = useState('');
  const [downloading, setDownloading] = useState<number | null>(null);
  const [error, setError] = useState('');
  const downloadInProgress = useRef(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuerySearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  useScreenSearch(search, value => { setSearch(value.slice(0, 100)); setPage(0); }, t('amendmentLibrary.search'));
  const query = useQuery({
    queryKey: ['service-quotes', 'amendment-archives', user?.id, user?.organizationId, page, size, querySearch],
    queryFn: () => serviceQuotesApi.amendmentArchives(page, size, querySearch),
    enabled: !!user && !authLoading,
    staleTime: 10_000, refetchInterval: 15_000, retry: false,
  });
  useEffect(() => {
    if (query.data && page > Math.max(0, query.data.totalPages - 1)) setPage(Math.max(0, query.data.totalPages - 1));
  }, [query.data, page]);
  const actions = usePageHeaderActions(
    <Button variant="ghost" size="sm" disabled={!user || authLoading || query.isFetching} onClick={() => void query.refetch()}>
      <RefreshCw size={14} />{t('common.refresh')}
    </Button>,
  );
  const download = async (id: number) => {
    if (downloadInProgress.current) return;
    downloadInProgress.current = true;
    setDownloading(id); setError('');
    try { await serviceQuotesApi.downloadAmendment(id); }
    catch { setError(t('quoteAmendments.pdfFailed')); }
    finally { downloadInProgress.current = false; setDownloading(null); }
  };
  const pending = query.isPending || querySearch !== search.trim();
  const dates = new Intl.DateTimeFormat(intlLocale(currentLanguage), { dateStyle: 'medium', timeStyle: 'short' });

  return <>
    {actions}
    {error && <Alert variant="destructive" role="alert" className="mb-3"><AlertDescription>{error}</AlertDescription></Alert>}
    {query.isError ? <Alert variant="destructive" role="alert">
      <AlertDescription>{t('amendmentLibrary.loadFailed')}</AlertDescription>
      <Button variant="ghost" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>{t('quoteAmendments.retry')}</Button>
    </Alert> : pending ? <div role="status" aria-label={t('quoteAmendments.loading')} className="space-y-3">
      {[0, 1, 2].map(id => <Skeleton key={id} className="h-24 w-full motion-reduce:animate-none" />)}
    </div> : <>
      <DocumentsWorkspace label={t('amendmentLibrary.title')} records={(query.data?.content ?? []).map(entry => ({
        id: String(entry.id), title: t('amendmentLibrary.reference', { id: entry.id }), image: DOCUMENT_ART.contract,
        subtitle: t('amendmentLibrary.references', { quote: entry.quoteId, mission: entry.interventionId }),
        meta: formatCurrency(entry.proposedAmount, entry.currency, currentLanguage),
        status: { value: entry.archiveStatus, label: t(`amendmentLibrary.status.${entry.archiveStatus}`) },
        actions: entry.archiveStatus === 'READY' ? <Button size="sm" disabled={downloading !== null || query.isFetching}
          aria-label={t('amendmentLibrary.download', { id: entry.id })} onClick={() => void download(entry.id)}>
          <Download size={15} />{downloading === entry.id ? t('amendmentLibrary.downloading') : t('quoteAmendments.downloadPdf')}
        </Button> : undefined,
        detail: <><DocumentFacts items={[
          { label: t('amendmentLibrary.previousAmount'), value: formatCurrency(entry.originalAmount, entry.currency, currentLanguage) },
          { label: t('amendmentLibrary.acceptedAmount'), value: formatCurrency(entry.proposedAmount, entry.currency, currentLanguage) },
          { label: t('documentsWorkspace.date'), value: dates.format(new Date(entry.decidedAt)) },
        ]} /><h3>{t('documentsWorkspace.description')}</h3><p className="whitespace-pre-wrap">{entry.reason}</p></>,
      }))} empty={t('amendmentLibrary.empty')}
      pagination={<PagePagination page={page} onPageChange={setPage} count={query.data?.totalElements ?? 0}
        rowsPerPage={size} rowsPerPageOptions={[10, 20, 50]} hideOnSinglePage={false}
        onRowsPerPageChange={value => { setSize(value); setPage(0); }} />} />
    </>}
  </>;
}

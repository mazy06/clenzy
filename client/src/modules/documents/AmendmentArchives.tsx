import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, Badge, Button, Skeleton } from '../../components/ui';
import PagePagination from '../../components/PagePagination';
import EmptyState from '../../components/EmptyState';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import { useScreenSearch } from '../../components/ScreenChrome';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../contexts/AuthContext';
import { serviceQuotesApi } from '../../services/api/serviceQuotesApi';
import { formatCurrency } from '../../utils/currencyUtils';

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
  const dates = new Intl.DateTimeFormat(currentLanguage, { dateStyle: 'medium', timeStyle: 'short' });

  return <>
    {actions}
    {error && <Alert variant="destructive" role="alert" className="mb-3"><AlertDescription>{error}</AlertDescription></Alert>}
    {query.isError ? <Alert variant="destructive" role="alert">
      <AlertDescription>{t('amendmentLibrary.loadFailed')}</AlertDescription>
      <Button variant="ghost" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>{t('quoteAmendments.retry')}</Button>
    </Alert> : pending ? <div role="status" aria-label={t('quoteAmendments.loading')} className="space-y-3">
      {[0, 1, 2].map(id => <Skeleton key={id} className="h-24 w-full motion-reduce:animate-none" />)}
    </div> : <>
      {query.data?.content.length === 0 ? <EmptyState icon={<FileText />} title={t('amendmentLibrary.empty')} description={t('amendmentLibrary.emptyDescription')} />
        : <ul className="m-0 list-none divide-y divide-border rounded-xl border border-solid border-border bg-card p-0" aria-label={t('amendmentLibrary.title')}>
          {query.data?.content.map(entry => <li key={entry.id} className="grid min-w-0 gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0 space-y-1">
              <h3 className="text-sm font-semibold tabular-nums">{t('amendmentLibrary.reference', { id: entry.id })}</h3>
              <p className="text-xs text-muted-foreground tabular-nums">{t('amendmentLibrary.references', { quote: entry.quoteId, mission: entry.interventionId })}</p>
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm tabular-nums">
                <span>{t('amendmentLibrary.previousAmount')} <bdi>{formatCurrency(entry.originalAmount, entry.currency, currentLanguage)}</bdi></span>
                <span>{t('amendmentLibrary.acceptedAmount')} <bdi>{formatCurrency(entry.proposedAmount, entry.currency, currentLanguage)}</bdi></span>
              </p>
              <p className="line-clamp-2 whitespace-pre-wrap break-words text-xs text-muted-foreground" title={entry.reason}>{entry.reason}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{t('amendmentLibrary.acceptedAt', { date: dates.format(new Date(entry.decidedAt)) })}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Badge variant="secondary">{t(`amendmentLibrary.status.${entry.archiveStatus}`)}</Badge>
              {entry.archiveStatus === 'READY' && <Button variant="ghost" size="sm" disabled={downloading !== null || query.isFetching}
                aria-label={t('amendmentLibrary.download', { id: entry.id })} onClick={() => void download(entry.id)}>
                <Download size={14} />{downloading === entry.id ? t('amendmentLibrary.downloading') : t('quoteAmendments.downloadPdf')}
              </Button>}
            </div>
          </li>)}
        </ul>}
      <PagePagination page={page} onPageChange={setPage} count={query.data?.totalElements ?? 0}
        rowsPerPage={size} rowsPerPageOptions={[10, 20, 50]} hideOnSinglePage={false}
        onRowsPerPageChange={value => { setSize(value); setPage(0); }} />
    </>}
  </>;
}

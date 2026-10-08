import FinanceHeaderFilters from '../billing/components/FinanceHeaderFilters';
import { useCallback, useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, Skeleton } from '../../components/ui';
import FinanceStatusIcon from '../billing/components/FinanceStatusIcon';
import PagePagination from '../../components/PagePagination';
import { walletApi } from '../../services/api/walletApi';
import { useTranslation } from '../../hooks/useTranslation';
import { activeIntlLocale } from '../../utils/activeLocale';
import FinanceWorkspace from '../billing/components/FinanceWorkspace';
import FinanceKpis from '../billing/components/FinanceKpis';

export default function WalletDashboard({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const [walletId, setWalletId] = useState<number | null>(null);
  const [{ page, size }, setPagination] = useState({ page: 0, size: 10 });
  const setPage = (page: number) => setPagination(current => ({ ...current, page }));
  const resizePage = useCallback((size: number) => setPagination(current => current.size === size ? current
    : { page: Math.floor(current.page * current.size / size), size }), []);
  // Opening a ledger is read-only. Never initialize or backfill financial entries here.
  const wallets = useQuery({ queryKey: ['finance-wallets'], queryFn: () => walletApi.getWallets() });
  const selected = wallets.data?.find(w => w.id === walletId) ?? wallets.data?.[0];
  const entries = useQuery({ queryKey: ['finance-ledger', selected?.id, page, size],
    queryFn: () => walletApi.getEntries(selected!.id, page, size), enabled: !!selected, placeholderData: keepPreviousData });
  useEffect(() => {
    if (!entries.data || entries.isPlaceholderData) return;
    const lastPage = Math.max(0, Math.ceil(entries.data.totalElements / size) - 1);
    if (page > lastPage) setPagination(current => ({ ...current, page: lastPage }));
  }, [entries.data, entries.isPlaceholderData, page, size]);
  const money = (amount: number, currency: string) => new Intl.NumberFormat(activeIntlLocale(), { style: 'currency', currency }).format(amount);
  const label = (type: string) => t(`finance.walletTypes.${type.toLowerCase()}`, type);
  if (wallets.isPending) return <Skeleton className="h-56 w-full" />;
  if (wallets.isError) return <div role="alert"><p>{t('common.error')}</p><Button variant="outline" onClick={() => void wallets.refetch()}>{t('common.retry')}</Button></div>;
  return <div>
    {!embedded && <h1>{t('financeWorkspace.viewsLabels.ledger')}</h1>}
    {!!wallets.data?.length && <FinanceKpis items={wallets.data.map(wallet => ({
      key: String(wallet.id), label: label(wallet.walletType), value: money(wallet.balance, wallet.currency),
      artwork: 'documents', description: t('financeWorkspace.ledgerBalance'), advice: t('financeWorkspace.ledgerAdvice'),
    }))} scope={t('financeWorkspace.viewsLabels.ledger')} />}
    <FinanceHeaderFilters><label>
      {t('financeWorkspace.ledgerAccount')}
      <select className="rounded-lg border border-border bg-card px-3 py-2 cursor-pointer" value={selected?.id ?? ''}
        onChange={event => { setWalletId(Number(event.target.value)); setPage(0); }}>
        {(wallets.data ?? []).map(wallet => <option key={wallet.id} value={wallet.id}>{label(wallet.walletType)} · {wallet.currency}</option>)}
      </select>
    </label></FinanceHeaderFilters>
    {entries.isError ? <div role="alert"><p>{t('common.error')}</p><Button variant="outline" onClick={() => void entries.refetch()}>{t('common.retry')}</Button></div>
      : entries.isPending ? <Skeleton className="h-64 w-full" />
      : !selected || !entries.data?.content.length ? <p className="rounded-xl border border-border bg-card p-6 text-sm">{t('finance.noTransaction')}</p>
      : <FinanceWorkspace onPageSizeChange={resizePage} key={selected.id} items={entries.data.content.map(entry => ({
        id: entry.id, title: entry.description, amount: <span className={entry.entryType === 'CREDIT' ? 'text-success-ink' : 'text-destructive-ink'}>{entry.entryType === 'CREDIT' ? '+' : '−'}{money(entry.amount, entry.currency)}</span>,
        status: <FinanceStatusIcon value={entry.entryType} label={entry.entryType} />,
        fields: [
          { label: t('common.date'), value: new Date(entry.createdAt).toLocaleString(activeIntlLocale()) },
          { label: t('common.reference'), value: entry.referenceId },
          { label: t('common.type'), value: t(`finance.refTypes.${({ PAYMENT:'payment', SPLIT:'split', ESCROW_HOLD:'escrowHold', ESCROW_RELEASE:'escrowRelease', REFUND:'refund', PAYOUT:'payout', ADJUSTMENT:'adjustment' } as Record<string,string>)[entry.referenceType]}`,entry.referenceType) },
          { label: t('financeWorkspace.balanceAfter'), value: money(entry.balanceAfter, entry.currency) },
        ],
      }))} pagination={<PagePagination count={entries.data.totalElements} page={page} onPageChange={setPage} rowsPerPage={size} hideOnSinglePage={false} compact />} />}
  </div>;
}

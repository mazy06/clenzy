import { useQuery } from '@tanstack/react-query';
import { Button, Skeleton } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { useCommerceScope } from '../../hooks/useCommerceScope';
import apiClient from '../../services/apiClient';
import { Link } from 'react-router-dom';
import DocumentStatusIcon from '../documents/components/DocumentStatusIcon';
type Submission = { id: number; invoiceId: number | null; invoiceNumber: string; country: string; status: string; reference: string | null; message: string | null };
export default function BaitlyFiscalSubmissions({ country, onSelectInvoice, compactStatus = false }: { country?: string; onSelectInvoice?: (id: number) => void; compactStatus?: boolean }) {
  const scope = useCommerceScope();const { t } = useTranslation();
  const query = useQuery({ queryKey: ['fiscal-submissions', scope], enabled: !!scope, retry: false, queryFn: () => apiClient.get<Submission[]>('/fiscal-profile/submissions') });
  const rows = query.data?.filter(row => !country || row.country === country);
  return <section className="mt-6 space-y-3 border-t border-border pt-4" aria-label={t('fiscal.submissions.title')}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-medium text-sm">{t('fiscal.submissions.title')}</h3><Button size="sm" variant="ghost" disabled={query.isFetching} onClick={() => void query.refetch()}>{t('common.refresh')}</Button></div>
    <p className="text-sm text-muted-foreground">{t('fiscal.submissions.hint')}</p>
    {query.isPending && <Skeleton className="h-12 w-full" />}
    {query.error && <p role="alert" className="text-sm text-destructive-ink">{t('fiscal.submissions.error')}</p>}
    {rows?.length === 0 && <p className="text-sm text-muted-foreground">{t('fiscal.submissions.empty')}</p>}
    <ul className="divide-y divide-border">{rows?.map(row => <li className="flex flex-wrap justify-between gap-2 py-3 text-sm" key={row.id}>
      {row.invoiceId ? onSelectInvoice ? <Button variant="link" size="sm" onClick={() => onSelectInvoice(row.invoiceId!)}>{row.invoiceNumber}</Button>
        : <Link className="tabular-nums underline" to={`/documents?tab=compliance&invoice=${row.invoiceId}`}>{row.invoiceNumber}</Link>
        : <span className="tabular-nums">{row.invoiceNumber}</span>}{compactStatus
          ? <DocumentStatusIcon value={row.status === 'REPORTED' ? 'DELIVERED' : row.status} label={t(`fiscal.submissions.states.${row.status}`, row.status)} />
          : <span>{t(`fiscal.submissions.states.${row.status}`, row.status)}</span>}
      {row.reference && <span className="basis-full text-xs text-muted-foreground">{t('fiscal.submissions.reference')} {row.reference}</span>}
      {row.message && <p className="basis-full text-xs text-muted-foreground">{row.message}</p>}
    </li>)}</ul>
  </section>;
}

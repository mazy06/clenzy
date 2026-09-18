import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serviceAssignmentsApi } from '../../services/api/serviceAssignmentsApi';
import { useTranslation } from '../../hooks/useTranslation';
import { Alert, AlertDescription, Button, Skeleton } from '../../components/ui';
import { formatDateTime } from '../../utils/formatUtils';
import { serviceQuotesApi } from '../../services/api/serviceQuotesApi';
import { useNavigate } from 'react-router-dom';
import { invalidateMissionWorkflow } from '../../hooks/invalidateMissionWorkflow';

export default function AssignmentHistory({ requestId, allowResume = true }: { requestId: number; allowResume?: boolean }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const quotes = useQuery({ queryKey: ['assignment-quotes', requestId], queryFn: () => serviceAssignmentsApi.quotes(requestId) });
  const decide = useMutation({
    mutationFn: ({ id, accept }: { id: number; accept: boolean }) => accept ? serviceQuotesApi.approve(id) : serviceQuotesApi.reject(id),
    onSuccess: async quote => {
      await Promise.all([cache.invalidateQueries({ queryKey: ['assignment-quotes', requestId] }), cache.invalidateQueries({ queryKey: ['assignment-history', requestId] })]);
      if (quote.interventionId) navigate(`/interventions/${quote.interventionId}`);
    },
  });
  const history = useQuery({ queryKey: ['assignment-history', requestId], queryFn: () => serviceAssignmentsApi.history(requestId) });
  const resume = useMutation({ mutationFn: () => serviceAssignmentsApi.resume(requestId), onSuccess: () => invalidateMissionWorkflow(cache) });
  if (history.isPending) return <Skeleton className="h-20 w-full" />;
  if (history.isError) return <Alert><AlertDescription>{t('assignmentFlow.historyFailed')}</AlertDescription></Alert>;
  const accepted = history.data.some(p => p.status === 'ACCEPTED');
  const pending = history.data.some(p => p.status === 'PENDING');
  return <section className="space-y-3 border-t border-solid border-[var(--bui-border)] pt-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">{t('assignmentFlow.history')}</h2>
      {allowResume && !accepted && !pending && !quotes.data?.some(quote => quote.status === 'RECEIVED') && <Button variant="outline" disabled={resume.isPending} onClick={() => resume.mutate()}>{t('assignmentFlow.resume')}</Button>}
    </div>
    {resume.isError && <p role="alert" className="text-sm text-destructive-ink">{t('assignmentFlow.replyFailed')}</p>}
    {quotes.isError && <p role="alert">{t('assignmentFlow.loadFailed')}</p>}
    {quotes.data?.filter(quote => quote.status === 'RECEIVED').map(quote => <div key={quote.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div><p className="text-sm font-semibold">{quote.providerName}</p><p className="text-sm tabular-nums">{new Intl.NumberFormat(undefined, { style: 'currency', currency: quote.currency }).format(quote.amount)}</p><p className="text-sm text-muted-foreground">{quote.description}</p></div>
      <div className="flex gap-2">
        <Button disabled={decide.isPending} onClick={() => decide.mutate({ id: quote.id, accept: true })}>{t('assignmentFlow.accept')}</Button>
        <Button variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: quote.id, accept: false })}>{t('assignmentFlow.decline')}</Button>
      </div>
    </div>)}
    {decide.isError && <p role="alert" className="text-sm text-destructive-ink">{t('assignmentFlow.replyFailed')}</p>}
    {!history.data.length && <p className="text-sm text-muted-foreground">{t('requestDetail.noHistory')}</p>}
    <ol className="m-0 list-none divide-y divide-border p-0">{history.data.map(p => <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
      <span>{t(`assignmentFlow.status.${p.status}`)}{p.reason && ` · ${p.reason}`}</span>
      <time className="tabular-nums text-muted-foreground" dateTime={p.status === 'PENDING' ? p.expiresAt : p.respondedAt ?? p.createdAt}>
        {p.status === 'PENDING' ? t('assignmentFlow.replyBefore', { date: formatDateTime(p.expiresAt) }) : formatDateTime(p.respondedAt ?? p.createdAt)}
      </time>
    </li>)}</ol>
  </section>;
}

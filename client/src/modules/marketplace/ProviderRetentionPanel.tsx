import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import apiClient from '../../services/apiClient';
import { Alert, AlertDescription, Button, Input, Skeleton, Textarea } from '../../components/ui';

interface Hold { reason: string | null; reviewAt: string | null; actor: string | null; reviewOverdue: boolean }

export default function ProviderRetentionPanel({ providerId }: { providerId: number }) {
  const { user } = useAuth();
  const { t, currentLanguage } = useTranslation();
  const client = useQueryClient();
  const [reason, setReason] = useState('');
  const [reviewAt, setReviewAt] = useState('');
  const [editing, setEditing] = useState(false);
  const submitting = useRef(false);
  const key = ['marketplace-retention', providerId, user?.id, user?.organizationId];
  const path = `/admin/marketplace/providers/${providerId}/retention-hold`;
  const query = useQuery({ queryKey: key, queryFn: () => apiClient.get<Hold>(path), enabled: !!user, refetchInterval: 30_000 });
  const mutation = useMutation({
    mutationFn: (release: boolean) => release ? apiClient.delete<Hold>(path) : apiClient.put<Hold>(path, { reason: reason.trim(), reviewAt }),
    onSuccess: async () => {
      setEditing(false); setReason(''); setReviewAt('');
      await Promise.all([client.invalidateQueries({ queryKey: key }), client.invalidateQueries({ queryKey: ['marketplace-providers', 'decisions', providerId] })]);
    },
  });
  const submit = async (release: boolean) => {
    if (submitting.current) return;
    submitting.current = true;
    try { await mutation.mutateAsync(release); } catch { /* L'erreur reste affichée. */ }
    finally { submitting.current = false; }
  };
  return <section className="flex flex-col gap-2 border-t border-border pt-3">
    <h3 className="m-0 text-sm font-medium">{t('marketplaceRetention.title')}</h3>
    <p className="m-0 text-xs text-muted-foreground">{t('marketplaceRetention.policy')}</p>
    {query.isPending ? <Skeleton className="h-16 w-full" /> : query.isError
      ? <Alert variant="destructive"><AlertDescription>{t('marketplaceRetention.error')} <Button variant="ghost" onClick={() => void query.refetch()}>{t('marketplaceWorkflow.refresh')}</Button></AlertDescription></Alert>
      : <>
        {query.data?.reason && <div className="space-y-1 text-sm">
          <p className="m-0 whitespace-pre-wrap">{query.data.reason}</p>
          <p className="m-0 tabular-nums text-muted-foreground">{t('marketplaceRetention.reviewAt')}: {query.data.reviewAt && new Date(query.data.reviewAt).toLocaleString(currentLanguage)}</p>
          {query.data.reviewOverdue && <p role="status" className="m-0 text-warning-ink">{t('marketplaceRetention.overdue')}</p>}
        </div>}
        {editing ? <form className="flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); void submit(false); }}>
          <label className="flex flex-col gap-1 text-xs">{t('marketplaceRetention.reason')}
            <Textarea required maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} disabled={mutation.isPending} />
          </label>
          <label className="flex flex-col gap-1 text-xs">{t('marketplaceRetention.reviewAt')}
            <Input required type="datetime-local" className="tabular-nums" value={reviewAt} onChange={(event) => setReviewAt(event.target.value)} disabled={mutation.isPending} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={mutation.isPending || !reason.trim() || !reviewAt}>{t('marketplaceRetention.save')}</Button>
            <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={() => setEditing(false)}>{t('marketplaceRetention.close')}</Button>
          </div>
        </form> : <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={mutation.isPending} onClick={() => { setReason(query.data?.reason ?? ''); setReviewAt(query.data?.reviewAt?.slice(0, 16) ?? ''); setEditing(true); mutation.reset(); }}>{t('marketplaceRetention.hold')}</Button>
          {query.data?.reason && <Button variant="outline" disabled={mutation.isPending} onClick={() => void submit(true)}>{t('marketplaceRetention.release')}</Button>}
        </div>}
      </>}
    {mutation.isError && <Alert variant="destructive"><AlertDescription>{t('marketplaceRetention.error')}</AlertDescription></Alert>}
  </section>;
}

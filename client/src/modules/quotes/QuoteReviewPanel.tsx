import { useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import { Button, Textarea } from '../../components/ui';
import { quoteRequestsApi } from '../../services/api/quoteRequestsApi';

export default function QuoteReviewPanel({ quoteId }: { quoteId: number }) {
  const { user, loading } = useAuth();
  if (!user || loading) return null;
  const scope = JSON.stringify([user.id, user.organizationId, quoteId]);
  return <ReviewPanel key={scope} scope={scope} quoteId={quoteId} />;
}
function ReviewPanel({ quoteId, scope }: { quoteId: number; scope: string }) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const query = useQuery({ queryKey: ['quote-requests', 'review', scope],
    queryFn: () => quoteRequestsApi.review(quoteId), enabled: open, retry: false });
  const data = query.isError ? undefined : query.data;
  const submit = async () => {
    if (sending.current || !data?.canReview || !rating) return;
    sending.current = true; setBusy(true); setError('');
    try { await quoteRequestsApi.submitReview(quoteId, Number(rating), feedback); await query.refetch(); }
    catch { setError(t('quoteReview.failed', 'Enregistrement impossible. Rechargez l’avis avant de réessayer.')); }
    finally { sending.current = false; setBusy(false); }
  };
  return <section className="mt-2 min-w-0 text-sm">
    <Button size="sm" variant="ghost" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      {t('quoteReview.title', 'Avis sur la mission')}
    </Button>
    {open && <div id={id} className="flex flex-col gap-3 p-3">
      {query.isPending && <p role="status">{t('quoteReview.loading', 'Chargement…')}</p>}
      {query.isError && <p role="alert">{t('quoteReview.loadFailed', 'Avis indisponible.')}
        <Button size="sm" variant="ghost" onClick={() => void query.refetch()}>{t('common.retry', 'Réessayer')}</Button>
      </p>}
      {data?.rating != null && <>
        <p role="status">{t('quoteReview.recorded', 'Avis enregistré')} · <span className="tabular-nums">{data.rating} / 5</span></p>
        {data.feedback && <p className="whitespace-pre-wrap break-words">{data.feedback}</p>}
      </>}
      {data && !data.canReview && data.rating == null && <p>{t('quoteReview.unavailable', 'Un avis est possible après la fin de la mission, par le propriétaire ou la conciergerie, hors membres de l’équipe prestataire.')}</p>}
      {data?.canReview && <form className="flex flex-col gap-3" onSubmit={event => { event.preventDefault(); void submit(); }} aria-busy={busy}>
        <label htmlFor={`${id}-rating`}>{t('quoteReview.rating', 'Note sur 5')}</label>
        <select id={`${id}-rating`} required value={rating} onChange={event => setRating(event.target.value)} disabled={busy}
          className="h-9 w-28 cursor-pointer rounded-md border border-border bg-background px-2 text-foreground focus-visible:outline-2">
          <option value="">{t('quoteReview.choose', 'Choisir')}</option>
          {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} / 5</option>)}
        </select>
        <label htmlFor={`${id}-feedback`}>{t('quoteReview.feedback', 'Commentaire (facultatif)')}</label>
        <Textarea id={`${id}-feedback`} value={feedback} onChange={event => setFeedback(event.target.value)} disabled={busy} maxLength={1000} rows={3} />
        <p className="text-muted-foreground">{t('quoteReview.help', 'Un seul avis par mission. La note contribue à la moyenne du prestataire ; le commentaire reste dans ce suivi.')}</p>
        <Button type="submit" size="sm" disabled={busy || query.isFetching || !rating} className="self-start">
          {t('quoteReview.save', 'Enregistrer mon avis')}
        </Button>
      </form>}
      {error && <p role="alert" className="text-[var(--bui-destructive-ink)]">{error}</p>}
    </div>}
  </section>;
}

import { useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import { Button, Input, Skeleton } from '../../components/ui';
import { quoteRequestsApi } from '../../services/api/quoteRequestsApi';
import type { QuoteRecurrence, RecurrenceCommand } from '../../services/api/quoteRequestsApi';

export default function QuoteRecurrencePanel({ quoteId }: { quoteId: number }) {
  const { user, loading } = useAuth();
  if (!user || loading) return null;
  const scope = JSON.stringify([user.id, user.organizationId, quoteId]);
  return <RecurrencePanel key={scope} scope={scope} quoteId={quoteId} />;
}

function RecurrencePanel({ quoteId, scope }: { quoteId: number; scope: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const id = useId();
  const query = useQuery({ queryKey: ['quote-requests', 'recurrence', scope],
    queryFn: () => quoteRequestsApi.recurrence(quoteId), enabled: open, retry: false });
  return <section className="mt-2 min-w-0 text-sm">
    <Button variant="ghost" size="sm" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      {t('quoteRecurrence.title', 'Planifier les prochaines demandes')}
    </Button>
    {open && <div id={id} className="flex flex-col gap-3 p-3">
      <p className="text-muted-foreground">{t('quoteRecurrence.help', 'Chaque échéance crée une nouvelle demande dans le PMS. Le prix et le prestataire précédents ne sont pas reconduits. Pour les prestations liées à un séjour, utilisez l’automatisation des réservations.')}</p>
      {query.isPending && <Skeleton className="h-24 w-full" />}
      {query.isError && <p role="alert">{t('quoteRecurrence.loadFailed', 'Échéancier indisponible.')}
        <Button variant="ghost" size="sm" onClick={() => void query.refetch()}>{t('common.retry', 'Réessayer')}</Button>
      </p>}
      {query.isSuccess && <RecurrenceForm key={query.data?.version ?? 'new'} quoteId={quoteId}
        plan={query.data || null} refresh={() => query.refetch()} />}
    </div>}
  </section>;
}

function RecurrenceForm({ quoteId, plan, refresh }: { quoteId: number; plan: QuoteRecurrence | null; refresh: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const id = useId();
  const [firstDate, setFirstDate] = useState(plan?.nextDate ?? '');
  const [intervalUnit, setIntervalUnit] = useState<'DAYS' | 'MONTHS'>(plan?.intervalUnit ?? 'MONTHS');
  const [intervalCount, setIntervalCount] = useState(String(plan?.intervalCount ?? 12));
  const [leadDays, setLeadDays] = useState(String(plan?.leadDays ?? 14));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const save = async (enabled: boolean) => {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    const command: RecurrenceCommand = { version: plan?.version ?? null, enabled,
      firstDate, intervalUnit, intervalCount: Number(intervalCount), leadDays: Number(leadDays) };
    try { await quoteRequestsApi.configureRecurrence(quoteId, command); await refresh(); }
    catch { setError(t('quoteRecurrence.saveFailed', 'Enregistrement impossible. Rechargez l’échéancier et vérifiez la date et l’intervalle.')); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <form onSubmit={event => { event.preventDefault(); void save(true); }} className="flex flex-col gap-3" aria-busy={busy}>
    {plan && <p role="status">{plan.enabled ? t('quoteRecurrence.active', 'Échéancier actif') : t('quoteRecurrence.paused', 'Échéancier suspendu')}
      {plan.enabled && <> · <span className="tabular-nums">{plan.nextDate}</span></>}
    </p>}
    <div className="flex flex-wrap items-end gap-3">
      <label htmlFor={`${id}-date`}>{t('quoteRecurrence.date', 'Prochaine prestation')}
        <Input id={`${id}-date`} type="date" required value={firstDate} disabled={busy} onChange={e => setFirstDate(e.target.value)} />
      </label>
      <label htmlFor={`${id}-interval`}>{t('quoteRecurrence.interval', 'Répéter tous les')}
        <Input id={`${id}-interval`} type="number" min={1} max={intervalUnit === 'MONTHS' ? 120 : 3650} step={1} required
          value={intervalCount} disabled={busy} onChange={e => setIntervalCount(e.target.value)} className="w-24 tabular-nums" />
      </label>
      <label htmlFor={`${id}-unit`} className="flex flex-col gap-1">{t('quoteRecurrence.unit', 'Unité')}
        <select id={`${id}-unit`} value={intervalUnit} disabled={busy} onChange={e => setIntervalUnit(e.target.value as 'DAYS' | 'MONTHS')}
          className="h-9 cursor-pointer rounded-md border border-border bg-background px-2 text-foreground focus-visible:outline-2">
          <option value="DAYS">{t('quoteRecurrence.days', 'Jours')}</option>
          <option value="MONTHS">{t('quoteRecurrence.months', 'Mois')}</option>
        </select>
      </label>
      <label htmlFor={`${id}-lead`}>{t('quoteRecurrence.lead', 'Créer la demande en avance (jours)')}
        <Input id={`${id}-lead`} type="number" min={0} max={90} step={1} required value={leadDays}
          disabled={busy} onChange={e => setLeadDays(e.target.value)} className="w-24 tabular-nums" />
      </label>
    </div>
    {error && <p role="alert" className="text-[var(--bui-destructive-ink)]">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <Button type="submit" size="sm" disabled={busy}>{t('quoteRecurrence.save', 'Activer cet échéancier')}</Button>
      {plan?.enabled && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void save(false)}>
        {t('quoteRecurrence.pause', 'Suspendre les prochaines demandes')}
      </Button>}
      {plan?.lastRequestId && <Button asChild variant="ghost" size="sm"><Link to={`/interventions?tab=service-requests&highlight=${plan.lastRequestId}`}>
        {t('quoteRecurrence.last', 'Voir la dernière demande')}
      </Link></Button>}
    </div>
  </form>;
}

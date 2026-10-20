import { useId, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, Button, FieldLabel, Input, Skeleton, Textarea } from '../../components/ui';
import { CalendarDays, ArrowUpRight, RefreshCw, CircleCheck, CircleX, Clock } from '../../icons/glyphs';
import { guestServiceSlot } from './baitlyGuestServiceSlot';
import { useTranslation } from '../../hooks/useTranslation';
import { upsellApi, type UpsellOrder } from '../../services/api/upsellApi';
import { getErrorMessage } from '../../utils/getErrorMessage';

export function hasPaidServiceExecution(order: Pick<UpsellOrder, 'serviceRequestId' | 'fulfillmentServiceCode'>) {
  return Boolean(order.serviceRequestId) || ['cleaning-mid-stay', 'culinary-breakfast', 'driver-airport', 'driver-station'].includes(order.fulfillmentServiceCode ?? '');
}

export default function BaitlyPaidServiceExecution({ order, compact = false }: { order: UpsellOrder; compact?: boolean }) {
  const { t, currentLanguage } = useTranslation();
  const id = useId();
  const client = useQueryClient();
  const [open, setOpen] = useState(compact);
  const [start, setStart] = useState('');
  const [duration, setDuration] = useState('2');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const hasExecution = hasPaidServiceExecution(order);
  const query = useQuery({
    queryKey: ['paid-service-execution', order.id], queryFn: () => upsellApi.execution(order.id), enabled: open && hasExecution,
    staleTime: 0, refetchOnWindowFocus: 'always', refetchIntervalInBackground: false,
    refetchInterval: query => query.state.error || !query.state.data || ['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(query.state.data.state) ? false : 30_000,
  });
  const execution = query.isError ? undefined : query.data;
  const slot = execution ? guestServiceSlot(execution.start, execution.durationHours, currentLanguage === 'ar' ? 'ar' : currentLanguage === 'en' ? 'en' : 'fr') : null;
  const transfer = ['driver-airport', 'driver-station'].includes(order.fulfillmentServiceCode ?? '');
  if (!hasExecution) return null;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    const hours = Number(duration);
    if (!start || !Number.isInteger(hours) || hours < 1 || hours > 8 || (transfer && !instructions.trim())) return;
    pending.current = true; setSaving(true); setError('');
    try {
      const result = await upsellApi.schedule(order.id, { start, durationHours: hours, instructions });
      client.setQueryData(['paid-service-execution', order.id], result);
      void client.invalidateQueries({ queryKey: ['upsell-orders'] });
      void client.invalidateQueries({ queryKey: ['service-requests-list'] });
    } catch (failure) { setError(getErrorMessage(failure)); }
    finally { pending.current = false; setSaving(false); }
  }
  return <section className={compact ? 'rsv-service-execution' : 'w-full min-w-0 border-t border-border pt-2 text-sm'}>
    {!compact && <Button type="button" size="sm" variant="ghost" className="min-h-[44px] max-w-full whitespace-normal text-start" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls={id}>
      <CalendarDays className="size-4" />{t('paidServiceExecution.title')}
    </Button>}
    {open && <div id={id} className="space-y-3 pt-2">
      {!compact && <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" disabled={query.isFetching} onClick={() => void query.refetch()}>
        <RefreshCw className="size-4" />{t('paidServiceExecution.refresh')}
      </Button>}
      {query.isLoading && <Skeleton className="h-20 w-full" />}
      {query.isError && <Alert variant="destructive"><AlertDescription>{t('paidServiceExecution.loadError')}</AlertDescription>
        <Button type="button" variant="ghost" size="sm" onClick={() => void query.refetch()}>{t('paidServiceExecution.retry')}</Button></Alert>}
      {execution && <>
        {compact ? <span className="rsv-service-execution__state" data-state={execution.state}>
          {execution.state === 'COMPLETED' ? <CircleCheck aria-hidden /> : ['CANCELLED', 'REFUNDED'].includes(execution.state) ? <CircleX aria-hidden /> : <Clock aria-hidden />}
          {t(`paidServiceExecution.states.${execution.state}`, execution.state)}
        </span>
          : <p className="m-0 font-medium text-info-ink">{t(`paidServiceExecution.states.${execution.state}`, execution.state)}</p>}
        {!compact && <p className="m-0 text-xs text-muted-foreground">{t(execution.paymentStatus === 'PAID'
          ? 'paidServiceExecution.paymentSeparation' : 'paidServiceExecution.paymentUnavailable')}</p>}
        {slot && <div className="rsv-service-execution__slot text-sm tabular-nums break-words">
          {compact ? <CalendarDays className="rsv-service-execution__calendar" aria-hidden /> : <p className="m-0 text-xs text-muted-foreground">{t('paidServiceExecution.scheduled')}</p>}
          <time dateTime={execution.start!}>{slot.date} · {slot.time}{slot.end && ` – ${slot.end}`}</time>
          <p className="m-0 text-xs text-muted-foreground">{[slot.duration, execution.timezone].filter(Boolean).join(' · ')}</p>
        </div>}
        {execution.serviceRequestId && <div className="rsv-service-execution__actions flex flex-wrap gap-2">
          {(!compact || !execution.interventionId) && <Button asChild variant="outline" size="sm" className="min-h-[44px] max-w-full whitespace-normal"><Link to={`/service-requests/${execution.serviceRequestId}`}>
            {t('paidServiceExecution.openRequest')} <ArrowUpRight className="size-4" />
          </Link></Button>}
          {execution.interventionId && <Button asChild variant={compact ? 'default' : 'outline'} size="sm" className="min-h-[44px] max-w-full whitespace-normal"><Link to={`/interventions/${execution.interventionId}`}>
            {t('paidServiceExecution.openIntervention')} <ArrowUpRight className="size-4" />
          </Link></Button>}
        </div>}
        {execution.canSchedule && <form onSubmit={submit} className="space-y-3">
          <p className="m-0 text-xs text-muted-foreground tabular-nums">{t('paidServiceExecution.stayWindow', {
            start: (execution.scheduleStart ?? execution.stayStart)?.replace('T', ' '), end: (execution.scheduleEnd ?? execution.stayEnd)?.replace('T', ' '), timezone: execution.timezone,
          })}</p>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <div className="min-w-0"><FieldLabel htmlFor={`${id}-start`}>{t('paidServiceExecution.start')}</FieldLabel>
              <Input id={`${id}-start`} className="min-h-[44px] min-w-0 max-w-full" type="datetime-local" required value={start}
                min={execution.scheduleStart ?? execution.stayStart ?? undefined} max={execution.scheduleEnd ?? execution.stayEnd ?? undefined} onChange={event => setStart(event.target.value)} /></div>
            <div><FieldLabel htmlFor={`${id}-duration`}>{t('paidServiceExecution.duration')}</FieldLabel>
              <Input id={`${id}-duration`} className="min-h-[44px]" type="number" required min={1} max={8} step={1} value={duration} onChange={event => setDuration(event.target.value)} /></div>
          </div>
          <div><FieldLabel htmlFor={`${id}-instructions`}>{t(transfer ? 'paidServiceExecution.transferInstructions' : 'paidServiceExecution.instructions')}</FieldLabel>
            <Textarea id={`${id}-instructions`} rows={2} required={transfer} maxLength={1000} value={instructions} onChange={event => setInstructions(event.target.value)} /></div>
          <p className="m-0 text-xs text-muted-foreground">{t('paidServiceExecution.acceptance')}</p>
          {error && <p role="alert" className="m-0 text-sm text-destructive-ink">{error}</p>}
          <Button type="submit" className="min-h-[44px]" disabled={saving || !start}>{t(saving ? 'paidServiceExecution.saving' : 'paidServiceExecution.submit')}</Button>
        </form>}
      </>}
    </div>}
  </section>;
}

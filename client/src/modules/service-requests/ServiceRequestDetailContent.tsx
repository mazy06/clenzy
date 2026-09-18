import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Home, MapPin, Navigation, CalendarDays, Clock3, Check, UserRound, Mail, Phone, KeyRound, ClipboardList, ArrowUpRight, BedDouble, Bath, Users, Ruler } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback, Button, Card, CardContent } from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import { useTranslation } from '../../hooks/useTranslation';
import type { ServiceRequestDetailsData } from '../../hooks/useServiceRequestDetails';
import ServiceReferenceLabels from '../../components/ServiceReferenceLabels';
import { formatDuration, parseApiDate } from '../../utils/formatUtils';
import { getServiceRequestPriorityLabel, getServiceRequestStatusLabel } from '../../utils/statusUtils';
import { toApiMediaUrl } from '../../utils/mediaUrl';
import RequestAssignmentProgress from './RequestAssignmentProgress';
import RequestCommercialDetails, { RequestCommercialBatch } from './RequestCommercialDetails';
import ServicePriceComparison, { ServicePriceDifference } from './ServicePriceComparison';
import { readableInstructions, requestStage } from './requestDetailPresentation';

function Section({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) {
  return <section className="min-w-0 space-y-3 border-t border-solid border-[var(--bui-border)] pt-5">
    <h2 className="m-0 flex items-center gap-2 text-base font-semibold">{icon}{title}</h2>{children}
  </section>;
}

function Person({ name, photo, label, phone, email }: { name: string; photo?: string; label: string; phone?: string; email?: string }) {
  return <div className="flex min-w-0 items-start gap-3 py-3">
    <Avatar className="size-10 shrink-0"><AvatarImage src={toApiMediaUrl(photo)} alt="" />
      <AvatarFallback>{name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('')}</AvatarFallback></Avatar>
    <div className="min-w-0 space-y-1"><p className="m-0 text-xs text-muted-foreground">{label}</p>
      <p className="m-0 text-sm font-medium break-words">{name}</p>
      {phone && <a className="flex min-h-8 items-center gap-2 text-sm text-foreground underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2" href={`tel:${phone.replace(/[^+\d]/g, '')}`}><Phone className="size-3.5 shrink-0" aria-hidden />{phone}</a>}
      {email && <a className="flex min-h-8 items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2" href={`mailto:${email}`}><Mail className="size-3.5 shrink-0" aria-hidden /><span className="break-all">{email}</span></a>}
    </div>
  </div>;
}

export default function ServiceRequestDetailContent({ request: sr, manager, history }: {
  request: ServiceRequestDetailsData; manager: boolean; history?: ReactNode;
}) {
  const { t, currentLanguage } = useTranslation();
  const stage = requestStage(sr);
  const steps = ['created', 'search', 'reply', 'intervention'];
  const closed = stage < 0;
  const address = [sr.propertyAddress, sr.propertyPostalCode, sr.propertyCity, sr.propertyCountry].filter(Boolean).join(', ');
  const instructions = readableInstructions(sr.specialInstructions);
  const number = (value: number) => value.toLocaleString(currentLanguage, { maximumFractionDigits: 2 });
  const date = (value?: string, options?: Intl.DateTimeFormatOptions) => {
    if (!value || !Number.isFinite(parseApiDate(value).getTime())) return t('requestDetail.unscheduled');
    const settings = { dateStyle: 'medium' as const, timeStyle: 'short' as const, ...options };
    try { return new Intl.DateTimeFormat(currentLanguage, { ...settings, timeZone: sr.propertyTimezone || undefined }).format(parseApiDate(value)); }
    catch { return new Intl.DateTimeFormat(currentLanguage, settings).format(parseApiDate(value)); }
  };
  const due = parseApiDate(sr.dueDate);
  const end = Number.isFinite(due.getTime()) && sr.estimatedDuration > 0
    ? new Date(due.getTime() + sr.estimatedDuration * 3_600_000).toISOString() : undefined;
  const heading = closed ? getServiceRequestStatusLabel(sr.status, t)
    : sr.interventionId ? t('requestDetail.accepted')
    : t(`requestDetail.phase.${sr.assignmentPhase ?? 'INTERNAL'}`, t('requestDetail.phase.INTERNAL'));
  const summary = sr.interventionId ? t('requestDetail.converted')
    : closed ? t('requestDetail.closed') : t(`requestDetail.next.${sr.assignmentPhase ?? 'INTERNAL'}`, t('requestDetail.next.INTERNAL'));
  const facts = [
    { icon: Ruler, value: sr.propertySquareMeters != null ? `${sr.propertySquareMeters} m²` : null },
    { icon: BedDouble, value: sr.propertyBedroomCount != null ? t('requestDetail.bedrooms', { count: sr.propertyBedroomCount }) : null },
    { icon: Bath, value: sr.propertyBathroomCount != null ? t('requestDetail.bathrooms', { count: sr.propertyBathroomCount }) : null },
    { icon: Users, value: sr.propertyMaxGuests != null ? t('requestDetail.guests', { count: sr.propertyMaxGuests }) : null },
  ];

  return <div className="space-y-5 pb-6 text-sm text-foreground">
    <section aria-label={t('requestDetail.tracking')} className="space-y-5 rounded-xl border border-solid border-[var(--bui-border)] bg-[var(--bui-card)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1"><p className="m-0 text-sm font-medium text-muted-foreground">{t('requestDetail.tracking')} · #{sr.id}</p>
            <h2 className="m-0 text-xl font-semibold [text-wrap:balance]">{heading}</h2>
            <p className="m-0 max-w-[75ch] text-sm leading-relaxed text-muted-foreground">{summary}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            {['high', 'critical', 'urgent'].includes(sr.priority) && <StatusChip tone={sr.priority === 'critical' ? 'err' : 'warn'} label={getServiceRequestPriorityLabel(sr.priority, t)} className="text-xs" />}
            {!closed && !sr.interventionId && (sr.assignmentExpiresAt || sr.assignmentPhase === 'MANUAL') && <RequestAssignmentProgress assignmentPhase={sr.assignmentPhase} assignmentExpiresAt={sr.assignmentExpiresAt} autoAssignStatus={sr.autoAssignStatus} />}
            {sr.interventionId && <Button asChild><Link to={`/interventions/${sr.interventionId}`}>{t('requestDetail.openIntervention')}<ArrowUpRight className="size-4" aria-hidden /></Link></Button>}
          </div>
        </div>
        {!closed && <ol aria-label={t('requestDetail.tracking')} className="m-0 grid list-none grid-cols-1 gap-4 border-t border-solid border-[var(--bui-border)] p-0 pt-4 sm:grid-cols-4 sm:gap-3">
          {steps.map((step, index) => {
            const completed = index < stage || stage === 3;
            const current = index === stage && stage !== 3;
            return <li key={step} aria-current={current ? 'step' : undefined} className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-solid text-sm font-semibold tabular-nums"
                  style={{ borderColor: completed || current ? 'var(--bui-primary)' : 'var(--bui-border)', background: completed ? 'var(--bui-primary)' : 'var(--bui-card)', color: completed ? 'var(--bui-primary-foreground)' : current ? 'var(--bui-foreground)' : 'var(--bui-muted-foreground)' }}>
                  {completed ? <Check className="size-4" aria-hidden /> : index + 1}
                </span>
                <div className="min-w-0 sm:hidden"><span className={current ? 'text-sm font-semibold' : 'text-sm text-muted-foreground'}>{t(`requestDetail.steps.${step}`)}</span>{current && <p className="m-0 text-xs text-muted-foreground">{t('requestDetail.currentStep')}</p>}</div>
                {index < 3 && <span aria-hidden className="hidden h-px flex-1 sm:block" style={{ background: completed ? 'var(--bui-primary)' : 'var(--bui-border)' }} />}
              </div>
              <div className="mt-2 hidden sm:block"><span className={current ? 'text-sm font-semibold' : 'text-sm text-muted-foreground'}>{t(`requestDetail.steps.${step}`)}</span>{current && <p className="m-0 mt-1 text-xs text-muted-foreground">{t('requestDetail.currentStep')}</p>}</div>
            </li>;
          })}
        </ol>}
    </section>

    <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
      <div className="min-w-0 space-y-6">
        <section aria-label={t('requestDetail.property')} className="space-y-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-28 w-28 shrink-0 overflow-hidden rounded-xl after:rounded-xl sm:h-36 sm:w-48" style={{ borderRadius: 12 }}>
              <AvatarImage src={toApiMediaUrl(sr.propertyPhotoUrl)} alt={sr.propertyName} className="object-cover" style={{ borderRadius: 0, aspectRatio: 'auto' }} />
              <AvatarFallback style={{ borderRadius: 12 }}><Home className="size-8 text-muted-foreground" aria-hidden /></AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-2">
              <p className="m-0 text-xs font-medium text-muted-foreground">{t('requestDetail.property')}</p>
              <h2 className="m-0 text-lg font-semibold [text-wrap:balance]">{sr.propertyId ? sr.propertyName : t('serviceReference.withoutProperty')}</h2>
              {address && <p className="m-0 flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />{address}</p>}
              <div className="flex flex-wrap gap-2">
                {address && <Button variant="outline" size="sm" asChild><a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer"><Navigation className="size-4" aria-hidden />{t('requestDetail.directions')}</a></Button>}
                {sr.propertyId > 0 && manager && <Button variant="ghost" size="sm" asChild><Link to={`/properties/${sr.propertyId}`}>{t('serviceRequests.details.viewProperty')}<ArrowUpRight className="size-4" aria-hidden /></Link></Button>}
              </div>
            </div>
          </div>
          <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-sm text-muted-foreground">
            {facts.filter(fact => fact.value != null).map(({ icon: Icon, value }, index) => <li key={index} className="flex items-center gap-2 tabular-nums"><Icon className="size-4" aria-hidden />{value}</li>)}
          </ul>
        </section>

        <section aria-labelledby="request-instructions-title" className="rounded-xl border border-solid border-[var(--bui-border)] bg-[var(--bui-card)] p-4 sm:p-5">
          <h2 id="request-instructions-title" className="m-0 flex items-center gap-2 text-lg font-semibold"><KeyRound className="size-5 shrink-0" aria-hidden />{t('requestDetail.instructions')}</h2>
          <div className="mt-4 divide-y divide-[var(--bui-border)]">
            <div className="pb-4">
              <h3 className="mb-2 mt-0 text-base font-semibold">{t('requestDetail.access')}</h3>
              <p className={`m-0 max-w-[65ch] whitespace-pre-wrap break-words text-base leading-7 ${sr.accessNotes ? 'text-foreground' : 'text-muted-foreground'}`}>{sr.accessNotes || t('requestDetail.noAccess')}</p>
            </div>
            {instructions && <div className="py-4">
              <h3 className="mb-2 mt-0 text-base font-semibold">{t('requestDetail.requestInstructions')}</h3>
              <p className="m-0 max-w-[65ch] whitespace-pre-wrap break-words text-base leading-7 text-foreground">{instructions}</p>
            </div>}
            <div className="pt-4">
              <h3 className="mb-2 mt-0 text-base font-semibold">{t('requestDetail.propertyInstructions')}</h3>
              <p className={`m-0 max-w-[65ch] whitespace-pre-wrap break-words text-base leading-7 ${sr.propertyCleaningNotes ? 'text-foreground' : 'text-muted-foreground'}`}>{sr.propertyCleaningNotes || t('requestDetail.noInstructions')}</p>
            </div>
          </div>
        </section>

        <Section title={t('requestDetail.work')} icon={<ClipboardList className="size-4" aria-hidden />}>
          <div className="space-y-2"><div className="text-base font-medium"><ServiceReferenceLabels codes={sr.serviceItemCode ? [sr.serviceItemCode] : undefined} /></div>
            <p className="m-0 max-w-[80ch] whitespace-pre-wrap break-words leading-relaxed">{readableInstructions(sr.description) || t('requestDetail.noDescription')}</p>
          </div>
          {sr.quoteLines && sr.quoteLines.length > 0 && <div className="overflow-x-auto">
            <table className="w-full border-collapse text-start text-sm"><caption className="pb-2 text-start text-xs text-muted-foreground">{t('requestDetail.taskBreakdown')}</caption>
              <thead><tr className="border-b border-solid border-[var(--bui-border)]"><th className="py-2 text-start font-medium">{t('requestDetail.task')}</th><th className="px-3 text-end font-medium">{t('requestDetail.quantity')}</th><th className="text-end font-medium">{t('requestDetail.amount')}</th></tr></thead>
              <tbody>{sr.quoteLines.map((line, index) => <tr key={index} className="border-b border-solid border-[var(--bui-border)]"><td className="py-3">{line.label}</td><td className="px-3 text-end tabular-nums">{number(line.quantity)}</td><td className="text-end tabular-nums">{number(line.quantity * line.unitPrice)}</td></tr>)}</tbody>
            </table>
          </div>}
        </Section>

        {sr.propertyDescription && <details className="border-t border-solid border-[var(--bui-border)] pt-4 text-sm">
          <summary className="cursor-pointer py-2 text-base font-medium focus-visible:outline focus-visible:outline-2">{t('requestDetail.aboutProperty')}</summary>
          <p className="max-w-[70ch] whitespace-pre-wrap text-base leading-7 text-foreground">{sr.propertyDescription}</p>
        </details>}

        <Section title={t('requestDetail.context')}>
          <dl className="m-0 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {[ [t('requestDetail.createdAt'), date(sr.createdAt)], ...(sr.updatedAt ? [[t('requestDetail.updatedAt'), date(sr.updatedAt)]] : []), ...(sr.importSource ? [[t('requestDetail.source'), sr.importSource]] : []), ...(sr.reservationId ? [[t('requestDetail.reservation'), `#${sr.reservationId}`]] : []) ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="m-0 mt-1 tabular-nums">{value}</dd></div>)}
          </dl>
        </Section>
      </div>

      <aside className="min-w-0 space-y-5">
        <Card className="shadow-none"><CardContent className="space-y-4 p-4 sm:p-5">
          <h2 className="m-0 flex items-center gap-2 text-base font-semibold"><CalendarDays className="size-4" aria-hidden />{t('requestDetail.schedule')}</h2>
          <div className="space-y-1"><p className="m-0 text-lg font-semibold tabular-nums">{date(sr.dueDate, { dateStyle: 'full', timeStyle: undefined })}</p>
            {sr.dueDate && <p className="m-0 flex flex-wrap items-center gap-2 text-base tabular-nums"><Clock3 className="size-4" aria-hidden />{date(sr.dueDate, { dateStyle: undefined, timeStyle: 'short' })}{end && ` – ${date(end, { dateStyle: undefined, timeStyle: 'short' })}`}{sr.estimatedDuration > 0 && <span className="text-sm text-muted-foreground">· {formatDuration(sr.estimatedDuration)}</span>}</p>}
            {sr.propertyTimezone && <p className="m-0 text-xs text-muted-foreground">{t('requestDetail.localTime')} · {sr.propertyTimezone}</p>}
          </div>
          {(sr.guestCheckoutTime || sr.guestCheckinTime || sr.preferredTimeSlot) && <dl className="m-0 space-y-3 border-t border-solid border-[var(--bui-border)] pt-3">
            {[[t('serviceRequests.details.guestCheckout'), sr.guestCheckoutTime ? date(sr.guestCheckoutTime) : undefined], [t('serviceRequests.details.guestCheckin'), sr.guestCheckinTime ? date(sr.guestCheckinTime) : undefined], [t('requestDetail.preferredSlot'), sr.preferredTimeSlot]].filter(([, value]) => value).map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="m-0 text-sm tabular-nums">{value}</dd></div>)}
          </dl>}
        </CardContent></Card>

        <Section title={t('requestDetail.price')}>
          {!manager && !closed && !sr.interventionId ? <RequestCommercialBatch ids={[Number(sr.id)]}><RequestCommercialDetails id={sr.id} estimate={sr.estimatedCost} status={sr.status} detailView assignmentPhase={sr.assignmentPhase} assignmentExpiresAt={sr.assignmentExpiresAt} autoAssignStatus={sr.autoAssignStatus} /></RequestCommercialBatch> : <>
            <ServicePriceComparison proposedLabel={t('field.proposals.asked', 'Proposé')} proposed={sr.estimatedCost != null ? number(sr.estimatedCost) : t('requestCommercial.noEstimate')}
              providerLabel={t('requestDetail.recommended')} provider={sr.recommendedCost != null ? number(sr.recommendedCost) : t('requestDetail.notProvided')}
              difference={sr.estimatedCost != null && sr.recommendedCost != null ? <ServicePriceDifference amount={sr.estimatedCost - sr.recommendedCost} /> : undefined} />
            <p className="m-0 text-xs text-muted-foreground">{t('requestCommercial.currencyUnknown')}</p>
          </>}
          {sr.pricingMode === 'DIAGNOSTIC' && <p className="text-sm">{t('requestDetail.diagnostic')}{sr.diagnosticFee != null && <> · <span className="tabular-nums font-medium">{number(sr.diagnosticFee)}</span></>}</p>}
          {sr.actualCost != null && <p className="text-sm">{t('requestDetail.finalCost')} · <span className="font-medium tabular-nums">{number(sr.actualCost)}</span></p>}
        </Section>

        <Section title={t('requestDetail.people')} icon={<UserRound className="size-4" aria-hidden />}>
          <div className="divide-y divide-[var(--bui-border)]">
            <Person name={sr.assignedToName || t('requestDetail.unassigned')} photo={sr.assignedToPhotoUrl} label={t(sr.assignedToType === 'team' ? 'serviceRequests.team' : 'requestDetail.provider')} phone={sr.assignedToPhone} email={sr.assignedToEmail} />
            <Person name={sr.requestorName} photo={sr.requestorPhotoUrl} label={t('serviceRequests.fields.requestor')} phone={sr.requestorPhone} email={sr.requestorEmail} />
          </div>
        </Section>
        {history}
      </aside>
    </div>
  </div>;
}

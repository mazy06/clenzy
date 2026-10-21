import type { ReactNode } from 'react';
import ContactPresentation from '../../components/ContactPresentation';
import PropertyPresentation from '../../components/PropertyPresentation';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock3, Check, UserRound, KeyRound, ClipboardList, ArrowUpRight } from '../../icons/glyphs';
import { Button } from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import { useTranslation } from '../../hooks/useTranslation';
import type { ServiceRequestDetailsData } from '../../hooks/useServiceRequestDetails';
import ServiceReferenceLabels from '../../components/ServiceReferenceLabels';
import { formatDuration, parseApiDate } from '../../utils/formatUtils';
import { getServiceRequestPriorityLabel, getServiceRequestStatusLabel } from '../../utils/statusUtils';
import RequestAssignmentProgress from './RequestAssignmentProgress';
import RequestCommercialDetails, { RequestCommercialBatch, RequestRecipientActions } from './RequestCommercialDetails';
import ServicePriceComparison, { ServicePriceDifference } from './ServicePriceComparison';
import { formatRequestSlot, readableInstructions, requestStage } from './requestDetailPresentation';
import './baitlyRequestDetail.css';

function Section({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) {
  return <section className="baitly-request-section">
    <h2 className="m-0 flex items-center gap-2 text-base font-semibold">{icon}{title}</h2>{children}
  </section>;
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
  const date = (value?: string, options?: Intl.DateTimeFormatOptions, localSlot = false, offsetHours = 0) => {
    if (!value || !Number.isFinite(parseApiDate(value).getTime())) return t('requestDetail.unscheduled');
    const settings = { dateStyle: 'medium' as const, timeStyle: 'short' as const, ...options };
    if (localSlot) {
      try { return formatRequestSlot(value, currentLanguage, sr.propertyTimezone, settings, offsetHours); }
      catch { return formatRequestSlot(value, currentLanguage, 'UTC', settings, offsetHours); }
    }
    try { return new Intl.DateTimeFormat(currentLanguage, { ...settings, timeZone: sr.propertyTimezone || undefined }).format(parseApiDate(value)); }
    catch { return new Intl.DateTimeFormat(currentLanguage, settings).format(parseApiDate(value)); }
  };
  const heading = closed ? getServiceRequestStatusLabel(sr.status, t)
    : sr.interventionId ? t('requestDetail.accepted')
    : t(`requestDetail.phase.${sr.assignmentPhase ?? 'INTERNAL'}`, t('requestDetail.phase.INTERNAL'));
  const summary = sr.interventionId ? t('requestDetail.converted')
    : closed ? t('requestDetail.closed') : t(`requestDetail.next.${sr.assignmentPhase ?? 'INTERNAL'}`, t('requestDetail.next.INTERNAL'));


  const priceSummary = <>
            {sr.estimatedCost == null && sr.recommendedCost == null ? <p className="m-0 text-sm text-muted-foreground">{t('requestDetail.notProvided')}</p> : <ServicePriceComparison proposedLabel={t('field.proposals.asked', 'Proposé')} proposed={sr.estimatedCost != null ? number(sr.estimatedCost) : t('requestCommercial.noEstimate')}
              providerLabel={t('requestDetail.recommended')} provider={sr.recommendedCost != null ? number(sr.recommendedCost) : t('requestDetail.notProvided')}
              difference={sr.estimatedCost != null && sr.recommendedCost != null ? <ServicePriceDifference amount={sr.estimatedCost - sr.recommendedCost} /> : undefined} />}
            {(sr.estimatedCost != null || sr.recommendedCost != null) && <p className="m-0 text-xs text-muted-foreground">{t('requestCommercial.currencyUnknown')}</p>}
  </>;

  return <div className="baitly-request-detail text-sm text-foreground">
    <section aria-label={t('requestDetail.tracking')} className="baitly-request-tracking" data-closed={closed || undefined} data-linked={sr.interventionId ? true : undefined}>
        <div className="baitly-request-tracking__heading">
          <div className="space-y-1"><p className="baitly-request-eyebrow">{t('requestDetail.tracking')} · <span className="tabular-nums">#{sr.id}</span></p>
            <h2 className="m-0 text-xl font-semibold [text-wrap:balance]">{heading}</h2>
            <p className="m-0 max-w-[75ch] text-sm leading-relaxed text-muted-foreground">{summary}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            {['high', 'critical', 'urgent'].includes(sr.priority) && <StatusChip tone={sr.priority === 'critical' ? 'err' : 'warn'} label={getServiceRequestPriorityLabel(sr.priority, t)} className="text-xs" />}
            {!closed && !sr.interventionId && (sr.assignmentExpiresAt || sr.assignmentPhase === 'MANUAL') && <RequestAssignmentProgress assignmentPhase={sr.assignmentPhase} assignmentExpiresAt={sr.assignmentExpiresAt} autoAssignStatus={sr.autoAssignStatus} />}
          </div>
        </div>
        {!closed && <ol aria-label={t('requestDetail.tracking')} className="baitly-request-progress">
          {steps.map((step, index) => {
            const completed = index < stage || stage === 3;
            const current = index === stage && stage !== 3;
            return <li key={step} aria-current={current ? 'step' : undefined} data-completed={completed || undefined}>
              <div className="baitly-request-progress__track">
                <span className="baitly-request-progress__number">
                  {completed ? <Check className="size-4" aria-hidden /> : index + 1}
                </span>
                {index < 3 && <span aria-hidden className="baitly-request-progress__line" />}
              </div>
              <span className="baitly-request-progress__label">{t(`requestDetail.steps.${step}`)}</span>
            </li>;
          })}
        </ol>}
        {!closed && <p className="baitly-request-mobile-step">{t('requestDetail.currentStep')} · {t(`requestDetail.steps.${steps[stage]}`)}</p>}
        {sr.interventionId && <Button className="baitly-request-intervention-link" asChild>
          <Link to={`/interventions/${sr.interventionId}`}><ClipboardList className="size-4" aria-hidden /><span>{t('requestDetail.openIntervention')}</span><ArrowUpRight className="size-4" aria-hidden /></Link>
        </Button>}
    </section>

    <div className="baitly-request-layout">
      <div className="baitly-request-main">
        <PropertyPresentation name={sr.propertyId ? sr.propertyName : t('serviceReference.withoutProperty')}
          address={address} photoUrl={sr.propertyPhotoUrl}
          propertyHref={sr.propertyId > 0 && manager ? `/properties/${sr.propertyId}` : undefined}
          squareMeters={sr.propertySquareMeters} bedrooms={sr.propertyBedroomCount}
          bathrooms={sr.propertyBathroomCount} guests={sr.propertyMaxGuests} />

        <div className="baitly-request-work"><Section title={t('requestDetail.work')} icon={<ClipboardList className="size-4" aria-hidden />}>
          <div className="space-y-2"><div className="text-base font-medium"><ServiceReferenceLabels codes={sr.serviceItemCode ? [sr.serviceItemCode] : undefined} /></div>
            <p className="m-0 max-w-[80ch] whitespace-pre-wrap break-words leading-relaxed">{readableInstructions(sr.description) || t('requestDetail.noDescription')}</p>
          </div>
          {sr.quoteLines && sr.quoteLines.length > 0 && <div className="overflow-x-auto">
            <table className="w-full border-collapse text-start text-sm"><caption className="pb-2 text-start text-xs text-muted-foreground">{t('requestDetail.taskBreakdown')}</caption>
              <thead><tr className="border-b border-solid border-[var(--bui-border)]"><th className="py-2 text-start font-medium">{t('requestDetail.task')}</th><th className="px-3 text-end font-medium">{t('requestDetail.quantity')}</th><th className="text-end font-medium">{t('requestDetail.amount')}</th></tr></thead>
              <tbody>{sr.quoteLines.map((line, index) => <tr key={index} className="border-b border-solid border-[var(--bui-border)]"><td className="py-3">{line.label}</td><td className="px-3 text-end tabular-nums">{number(line.quantity)}</td><td className="text-end tabular-nums">{number(line.quantity * line.unitPrice)}</td></tr>)}</tbody>
            </table>
          </div>}
        </Section></div>

        <section aria-labelledby="request-instructions-title" className="baitly-request-instructions">
          <h2 id="request-instructions-title" className="m-0 flex items-center gap-2 text-lg font-semibold"><KeyRound className="size-5 shrink-0" aria-hidden />{t('requestDetail.instructions')}</h2>
          <div className="baitly-request-instructions__rows">
            <div data-empty={!sr.accessNotes || undefined}>
              <h3 className="mb-2 mt-0 text-base font-semibold">{t('requestDetail.access')}</h3>
              <p className={`m-0 max-w-[65ch] whitespace-pre-wrap break-words text-base leading-7 ${sr.accessNotes ? 'text-foreground' : 'text-muted-foreground'}`}>{sr.accessNotes || t('requestDetail.noAccess')}</p>
            </div>
            {instructions && <div>
              <h3 className="mb-2 mt-0 text-base font-semibold">{t('requestDetail.requestInstructions')}</h3>
              <p className="m-0 max-w-[65ch] whitespace-pre-wrap break-words text-base leading-7 text-foreground">{instructions}</p>
            </div>}
            <div data-empty={!sr.propertyCleaningNotes || undefined}>
              <h3 className="mb-2 mt-0 text-base font-semibold">{t('requestDetail.propertyInstructions')}</h3>
              <p className={`m-0 max-w-[65ch] whitespace-pre-wrap break-words text-base leading-7 ${sr.propertyCleaningNotes ? 'text-foreground' : 'text-muted-foreground'}`}>{sr.propertyCleaningNotes || t('requestDetail.noInstructions')}</p>
            </div>
          </div>
        </section>



        {sr.propertyDescription && <details className="border-t border-solid border-[var(--bui-border)] pt-4 text-sm">
          <summary className="cursor-pointer py-2 text-base font-medium focus-visible:outline focus-visible:outline-2">{t('requestDetail.aboutProperty')}</summary>
          <p className="max-w-[70ch] whitespace-pre-wrap text-base leading-7 text-foreground">{sr.propertyDescription}</p>
        </details>}

        {history && <div className="baitly-request-history">{history}</div>}
        <details className="baitly-request-context"><summary>{t('requestDetail.context')}</summary>
          <dl className="m-0 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {[ [t('requestDetail.createdAt'), date(sr.createdAt)], ...(sr.updatedAt ? [[t('requestDetail.updatedAt'), date(sr.updatedAt)]] : []), ...(sr.importSource ? [[t('requestDetail.source'), sr.importSource]] : []), ...(sr.reservationId ? [[t('requestDetail.reservation'), `#${sr.reservationId}`]] : []) ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="m-0 mt-1 tabular-nums">{value}</dd></div>)}
          </dl>
        </details>
      </div>

      <aside className="baitly-request-sidebar">
        <section className="baitly-request-schedule">
          <h2 className="m-0 flex items-center gap-2 text-base font-semibold"><CalendarDays className="size-4" aria-hidden />{t('requestDetail.schedule')}</h2>
          <div className="space-y-1"><p className="baitly-request-schedule__date">{date(sr.dueDate, { dateStyle: 'full', timeStyle: undefined }, true)}</p>
            {sr.dueDate && <p className="m-0 flex flex-wrap items-center gap-2 text-base tabular-nums"><Clock3 className="size-4" aria-hidden />{date(sr.dueDate, { dateStyle: undefined, timeStyle: 'short' }, true)}{sr.estimatedDuration > 0 && ` – ${date(sr.dueDate, { dateStyle: undefined, timeStyle: 'short' }, true, sr.estimatedDuration)}`}{sr.estimatedDuration > 0 && <span className="text-sm text-muted-foreground">· {formatDuration(sr.estimatedDuration)}</span>}</p>}
            {sr.propertyTimezone && <p className="m-0 text-xs text-muted-foreground">{t('requestDetail.localTime')} · {sr.propertyTimezone}</p>}
          </div>
          {(sr.guestCheckoutTime || sr.guestCheckinTime || sr.preferredTimeSlot) && <dl className="m-0 space-y-3 border-t border-solid border-[var(--bui-border)] pt-3">
            {[[t('serviceRequests.details.guestCheckout'), sr.guestCheckoutTime ? date(sr.guestCheckoutTime, undefined, true) : undefined], [t('serviceRequests.details.guestCheckin'), sr.guestCheckinTime ? date(sr.guestCheckinTime, undefined, true) : undefined], [t('requestDetail.preferredSlot'), sr.preferredTimeSlot]].filter(([, value]) => value).map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="m-0 text-sm tabular-nums">{value}</dd></div>)}
          </dl>}
        </section>

        <Section title={t('requestDetail.price')}>
          {manager && !closed && !sr.interventionId && !sr.marketplaceRequestId && ['PENDING', 'ASSIGNED'].includes(sr.status)
            ? <RequestRecipientActions requestId={Number(sr.id)} fallback={priceSummary} />
            : !manager && !closed && !sr.interventionId ? <RequestCommercialBatch ids={[Number(sr.id)]}><RequestCommercialDetails id={sr.id} estimate={sr.estimatedCost} status={sr.status} detailView assignmentPhase={sr.assignmentPhase} assignmentExpiresAt={sr.assignmentExpiresAt} autoAssignStatus={sr.autoAssignStatus} /></RequestCommercialBatch> : priceSummary}

          {sr.pricingMode === 'DIAGNOSTIC' && <p className="text-sm">{t('requestDetail.diagnostic')}{sr.diagnosticFee != null && <> · <span className="tabular-nums font-medium">{number(sr.diagnosticFee)}</span></>}</p>}
          {sr.actualCost != null && <p className="text-sm">{t('requestDetail.finalCost')} · <span className="font-medium tabular-nums">{number(sr.actualCost)}</span></p>}
        </Section>

        <Section title={t('requestDetail.people')} icon={<UserRound className="size-4" aria-hidden />}>
          <div>
            <ContactPresentation name={sr.assignedToName || t('requestDetail.unassigned')} pending={!sr.assignedToName}
              photoUrl={sr.assignedToPhotoUrl} label={t('requestDetail.provider')}
              role={sr.assignedToType === 'team' ? t('serviceRequests.team') : undefined} team={sr.assignedToType === 'team'}
              phone={sr.assignedToPhone} email={sr.assignedToEmail} />
            <ContactPresentation name={sr.requestorName} photoUrl={sr.requestorPhotoUrl}
              label={t('serviceRequests.fields.requestor')} phone={sr.requestorPhone} email={sr.requestorEmail} />
          </div>
        </Section>
      </aside>
    </div>
  </div>;
}

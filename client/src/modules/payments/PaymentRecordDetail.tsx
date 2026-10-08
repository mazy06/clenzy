import { useState, type ReactNode } from 'react';
import { CalendarDays, Clock3, CreditCard, ExternalLink, RotateCcw, Send } from '../../icons/glyphs';
import { Alert, AlertDescription, Button, Skeleton, Spinner, Tabs, TabsContent, TabsList, TabsTrigger, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import FinanceStatusIcon from '../billing/components/FinanceStatusIcon';
import { useTranslation } from '../../hooks/useTranslation';
import { activeIntlLocale } from '../../utils/activeLocale';
import { parseApiDate } from '../../utils/formatUtils';
import { interventionEndTime } from '../interventions/interventionTime';
import { resolveMediaUrl } from '../../config/api';
import type { PaymentRecord } from '../../services/api/paymentsApi';
import FinanceIdentity from '../billing/components/FinanceIdentity';
import { useFinanceIntervention } from '../billing/components/useFinanceIntervention';
import { getStatusLabel, getPriorityLabel, getPriorityTokens, getTypeLabel, formatDuration, parsePhotos } from '../interventions/interventionUtils';
import './paymentRecordDetail.css';
import PaymentInterventionEvidence from './PaymentInterventionEvidence';
import PaymentDetailPager from './PaymentDetailPager';
import BaitlyOtaSettlementPanel from './BaitlyOtaSettlementPanel';
import BaitlyExternalBatchRefundPanel from './BaitlyExternalBatchRefundPanel';

function readableNotes(value?: string): string {
  if (!value) return '';
  const textValues = (item: unknown): string[] => typeof item === 'string' ? [item] : item && typeof item === 'object' ? Object.values(item).flatMap(textValues) : [];
  try { return textValues(JSON.parse(value)).filter(Boolean).join('\n'); }
  catch { return value; }
}

/** Fiche de lecture : le règlement conserve le parcours PSP et ses contrôles existants. */
export default function PaymentRecordDetail({ payment, status, onPay, onSendLink, sending, processing }: {
  payment: PaymentRecord;
  status: ReactNode;
  onPay: () => void;
  onSendLink: () => void;
  sending: boolean;
  processing: boolean;
}) {
  const { t } = useTranslation();
  const [section, setSection] = useState('overview');
  const isIntervention = payment.type === 'INTERVENTION';
  const query = useFinanceIntervention(isIntervention ? payment.referenceId : undefined);
  const intervention = query.data;
  const canPay = !payment.paymentDisputed && payment.type !== 'RESERVATION' && (payment.canCollect === true || payment.status === 'PROCESSING');
  const canSend = !payment.paymentDisputed && payment.type === 'RESERVATION' && payment.canCollect === true;
  const dueAmount = payment.payableAmount ?? payment.amount;
  const money = (amount: number) => new Intl.NumberFormat(activeIntlLocale(), { style: 'currency', currency: payment.currency || 'EUR' }).format(amount);
  const date = (value?: string, time = false) => {
    const parsed = parseApiDate(value);
    if (!value || !Number.isFinite(parsed.getTime())) return t('paymentDetail.notProvided');
    return new Intl.DateTimeFormat(activeIntlLocale(), { day: 'numeric', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } as const : {}) }).format(parsed);
  };
  const endedAt = intervention ? interventionEndTime(intervention) : undefined;
  const notes = readableNotes(intervention?.notes);
  const photos = [
    { label: t('paymentDetail.before'), urls: parsePhotos(intervention?.beforePhotosUrls) },
    { label: t('paymentDetail.after'), urls: parsePhotos(intervention?.afterPhotosUrls) },
  ];

  return <div className="payment-record-detail">
    <FinanceIdentity variant="detail" source={{ propertyName: payment.propertyName,
      interventionId: isIntervention ? payment.referenceId : undefined,
      reservationId: payment.type === 'RESERVATION' ? payment.referenceId : undefined,
      serviceRequestId: payment.type === 'SERVICE_REQUEST' ? payment.referenceId : undefined }} />

    <section className="payment-record-detail__settlement" aria-label={t('paymentDetail.settlement')}>
      <div className="payment-record-detail__settlement-summary"><span className="payment-record-detail__caption">{t(canPay || canSend ? 'paymentDetail.amountDue' : 'payments.history.amount')}</span>
        <div className="payment-record-detail__figure"><strong className="payment-record-detail__amount">{money(canPay || canSend ? dueAmount : payment.amount)}</strong>
          <div className="payment-record-detail__status">{status}</div>
        </div>
      </div>
      <div className="payment-record-detail__pay">
        {canPay && <Button className="payment-record-detail__pay-button" disabled={processing || !Number.isFinite(dueAmount) || dueAmount <= 0} onClick={onPay}>
          {processing ? <Spinner className="size-4" /> : <CreditCard size={18} />}{t(payment.status === 'PROCESSING' ? 'paymentDetail.resume' : 'paymentDetail.pay')}
        </Button>}
        {canSend && <Button className="payment-record-detail__pay-button" disabled={sending} onClick={onSendLink}>
          {sending ? <Spinner className="size-4" /> : <Send size={18} />}{t('paymentDetail.sendLink')}
        </Button>}
      </div>
      {dueAmount >= 0 && dueAmount < payment.amount && (canPay || canSend) && <p className="payment-record-detail__deposit">{t('paymentDetail.totalAndBalance', { amount: money(payment.amount) })}</p>}
    </section>

    {(payment.refundedAmount ?? 0) > 0 && <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm tabular-nums" aria-label={t('paymentDetail.refundBreakdown')}>
      <div><dt className="text-muted-foreground">{t('paymentDetail.refundedAmount')}</dt><dd className="font-semibold">{money(payment.refundedAmount!)}</dd></div>
      <div><dt className="text-muted-foreground">{t('paymentDetail.retainedAmount')}</dt><dd className="font-semibold">{money(Math.max(0, payment.amount - (payment.creditAppliedAmount ?? 0) - payment.refundedAmount!))}</dd></div>
    </dl>}
    {payment.refundReviewRequired && <Alert>
      <AlertDescription>{(payment.refundPendingAmount ?? 0) > 0 && <strong className="tabular-nums">{money(payment.refundPendingAmount!)} · </strong>}{t('paymentDetail.refundReview')}</AlertDescription>
    </Alert>}
    {payment.paymentDisputed && <Alert>
      <AlertDescription>{t('paymentDetail.disputeHold')}</AlertDescription>
    </Alert>}
    {payment.status === 'PARTIALLY_REFUNDED' && !payment.refundReviewRequired && <p className="text-sm text-muted-foreground">
      {t('paymentDetail.partialRefundHelp')}
    </p>}

    {isIntervention && ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status) && <BaitlyExternalBatchRefundPanel interventionId={payment.referenceId} label={payment.description} />}
    {isIntervention && <section className="payment-record-detail__mission" aria-label={t('paymentDetail.intervention')}>
      {query.isLoading && <div className="payment-record-detail__loading" role="status" aria-label={t('paymentDetail.loading')}><Skeleton className="h-12 w-full" /><Skeleton className="h-20 w-full" /></div>}
      {query.isError && <div className="payment-record-detail__error" role="alert"><p>{t('paymentDetail.loadError')}</p><Button variant="outline" size="sm" onClick={() => void query.refetch()}>{t('common.retry', 'Réessayer')}</Button></div>}
      {intervention && <Tabs value={section} onValueChange={setSection} className="payment-record-detail__tabs">
        <TabsList aria-label={t('paymentDetail.intervention')} variant="line">
          {['overview', 'photos', 'documents', 'restock'].map(value => <TabsTrigger key={value} value={value}>{t(`paymentDetail.tabs.${value}`)}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="overview">
          <PaymentDetailPager items={[
            <div className="payment-record-detail__section-heading"><h3>{t('paymentDetail.intervention')}</h3><FinanceStatusIcon value={intervention.status} label={getStatusLabel(intervention.status, t)} /></div>,
            <div className="payment-record-detail__schedule">
              <div><CalendarDays size={17} /><span><small>{t('paymentDetail.scheduled')}</small><strong>{date(intervention.scheduledDate, true)}</strong></span></div>
              {intervention.estimatedDurationHours > 0 && <div><Clock3 size={17} /><span><small>{t('paymentDetail.duration')}</small><strong>{formatDuration(intervention.estimatedDurationHours)}</strong></span></div>}
            </div>,
            ...[
              [t('paymentDetail.service'), getTypeLabel(intervention.type, t)],
              [t('paymentDetail.priority'), <StatusChip label={getPriorityLabel(intervention.priority, t)} color={getPriorityTokens(intervention.priority).color} />],
              [t('paymentDetail.requestor'), intervention.requestorName || payment.hostName || t('paymentDetail.notProvided')],
              ...(intervention.completedAt ? [[t('paymentDetail.completed'), date(intervention.completedAt, true)]] : []),
              ...(intervention.actualDurationMinutes > 0 ? [[t('paymentDetail.actualDuration'), formatDuration(intervention.actualDurationMinutes / 60)]] : []),
              ...(intervention.startTime ? [[t('paymentDetail.started'), date(intervention.startTime, true)]] : []),
              ...(endedAt ? [[t('paymentDetail.ended'), date(endedAt, true)]] : []),
            ].map(([label, value]) => <dl className="payment-record-detail__fact"><dt>{label}</dt><dd>{value}</dd></dl>),
            <PaymentInterventionEvidence intervention={intervention} view="location" />,
            ...[
              [t('paymentDetail.instructions'), intervention.description],
              [t('paymentDetail.notes'), notes],
            ].flatMap(([title, text]) => (text?.match(/[\s\S]{1,180}(?:\s|$)|[\s\S]{1,180}/g) ?? []).map(part => <div className="payment-record-detail__text"><h4>{title}</h4><p>{part}</p></div>)),
            ...(intervention.quoteLines ?? []).map(line => <div className="payment-record-detail__text"><h4>{t('paymentDetail.services')}</h4><div className="payment-record-detail__quote-line"><span>{line.quantity} × {line.label}</span><strong>{money(line.quantity * line.unitPrice)}</strong></div></div>),
          ]} />
        </TabsContent>
        <TabsContent value="photos">
          <PaymentDetailPager items={photos.flatMap(group => group.urls.length ? group.urls.map((url, index) => <div className="payment-record-detail__photo">
            <a href={resolveMediaUrl(url)} target="_blank" rel="noopener noreferrer" aria-label={`${group.label} ${index + 1}`}><img src={resolveMediaUrl(url)} alt={`${group.label} ${index + 1}`} loading="lazy" /></a>
            <span>{group.label} · {index + 1}</span>
          </div>) : [<div className="payment-record-detail__text"><h4>{group.label}</h4><p className="payment-record-detail__muted">{t('paymentDetail.noPhotos')}</p></div>])} />
        </TabsContent>
        <TabsContent value="documents"><PaymentInterventionEvidence intervention={intervention} view="documents" /></TabsContent>
        <TabsContent value="restock"><PaymentInterventionEvidence intervention={intervention} view="restock" /></TabsContent>
      </Tabs>}
    </section>}
    {!isIntervention && <dl className="payment-record-detail__facts">
      <div><dt>{t('paymentDetail.requestor')}</dt><dd>{payment.hostName || t('paymentDetail.notProvided')}</dd></div>
      <div><dt>{t('paymentDetail.service')}</dt><dd>{t(payment.type === 'RESERVATION' ? 'paymentDetail.reservation' : 'paymentDetail.request')}</dd></div>
      {payment.subDescription && <div><dt>{t('paymentDetail.stay')}</dt><dd>{payment.subDescription}</dd></div>}
    </dl>}
    {payment.type === 'RESERVATION' && payment.paymentCollection === 'CHANNEL' && <BaitlyOtaSettlementPanel reservationId={payment.referenceId} />}
  </div>;
}

/** Les actions secondaires restent près du titre ; le règlement reste près du montant. */
export function PaymentRecordActions({ onView, onRefund, canRefund, refunding, children }: {
  children?: ReactNode;
  onView: () => void;
  onRefund: () => void;
  canRefund: boolean;
  refunding: boolean;
}) {
  const { t } = useTranslation();
  const iconAction = (label: string, icon: ReactNode, action: () => void, disabled = false) => <Tooltip>
    <TooltipTrigger asChild><Button variant="outline" size="icon" aria-label={label} disabled={disabled} onClick={action}>{icon}</Button></TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>;

  return <div className="payment-record-detail__tools">
    {children}
    {iconAction(t('paymentDetail.openRecord'), <ExternalLink size={16} />, onView)}
    {canRefund && iconAction(t('paymentDetail.refund'), refunding ? <Spinner className="size-4" /> : <RotateCcw size={16} />, onRefund, refunding)}
  </div>;
}

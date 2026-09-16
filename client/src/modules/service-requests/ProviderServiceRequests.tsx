import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import PagePagination from '../../components/PagePagination';
import { useServiceReferenceLabel } from '../../components/ServiceReferenceLabels';
import ServiceOfferForm from './ServiceOfferForm';
import PageTabs from '../../components/PageTabs';
import { Alert, AlertDescription, Button, Input, Label, Skeleton } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { serviceAssignmentsApi, type ProposalInboxItem, type PublicNeed } from '../../services/api/serviceAssignmentsApi';
import { invalidateMissionWorkflow } from '../../hooks/invalidateMissionWorkflow';
import { useSecondTicker } from '../../hooks/useSecondTicker';
import { formatDateTime } from '../../utils/formatUtils';

export default function ProviderServiceRequests({ embedded = false, children }: { embedded?: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('scope');
  const tab = requestedTab === 'public' || requestedTab === 'inbox' ? requestedTab : 'requests';
  const setTab = (value: string) => setParams(previous => {
    const next = new URLSearchParams(previous);
    next.set('scope', value);
    return next;
  });
  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    {!embedded && tab !== 'requests' && <PageHeader title={t('workOrders.tabs.serviceRequests')} subtitle={t('assignmentFlow.subtitle')} />}
    <PageTabs trail={false} value={tab} onChange={setTab} options={[
      { value: 'requests', label: t('assignmentFlow.myRequests') },
      { value: 'inbox', label: t('assignmentFlow.inbox') }, { value: 'public', label: t('assignmentFlow.public') },
    ]} />
    {tab === 'requests' ? children : (
      <div className="min-h-0 flex-1 overflow-y-auto">{tab === 'inbox' ? <Inbox /> : <PublicNeeds />}</div>
    )}
  </div>;
}

function Inbox() {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const query = useQuery({ queryKey: ['service-proposals', page], queryFn: () => serviceAssignmentsApi.inbox(page) });
  if (query.isPending) return <Skeleton className="h-36 w-full" />;
  if (query.isError) return <Alert variant="destructive"><AlertDescription>{t('assignmentFlow.loadFailed')} <Button variant="link" onClick={() => query.refetch()}>{t('assignmentFlow.retry')}</Button></AlertDescription></Alert>;
  return <>
    {!query.data.length && <p className="py-6 text-muted-foreground">{t('assignmentFlow.emptyInbox')}</p>}
    <div className="divide-y divide-border">{query.data.map(item => <ProposalRow key={item.proposal.id} item={item} />)}</div>
    <PagePagination page={page} onPageChange={setPage} totalPages={page + (query.data.length === 20 ? 2 : 1)} hideTotal />

  </>;
}

function ProposalRow({ item }: { item: ProposalInboxItem }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const [editingOffer,setEditingOffer] = useState(false);
  const now = useSecondTicker();
  const serviceLabel = useServiceReferenceLabel(item.serviceItemCode);
  const expired = now >= Date.parse(item.proposal.expiresAt);
  const reply = useMutation({ mutationFn: (accept: boolean) => serviceAssignmentsApi.respond(item.proposal, accept, reason),
    onSuccess: async (data) => {
      if (data.interventionId) navigate(`/interventions/${data.interventionId}`);
      else setNotice(t(`assignmentFlow.status.${data.status}`));
      await invalidateMissionWorkflow(cache);
    } });
  return <article className="flex flex-col gap-3 py-4 lg:flex-row lg:items-start lg:justify-between">
    <div className="min-w-0 space-y-1">
      <h2 className="text-sm font-semibold">{item.title}</h2>
      <p className="text-sm text-muted-foreground">{serviceLabel} · {item.city}</p>
      <p className="text-sm tabular-nums">{formatDateTime(item.scheduledAt)}{item.durationHours ? ` · ${item.durationHours} h` : ''}</p>
      <p className={`text-sm tabular-nums ${expired ? 'text-destructive-ink' : 'text-warning-ink'}`}>
        {expired ? t('assignmentFlow.status.EXPIRED') : t('assignmentFlow.replyBefore', { date: formatDateTime(item.proposal.expiresAt) })}
      </p>
      <p className="text-sm tabular-nums">{item.terms ? <>{t('requestCommercial.proposedAmount')} : {new Intl.NumberFormat(undefined, { style: 'currency', currency: item.terms.currency }).format(item.terms.amount)}</> : t('assignmentFlow.proposeQuote')}</p>
      {item.providerTerms && <p className="text-sm tabular-nums">{t('requestCommercial.price')} : {new Intl.NumberFormat(undefined,{style:'currency',currency:item.providerTerms.currency}).format(item.providerTerms.amount)}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
    <div className="w-full space-y-2 lg:w-80">
      <Label htmlFor={`reason-${item.proposal.id}`}>{t('assignmentFlow.reason')}</Label>
      <Input id={`reason-${item.proposal.id}`} value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} />
      <div className="flex gap-2">
        <Button disabled={expired || reply.isPending || !item.terms || editingOffer} onClick={() => reply.mutate(true)}>{t('assignmentFlow.accept')}</Button>
        <Button variant="outline" disabled={expired || reply.isPending} onClick={() => reply.mutate(false)}>{t('assignmentFlow.decline')}</Button>
      </div>
      {item.terms && !expired && <Button variant="outline" disabled={reply.isPending} aria-expanded={editingOffer} onClick={()=>setEditingOffer(open=>!open)}>{t(editingOffer?'common.cancel':'requestCommercial.counterOffer')}</Button>}
      {(!item.terms || editingOffer) && !expired && <ServiceOfferForm key={item.proposal.id} initialPrice={item.providerTerms ?? undefined} submit={offer => serviceAssignmentsApi.quote(item.proposal, offer)} onSuccess={() => { setEditingOffer(false);void invalidateMissionWorkflow(cache); }} />}
      {reply.isError && <p role="alert" className="text-sm text-destructive-ink">{t('assignmentFlow.replyFailed')}</p>}
    </div>
  </article>;
}

function PublicNeeds() {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [cursors, setCursors] = useState<Array<number | undefined>>([undefined]);
  const cursor = cursors[page];
  const query = useQuery({ queryKey: ['public-service-needs', cursor], queryFn: () => serviceAssignmentsApi.publicNeeds(cursor) });
  if (query.isPending) return <Skeleton className="h-36 w-full" />;
  if (query.isError) return <Alert variant="destructive"><AlertDescription>{t('assignmentFlow.publicFailed')}</AlertDescription></Alert>;
  return <>
    {!query.data.items.length && <p className="py-6 text-muted-foreground">{t('assignmentFlow.emptyPublic')}</p>}
    <div className="divide-y divide-border">{query.data.items.map(need => <PublicNeedRow key={need.id} need={need} />)}</div>
    <PagePagination page={page} hideTotal totalPages={page + (query.data.nextCursor === null ? 1 : 2)} onPageChange={next => {
      if (next > page) setCursors(previous => [...previous.slice(0, page + 1), query.data.nextCursor ?? undefined]);
      setPage(next);
    }} />

  </>;
}

function PublicNeedRow({ need }: { need: PublicNeed }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const serviceLabel = useServiceReferenceLabel(need.serviceItemCode);
  const navigate = useNavigate();
  return <article className="space-y-3 py-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-sm font-semibold">{serviceLabel}</h2><p className="text-sm text-muted-foreground">{need.city} · {need.country}</p><p className="text-sm tabular-nums">{formatDateTime(need.date)}</p></div>
      <Button variant="outline" aria-expanded={open} onClick={() => setOpen(!open)}>{t('assignmentFlow.proposeQuote')}</Button>
    </div>
    {open && <ServiceOfferForm submit={offer => serviceAssignmentsApi.offer(need.id, { ...offer, message: offer.description })} onSuccess={() => navigate('/devis')} />}
  </article>;
}

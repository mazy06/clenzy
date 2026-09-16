import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Clock3 } from 'lucide-react';
import { Button } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { OPERATIONAL_ROLES, MANAGER_ROLES } from '../../constants/roles';
import { invalidateMissionWorkflow } from '../../hooks/invalidateMissionWorkflow';
import { useSecondTicker } from '../../hooks/useSecondTicker';
import { serviceAssignmentsApi, type AssignmentCard } from '../../services/api/serviceAssignmentsApi';
import ServiceOfferForm from './ServiceOfferForm';
import ServicePriceComparison, { ServicePriceDifference } from './ServicePriceComparison';
import ServicePriceSlider from './ServicePriceSlider';
import RequestAssignmentProgress, { type AssignmentProgress } from './RequestAssignmentProgress';

const Cards = createContext<{ data?: AssignmentCard[]; loading: boolean; error: boolean; retry?: () => void } | null>(null);

/** Un chargement par tranche affichée, partagé par toutes ses cartes. */
export function RequestCommercialBatch({ ids, children }: { ids: number[]; children: ReactNode }) {
  const { hasAnyRole, user } = useAuth();
  const enabled=hasAnyRole([...OPERATIONAL_ROLES]) && !hasAnyRole([...MANAGER_ROLES]);
  const query=useQuery({ queryKey: ['service-requests-list', 'commercial', user?.id, user?.organizationId, ids],
    queryFn: () => serviceAssignmentsApi.cards(ids), enabled: enabled && ids.length>0,
    staleTime: 15_000 });
  return <Cards.Provider value={enabled ? {data:query.data,loading:query.isLoading,error:query.isError,retry:()=>void query.refetch()} : null}>{children}</Cards.Provider>;
}

export default function RequestCommercialDetails({ id, interventionId, estimate, status = 'PENDING', detailView = false, ...progress }: { id: string | number; interventionId?: number; estimate?: number; status?: string; detailView?: boolean } & AssignmentProgress) {
  const batch=useContext(Cards);
  const card=batch?.data?.find(item=>item.requestId===Number(id));
  const {t,currentLanguage}=useTranslation();
  const navigate=useNavigate();
  const cache=useQueryClient();

  const [selection,setSelection]=useState<{id:number;amount:string;currency:string} | null>(null);
  const [quotePending,setQuotePending]=useState(false);
  const proposal=card?.proposal;
  const offered=card?.offeredPrice === undefined ? (proposal?card?.price:null) : card.offeredPrice;
  const basePrice=card?.price ?? offered;
  const selectedAmount=selection?.id===proposal?.id ? selection?.amount ?? '' : basePrice ? String(basePrice.amount) : '';
  const currency=selection?.id===proposal?.id ? selection?.currency ?? 'EUR' : basePrice?.currency ?? 'EUR';
  const validAmount=selectedAmount!=='' && Number.isFinite(Number(selectedAmount)) && Number(selectedAmount)>=0 && Number(selectedAmount)<=1_000_000
    && Math.abs(Number(selectedAmount)*100-Math.round(Number(selectedAmount)*100))<0.000001 && /^[A-Z]{3}$/.test(currency);
  const matchesOffer=!!offered && validAmount && currency===offered.currency && Math.round(Number(selectedAmount)*100)===Math.round(offered.amount*100);
  const now=useSecondTicker(!!proposal);
  const accept=useMutation({mutationFn:()=>serviceAssignmentsApi.respond(proposal!,true),
    onSuccess:async result=>{
      await invalidateMissionWorkflow(cache);
      if(result.interventionId) navigate('/interventions/'+result.interventionId);
    }, onError:()=>{void invalidateMissionWorkflow(cache);} });
  const minutes=proposal?Math.max(0,Math.ceil((Date.parse(proposal.expiresAt)-now)/60_000)):0;
  const money=(amount:number,currency:string)=>new Intl.NumberFormat(currentLanguage,{style:'currency',currency}).format(amount);
  const estimated=card?.estimate ?? estimate;
  if (interventionId) return <Button variant="outline" size="sm" asChild><Link to={'/interventions/'+interventionId}>{t('marketplaceQuotes.openMission', {id:interventionId})}</Link></Button>;
  if (batch?.loading) return <div className="h-8 animate-pulse rounded bg-muted motion-reduce:animate-none" aria-label={t('requestCommercial.loading')} />;
  if (batch?.error) return <Button variant="ghost" size="sm" onClick={batch.retry}>{t('requestCommercial.retry')}</Button>;
  if (!card && estimated==null) return detailView ? <p className="text-sm text-muted-foreground">{t('requestCommercial.noEstimate')}</p> : <RequestAssignmentProgress {...progress} />;
  return <div className="space-y-2 text-xs" onClick={event=>event.stopPropagation()}>
    {!proposal && !detailView && <RequestAssignmentProgress {...progress} />}
    {!proposal && <ServicePriceComparison
      proposedLabel={t('field.proposals.asked', 'Proposé')}
      proposed={!card?.quote && estimated!=null ? (card?.estimateCurrency ? money(estimated,card.estimateCurrency) : <span title={t('requestCommercial.currencyUnknown')}>{estimated.toLocaleString(currentLanguage)}</span>) : t('requestCommercial.noEstimate')}
      providerLabel={t(card?.quote?'requestCommercial.quote':'requestCommercial.price')}
      difference={!card?.quote && estimated!=null && card?.price
        && (!card.estimateCurrency || card.estimateCurrency===card.price.currency)
        ? <ServicePriceDifference amount={card.price.amount-estimated} currency={card.estimateCurrency} /> : undefined}
      provider={card?.price ? money(card.price.amount,card.price.currency) : t('requestCommercial.priceUnconfirmed')} />}
    {proposal && <ServicePriceSlider suggested={offered} amount={selectedAmount} currency={currency}
      onChange={amount=>setSelection({id:proposal.id,amount,currency})}
      onCurrencyChange={currency=>setSelection({id:proposal.id,amount:selectedAmount,currency})}
      disabled={minutes===0 || accept.isPending || accept.isSuccess || quotePending} />}
    {proposal && <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="flex items-center gap-1 tabular-nums" style={{color:'var(--bui-warning-ink)'}} title={new Date(proposal.expiresAt).toLocaleString(currentLanguage)}>
        <Clock3 className="size-3.5" aria-hidden />{minutes>0?t('requestCommercial.expires',{count:minutes}):t('requestCommercial.expired')}
      </span>
      {matchesOffer && <Button size="sm" disabled={minutes===0 || accept.isPending || accept.isSuccess || quotePending} onClick={()=>accept.mutate()}>
        <Check className="size-3.5" aria-hidden />{t(accept.isPending?'requestCommercial.accepting':'requestCommercial.confirmPrice')}
      </Button>}
    </div>}
    {proposal && minutes>0 && !matchesOffer && <div className="space-y-2 border-t border-border pt-2">
      <p className="text-muted-foreground">{t('requestCommercial.counterOfferHelp')}</p>
      {validAmount && <ServiceOfferForm key={proposal.id} fixedPrice={{amount:Number(selectedAmount),currency}}
        onPendingChange={setQuotePending}
        submit={offer=>serviceAssignmentsApi.quote(proposal,offer)}
        onSuccess={()=>{setSelection(null);void invalidateMissionWorkflow(cache);}} />}
    </div>}
    {card && !proposal && !detailView && ['PENDING','ASSIGNED'].includes(status.toUpperCase()) && <div className="space-y-2 border-t border-border pt-2">
      {!progress.assignmentPhase && <p className="text-muted-foreground">{t(card.quote?'requestCommercial.quoteAwaitingDecision':'requestCommercial.noActiveProposal')}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!card.quote && !progress.assignmentPhase && <Button size="sm" disabled><Check className="size-3.5" aria-hidden />{t('requestCommercial.accept')}</Button>}
        <Button variant="outline" size="sm" asChild><Link to={'/service-requests/'+id}>{t('requestCommercial.openRequest')}</Link></Button>
      </div>
    </div>}
    {accept.isError && <p role="alert" className="text-destructive">{t('requestCommercial.failed')}</p>}
    {accept.isSuccess && !accept.data.interventionId && <p role="status" className="text-muted-foreground">{t(`assignmentFlow.status.${accept.data.status}`)}</p>}
  </div>;
}

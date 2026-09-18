import ServiceCapabilitySelect from '../../components/ServiceCapabilitySelect';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import apiClient from '../../services/apiClient';
import { Button, Input, Skeleton } from '../../components/ui';

import { PROVIDER_PRICING_MODELS, type ProviderPricingModel as Model } from '../../types/providerPricing';
interface Service { key: string; label: string; pricingModel: Model; amount: number|null; currency: string; unitLabel: string|null; enabled: boolean; needsReview: boolean }
interface View { services: Service[]; options: { key: string; labelFr: string; labelEn: string }[] }

export default function MyProviderServices() {
  const { user } = useAuth();
  return user ? <Editor key={String(user.id)+':'+String(user.organizationId)} /> : null;
}
function Editor() {
  const { user } = useAuth();
  const { t, currentLanguage } = useTranslation();
  const client = useQueryClient();
  const queryKey = ['my-provider-services',user?.id,user?.organizationId];
  const query = useQuery({ queryKey, queryFn: () => apiClient.get<View>('/my-provider-services') });
  const capabilityKey = ['my-service-capabilities', user?.id, user?.organizationId];
  const capabilities = useQuery({ queryKey: capabilityKey, queryFn: () => apiClient.get<string[]>('/my-service-capabilities') });
  const updateCapabilities = useMutation({
    mutationFn: (codes: string[]) => apiClient.put<string[]>('/my-service-capabilities', codes),
    onSuccess: codes => client.setQueryData(capabilityKey, codes),
  });
  const [selection,setSelection] = useState('');
  const [draft,setDraft] = useState<Service|null>(null);
  const save = useMutation({
    mutationFn: ({key,pricingModel,amount,currency,unitLabel,enabled}: Service) =>
      apiClient.put<Service>('/my-provider-services?key='+encodeURIComponent(key),{pricingModel,amount,currency,unitLabel,enabled}),
    onSuccess: () => {
      setDraft(null); setSelection('');
      for (const key of [queryKey,['provider-catalog'],['marketplace-providers'],['housekeeper-rates'],['technician-prestations'],['service-requests-list'],['service-proposals']])
        void client.invalidateQueries({queryKey:key});
    },
  });
  const choose = (key: string) => {
    setSelection(key); save.reset();
    const existing=query.data?.services.find(row => row.key===key);
    const option=query.data?.options.find(row => row.key===key);
    setDraft(existing ? {...existing} : key ? { key,label:option?.labelFr ?? key,pricingModel:'ON_QUOTE',amount:null,currency:'EUR',unitLabel:null,enabled:true,needsReview:false } : null);
  };
  const valid=draft && (draft.pricingModel==='ON_QUOTE' || (draft.amount!==null && Number.isFinite(draft.amount) && draft.amount>=0 && draft.amount<=1000000))
    && /^[A-Z]{3}$/.test(draft.currency) && (draft.pricingModel!=='PER_UNIT' || !!draft.unitLabel?.trim());
  const saveAction = usePageHeaderActions(draft && <Button type="button" disabled={!valid || save.isPending || query.isError}
    onClick={()=>save.mutate(draft)}>{t('providerServices.save')}</Button>);
  if(query.isPending) return <Skeleton className="h-40 w-full" />;
  if(query.isError) return <p role="alert">{t('marketplaceWorkflow.loadFailed')}</p>;
  return <section className="flex flex-col gap-4">
    {saveAction}
    {capabilities.isPending ? <Skeleton className="h-10 w-full" /> : capabilities.isError
      ? <p role="alert">{t('serviceReference.loadError')}</p>
      : <ServiceCapabilitySelect value={capabilities.data ?? []} disabled={updateCapabilities.isPending}
          onChange={codes => updateCapabilities.mutate(codes)} />}
    {updateCapabilities.isError && <p role="alert" className="text-sm text-destructive-ink">{updateCapabilities.error.message}</p>}
    <p className="text-sm text-muted-foreground">{t('providerServices.help')}</p>
    <label className="flex flex-col gap-1 text-sm">{t('providerServices.choose')}
      <select value={selection} disabled={save.isPending} onChange={e=>choose(e.target.value)}
        className="h-10 cursor-pointer rounded-md border border-border bg-background px-2 focus-visible:ring-2 focus-visible:ring-primary">
        <option value="">{t('providerServices.choose')}</option>
        {query.data.services.filter(row=>!query.data.options.some(o=>o.key===row.key)).map(row=><option key={row.key} value={row.key}>{row.label}</option>)}
        {query.data.options.map(row=><option key={row.key} value={row.key}>{currentLanguage.startsWith('en') ? row.labelEn || row.labelFr : row.labelFr}</option>)}
      </select>
    </label>
    {draft && <fieldset disabled={save.isPending} className="flex min-w-0 flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">{t('providerTariff.model')}
        <select value={draft.pricingModel} className="h-10 cursor-pointer rounded-md border border-border bg-background px-2 focus-visible:ring-2 focus-visible:ring-primary"
          onChange={e=>setDraft({...draft,pricingModel:e.target.value as Model,amount:e.target.value==='ON_QUOTE' ? null : draft.amount})}>
          {PROVIDER_PRICING_MODELS.map(model=><option key={model} value={model}>{t('providerServices.models.'+model)}</option>)}
        </select></label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {draft.pricingModel!=='ON_QUOTE' && <label className="flex flex-col gap-1 text-sm">{t(draft.pricingModel==='HOURLY'?'providerServices.hourlyAmount':draft.pricingModel==='FLAT'?'providerServices.missionAmount':'providerTariff.amount')}
          <Input type="number" min={0} max={1000000} step="0.01" value={draft.amount ?? ''} className="tabular-nums"
            onChange={e=>setDraft({...draft,amount:e.target.value==='' ? null : Number(e.target.value)})} /></label>}
        <label className="flex flex-col gap-1 text-sm">{t('providerTariff.currency')}
          <Input value={draft.currency} maxLength={3} onChange={e=>setDraft({...draft,currency:e.target.value.toUpperCase()})} /></label>
        {draft.pricingModel==='PER_UNIT' && <label className="flex flex-col gap-1 text-sm">{t('providerTariff.unit')}
          <Input value={draft.unitLabel ?? ''} maxLength={40} onChange={e=>setDraft({...draft,unitLabel:e.target.value})} /></label>}
      </div>
      {['HOURLY','FLAT'].includes(draft.pricingModel) && <p className="text-sm text-muted-foreground">{t(draft.pricingModel==='HOURLY'?'providerServices.hourlyHelp':'providerServices.missionHelp')}</p>}
      <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={draft.enabled}
        onChange={e=>setDraft({...draft,enabled:e.target.checked})} />{t('providerServices.enabled')}</label>
      {draft.needsReview && <p className="text-sm">{t('providerTariff.review')}</p>}
    </fieldset>}
    {save.isError && <p role="alert" className="text-sm text-destructive-ink">{(save.error as Error).message || t('marketplaceWorkflow.sendFailed')}</p>}
    {save.isSuccess && <p role="status" className="text-sm">{t('marketplaceWorkflow.saved')}</p>}
  </section>;
}

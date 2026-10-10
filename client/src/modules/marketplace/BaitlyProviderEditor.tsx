import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Textarea } from '../../components/ui';
import ServiceItemSelect from '../../components/ServiceItemSelect';
import { useTranslation } from '../../hooks/useTranslation';
import { marketplaceKeys } from '../../hooks/useMarketplaceProviders';
import { marketplaceProvidersApi, type ProviderDetailDto, type ProviderProfileEdit } from '../../services/api/marketplaceProvidersApi';
import { BaitlyProfileSection } from './BaitlyProviderProfile';
import BaitlyProviderServicesPicker from './BaitlyProviderServicesPicker';

/** Formulaire dans le flux : les changements ne sont écrits qu'à l'enregistrement. */
export default function BaitlyProviderEditor({ provider, onCancel, onSaved }: {
  provider: ProviderDetailDto; onCancel: () => void; onSaved: () => void;
}) {
  const { t } = useTranslation();
  const qc=useQueryClient();
  const [draft,setDraft]=useState<ProviderProfileEdit>(() => ({
    displayName:provider.displayName, legalName:provider.legalName ?? '', headline:provider.headline ?? '',
    bio:provider.bio ?? '', phone:provider.phone ?? '', baseAddress:provider.baseAddress ?? '',
    baseCity:provider.baseCity ?? '', basePostalCode:provider.basePostalCode ?? '', baseCountryCode:provider.baseCountryCode,
    travelRadiusKm:provider.travelRadiusKm ?? null, languages:provider.languages ?? [], acceptsUrgent:provider.acceptsUrgent,
    references:[],
  }));
  const [languageText,setLanguageText]=useState(draft.languages.join(', '));
  const save=useMutation({
    mutationFn:() => marketplaceProvidersApi.updateProfile(provider.id,{
      ...draft, languages:languageText.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
    }),
    onSuccess:value => {
      qc.setQueryData(marketplaceKeys.detail(provider.id),value);
      void qc.invalidateQueries({queryKey:marketplaceKeys.all});
      void qc.invalidateQueries({queryKey:['provider-catalog']});
      void qc.invalidateQueries({queryKey:['upsell-fulfillment']});
      onSaved();
    },
  });
  const field=(key: 'displayName'|'legalName'|'headline'|'phone'|'baseAddress'|'baseCity'|'basePostalCode'|'baseCountryCode',maxLength:number,required=false) =>
    <label className="flex min-w-0 flex-col gap-1.5 text-sm" key={key}>{t(`providerEdit.${key}`)}
      <Input value={draft[key]} maxLength={maxLength} required={required} disabled={save.isPending}
        onChange={e => setDraft(s => ({...s,[key]:e.target.value}))} /></label>;
  return <form className="baitly-provider-profile space-y-4" onSubmit={e => {e.preventDefault();save.mutate();}}>
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div><h2 className="m-0 text-lg font-semibold">{t('providerEdit.title')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('providerEdit.help')}</p></div>
      <div className="flex gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={onCancel}>{t('providerEdit.cancel')}</Button>
        <Button type="submit" disabled={save.isPending}>{t(save.isPending ? 'providerEdit.saving' : 'providerEdit.save')}</Button></div>
    </div>
    {save.isError && <p role="alert" className="mb-4 text-sm text-destructive-ink">{save.error instanceof Error ? save.error.message : t('providerEdit.error')}</p>}
    <BaitlyProfileSection title={t('providerEdit.identity')}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {field('displayName',120,true)}{field('legalName',120)}{field('headline',200)}{field('phone',40)}
        <label className="sm:col-span-2 flex flex-col gap-1.5 text-sm">{t('providerEdit.bio')}
          <Textarea value={draft.bio} maxLength={2000} disabled={save.isPending} rows={4} onChange={e => setDraft(s => ({...s,bio:e.target.value}))} /></label>
      </div>
    </BaitlyProfileSection>
    <BaitlyProfileSection title={t('providerEdit.location')}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {field('baseAddress',200)}{field('baseCity',80)}{field('basePostalCode',10)}{field('baseCountryCode',2,true)}
        <label className="flex flex-col gap-1.5 text-sm">{t('providerEdit.radius')}<Input type="number" min={0} max={1000} disabled={save.isPending}
          value={draft.travelRadiusKm ?? ''} onChange={e => setDraft(s => ({...s,travelRadiusKm:e.target.value==='' ? null : Number(e.target.value)}))} /></label>
        <label className="flex flex-col gap-1.5 text-sm">{t('providerEdit.languages')}<Input value={languageText} placeholder="fr, en, ar" disabled={save.isPending} onChange={e => setLanguageText(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={draft.acceptsUrgent} disabled={save.isPending}
          onChange={e => setDraft(s => ({...s,acceptsUrgent:e.target.checked}))} />{t('providerEdit.urgent')}</label>
      </div>
    </BaitlyProfileSection>
    <BaitlyProfileSection title={t('providerEdit.services')}>
      <BaitlyProviderServicesPicker disabled={save.isPending}
        value={draft.selectedServiceCodes ?? provider.offers.filter(o => o.active).map(o => draft.references.find(r => r.offerId===o.id)?.serviceItemCode ?? o.serviceItemCode).filter((code):code is string => !!code)}
        onChange={codes => setDraft(s => ({...s,selectedServiceCodes:codes}))} />
      {provider.offers.length>0 && <details className="mt-5 border-t border-border pt-3"><summary className="cursor-pointer text-sm">{t('providerServices.existingReferences')}</summary>
      <p className="mb-4 text-sm text-muted-foreground">{t('providerEdit.servicesHelp')}</p>
      <div className="flex flex-col gap-4">{provider.offers.map(offer => <div key={offer.id} className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-center">
        <div><p className="m-0 text-sm font-medium">{offer.label}</p><p className="m-0 text-xs text-muted-foreground">{offer.categoryLabelFr}</p></div>
        <ServiceItemSelect disabled={save.isPending} value={draft.references.find(r => r.offerId===offer.id)?.serviceItemCode ?? offer.serviceItemCode}
          onChange={item => setDraft(s => {
            const oldCode=s.references.find(r => r.offerId===offer.id)?.serviceItemCode ?? offer.serviceItemCode;
            const stillUsed=provider.offers.some(o => o.id!==offer.id && o.active && (s.references.find(r => r.offerId===o.id)?.serviceItemCode ?? o.serviceItemCode)===oldCode);
            return {...s,references:[...s.references.filter(r => r.offerId!==offer.id),{offerId:offer.id,serviceItemCode:item.code}],
              selectedServiceCodes:s.selectedServiceCodes && offer.active && oldCode && s.selectedServiceCodes.includes(oldCode)
                ? [...new Set([...s.selectedServiceCodes.filter(code => code!==oldCode || stillUsed),item.code])] : s.selectedServiceCodes};
          })} />
      </div>)}</div>
      </details>}
    </BaitlyProfileSection>
  </form>;
}

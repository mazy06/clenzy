import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Input, Skeleton } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { marketplaceKeys } from '../../hooks/useMarketplaceProviders';
import { marketplaceProvidersApi } from '../../services/api/marketplaceProvidersApi';
import { providerSectorImage } from './providerSectorImages';
import './baitlyProviderServicesPicker.css';

/** Sélection dans le brouillon, enregistrée avec le profil en une transaction. */
export default function BaitlyProviderServicesPicker({ value, onChange, disabled }: {
  value:string[]; onChange:(codes:string[])=>void; disabled?:boolean;
}) {
  const { t, isEnglish } = useTranslation();
  const catalogue = useQuery({ queryKey:marketplaceKeys.categories(), queryFn:marketplaceProvidersApi.getCategories });
  const [search,setSearch] = useState('');
  const known = new Set(catalogue.data?.flatMap(c => c.items.map(i => i.code)) ?? []);
  const selected = new Set(value.filter(code => known.has(code)));
  const toggle = (codes:string[],checked:boolean) => {
    const next=new Set(selected); codes.forEach(code => checked ? next.add(code) : next.delete(code)); onChange([...next]);
  };
  const normalize = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  const filtered = catalogue.data?.map(category => ({...category,allCodes:category.items.map(item => item.code),items:category.items.filter(item =>
    normalize(`${category.labelFr} ${category.labelEn} ${item.labelFr} ${item.labelEn}`).includes(normalize(search.trim())))})).filter(c => c.items.length) ?? [];
  return <div className="baitly-service-picker">
    <p className="baitly-service-picker__help">{t('providerServices.help')}</p>
    {catalogue.isPending ? <Skeleton className="h-48 w-full" /> : catalogue.isError ? <div role="alert">
      <p>{t('providerServices.loadError')}</p><Button type="button" variant="outline" onClick={() => void catalogue.refetch()}>{t('providerServices.retry')}</Button>
    </div> : <>
      <label className="baitly-service-picker__search">{t('providerServices.search')}<Input type="search" disabled={disabled} value={search} onChange={e => setSearch(e.target.value)} /></label>
      <div className="baitly-service-picker__groups" role="region" aria-label={t('providerServices.manage')} tabIndex={0}>
        {filtered.map(category => {
          const groupCodes=category.allCodes;
          const count=groupCodes.filter(code => selected.has(code)).length;
          return <fieldset key={category.code} disabled={disabled}>
            <legend><img src={providerSectorImage([category.code])} alt="" /><span>{isEnglish ? category.labelEn : category.labelFr}</span></legend>
            <label className="baitly-service-picker__all"><input type="checkbox" aria-label={`${t('providerServices.selectGroup')}: ${isEnglish ? category.labelEn : category.labelFr}`} checked={count===groupCodes.length}
              ref={node => {if(node) node.indeterminate=count>0 && count<groupCodes.length;}}
              onChange={e => toggle(groupCodes,e.target.checked)} />{t('providerServices.selectGroup')}<span>{count}/{groupCodes.length}</span></label>
            <div className="baitly-service-picker__items">{category.items.map(item => <label key={item.code}>
              <input type="checkbox" checked={selected.has(item.code)} onChange={e => toggle([item.code],e.target.checked)} />
              <span>{isEnglish ? item.labelEn : item.labelFr}</span>
            </label>)}</div>
          </fieldset>;
        })}
        {!filtered.length && <p>{t('providerServices.empty')}</p>}
      </div>
    </>}
    {catalogue.isSuccess && <p role="status" className="text-xs tabular-nums text-muted-foreground mt-3">{t('providerServices.selected',{count:selected.size})}</p>}
  </div>;
}

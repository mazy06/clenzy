import { useEffect,useMemo,useState } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { Button,Input,Skeleton } from '../../components/ui';
import { MapPin,Check } from '../../icons/glyphs';
import { useTranslation } from '../../hooks/useTranslation';
import { prospectionMessages } from '../../i18n/baitlyProspectionMessages';
import { baitlyCrmLocationsApi,type BaitlyCrmLocation } from '../../services/api/baitlyCrmLocationsApi';
import { geocoderApi,type GeocodedAddress } from '../../services/geocoderApi';
import ProviderCountrySelect from '../../../site/components/ProviderCountrySelect';
import { BaitlyPropertyMap,type PropertyMarker } from '../../components/BaitlyPropertyMap';
import type { ProspectDto } from '../../services/api/prospectsApi';
import { contactKind } from './baitlyCrmWorkspace';
import BaitlyCrmOsmSearch from './BaitlyCrmOsmSearch';
import type { BaitlyOsmCandidate } from '../../services/api/baitlyCrmLocationsApi';
import './baitly-crm-map.css';

export interface BaitlyCrmLocationPoint {label:string;latitude:number;longitude:number}
export interface BaitlyCrmMapSession {onPreview:(point:BaitlyCrmLocationPoint|null)=>void;onSaved:()=>Promise<void>;onBusyChange:(busy:boolean)=>void;searchMode?:'manual'|'imported';persistentReview?:boolean}
export default function BaitlyCrmLocationEditor({id,org,canManage,contact,mapSession}:{id:number;org:number;canManage:boolean;contact?:ProspectDto;mapSession?:BaitlyCrmMapSession}){
  const {currentLanguage}=useTranslation();const m=prospectionMessages(currentLanguage);const client=useQueryClient();
  const locations=useQuery({queryKey:['prospects',org,'locations'],queryFn:baitlyCrmLocationsApi.list});
  const business=contact?.contactType==='PROVIDER'&&contact.contactNature!=='PRIVATE';
  const [editing,setEditing]=useState(!!mapSession&&!business);const [country,setCountry]=useState('MA');const [precision,setPrecision]=useState<'CITY'|'ADDRESS'>('CITY');
  const [input,setInput]=useState('');const [search,setSearch]=useState('');const [choice,setChoice]=useState<GeocodedAddress|null>(null);
  const [osmPreview,setOsmPreview]=useState<BaitlyOsmCandidate|null>(null);
  const [osmBusy,setOsmBusy]=useState(false);
  const candidates=useQuery({queryKey:['crm-place-search',country,precision,search],queryFn:()=>precision==='CITY'?geocoderApi.searchCities(search,country):geocoderApi.search(search,country),enabled:editing&&search.length>=3&&/^[A-Z]{2}$/.test(country),staleTime:60_000,retry:false,refetchOnWindowFocus:false});
  const done=async()=>{await client.invalidateQueries({queryKey:['prospects',org,'locations']});if(mapSession?.persistentReview)await client.invalidateQueries({queryKey:['prospects',org,'imported-matching']});setEditing(false);setInput('');setChoice(null);await mapSession?.onSaved();};
  const save=useMutation({mutationFn:(location:Omit<BaitlyCrmLocation,'prospect_id'>)=>baitlyCrmLocationsApi.save(id,location),onSuccess:done});
  const remove=useMutation({mutationFn:()=>baitlyCrmLocationsApi.remove(id),onSuccess:done});
  const current=locations.data?.find(location=>location.prospect_id===id);
  const point=editing&&choice?choice:osmPreview??current;
  const preview=editing?choice:osmPreview;
  const onPreview=mapSession?.onPreview,onBusyChange=mapSession?.onBusyChange;
  useEffect(()=>{onPreview?.(preview);},[preview,onPreview]);
  const busy=osmBusy||save.isPending||remove.isPending||candidates.isFetching;
  useEffect(()=>{onBusyChange?.(busy);},[busy,onBusyChange]);
  const markers=useMemo<PropertyMarker[]>(()=>point?[{id,name:contact?.name||point.label,lat:point.latitude,lng:point.longitude,
    type:contact?`crm_${contactKind(contact)}`:'property',subtitle:point.label}]:[],[id,contact,point]);
  const camera=useMemo(()=>({center:[point?.longitude??0,point?.latitude??0] as [number,number],
    zoom:point?(osmPreview?15:(editing&&choice?precision:current?.precision)==='CITY'?11:15):1,bearing:0,pitch:0}),[point,editing,choice,precision,current?.precision,osmPreview]);
  return <section className="bcrm-location">{!mapSession&&<h3><MapPin size={16} aria-hidden />{m.location}</h3>}
    {locations.isPending?<Skeleton className="h-10 w-full" />:locations.isError?<p role="alert">{m.locationError}<Button variant="link" onClick={()=>locations.refetch()}>{m.locationRetry}</Button></p>:<p className="bcrm-muted">{current?`${current.label} · ${current.precision==='CITY'?m.cityPrecision:m.addressPrecision}`:m.locationNone}</p>}
    {current?.osm_type&&current.osm_id&&<p className="bcrm-muted"><a href={`https://www.openstreetmap.org/${current.osm_type}/${current.osm_id}`} target="_blank" rel="noopener noreferrer">OpenStreetMap ↗</a>{current.osm_confirmed_at&&` · ${new Date(current.osm_confirmed_at).toLocaleDateString(currentLanguage)}`}</p>}
    {canManage&&!editing&&business&&contact&&<BaitlyCrmOsmSearch key={`${org}:${id}`} contact={contact} organizationId={org} persistentReview={mapSession?.persistentReview} mode={mapSession?.searchMode??'manual'} hasLocation={!!current} onPreview={setOsmPreview} onSaved={done} initialOpen={!!mapSession} onBusyChange={setOsmBusy} />}
    {canManage&&!editing&&<Button variant="outline" size="sm" disabled={busy} className="cursor-pointer" onClick={()=>{setOsmPreview(null);setEditing(true);}}>{m.needsLocation}</Button>}
    {canManage&&editing&&<div className="bcrm-location__editor"><p className="bcrm-muted">{m.locationHelp}</p>
      <fieldset disabled={save.isPending||remove.isPending} className="space-y-3">
        <div className="bcrm-form-pair"><label>{m.country}<ProviderCountrySelect placeholder={m.country} language={currentLanguage==='ar'?'ar':currentLanguage==='en'?'en':'fr'} value={country} onChange={e=>{setCountry(e.target.value);setSearch('');setChoice(null);}} /></label>
          <label>{m.location}<select value={precision} onChange={e=>{setPrecision(e.target.value as 'CITY'|'ADDRESS');setSearch('');setChoice(null);}}><option value="CITY">{m.cityPrecision}</option><option value="ADDRESS">{m.addressPrecision}</option></select></label></div>
        <label>{m.locationSearch}<Input value={input} maxLength={200} onChange={e=>{setInput(e.target.value);setSearch('');setChoice(null);}} /></label>
        <Button type="button" variant="outline" size="sm" className="cursor-pointer" disabled={input.trim().length<3||!country||candidates.isFetching} onClick={()=>setSearch(input.trim())}>{m.findPlace}</Button>
        {candidates.isFetching&&<Skeleton className="h-16 w-full" />}
        {candidates.isError&&<p role="alert">{m.locationRetry}</p>}
        {search.length>=3&&!candidates.isFetching&&candidates.data?.length===0&&<p>{m.locationNoResult}</p>}
        <ul className="bcrm-place-results">{candidates.data?.map((place,index)=><li key={`${place.latitude}:${place.longitude}:${index}`}><button type="button" aria-pressed={choice===place} onClick={()=>setChoice(place)}><MapPin size={15} aria-hidden /><span>{place.label}</span>{choice===place&&<Check size={15} aria-hidden />}</button></li>)}</ul>
        <div className="bcrm-actions"><Button size="sm" className="cursor-pointer" disabled={!choice||save.isPending} onClick={()=>choice&&save.mutate({label:choice.label,latitude:choice.latitude,longitude:choice.longitude,precision})}>{m.locationSave}</Button>
          <Button variant="ghost" size="sm" className="cursor-pointer" onClick={()=>{setEditing(false);setInput('');setChoice(null);}}>{m.close}</Button></div>
        {current&&!mapSession&&<Button variant="ghost" size="sm" className="cursor-pointer" onClick={()=>remove.mutate()}>{m.locationRemove}</Button>}
      </fieldset>
      {(save.isError||remove.isError)&&<p role="alert">{m.locationError}</p>}
    </div>}
    {osmPreview&&<p role="status" className="bcrm-muted">{m.locationPreview}</p>}
    {!mapSession&&<div className="bcrm-location__map bcrm-geography" role="region" aria-label={m.location}>
      <BaitlyPropertyMap properties={markers} camera={camera} height="clamp(320px, 52dvh, 620px)" />
    </div>}
  </section>;
}

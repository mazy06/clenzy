import { useEffect,useRef,useState } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { Button,Input,Skeleton } from '../../components/ui';
import { baitlyCrmLocationsApi,type BaitlyOsmCandidate } from '../../services/api/baitlyCrmLocationsApi';
import type { ProspectDto } from '../../services/api/prospectsApi';
import {baitlyCrmLocationReviewApi} from "../../services/api/baitlyCrmLocationReviewApi";
import {locationReviewKey} from "./BaitlyCrmReviewResume";
import {useAuth} from "../../hooks/useAuth";
import ProviderCountrySelect from '../../../site/components/ProviderCountrySelect';
import { useTranslation } from '../../hooks/useTranslation';

const copy={
  fr:{title:'Rechercher cet établissement',name:'Nom commercial public',city:'Ville',country:'Pays',public:'Je recherche un établissement public, avec son nom commercial.',search:'Rechercher dans OpenStreetMap',help:'Vérifiez le nom et la ville. Une proposition ne confirme pas l’identité du contact.',empty:'Aucun établissement trouvé. Précisez le nom et la ville, ou utilisez la recherche par adresse.',error:'Recherche impossible. Patientez quelques secondes puis réessayez.',confirm:'Confirmer cet établissement',replace:'Remplacer la localisation déjà enregistrée',preview:'Aperçu à vérifier',failed:'Confirmation impossible : la proposition peut avoir expiré ou le contact changé. Relancez la recherche.',NAME:'Nom identique',CITY:'Ville identique',WEBSITE:'Site web identique',none:'Correspondance à vérifier',close:'Annuler'},
  en:{title:'Find this business',name:'Public business name',city:'City',country:'Country',public:'I am searching for a public business using its trading name.',search:'Search OpenStreetMap',help:'Check the name and city. A suggestion does not confirm the contact’s identity.',empty:'No businesses found. Refine the name and city, or search by address.',error:'Search unavailable. Wait a few seconds and try again.',confirm:'Confirm this business',replace:'Replace the saved location',preview:'Preview to review',failed:'Confirmation failed: the suggestion may have expired or the contact changed. Search again.',NAME:'Same name',CITY:'Same city',WEBSITE:'Same website',none:'Match to review',close:'Cancel'},
  ar:{title:'البحث عن المنشأة',name:'الاسم التجاري العام',city:'المدينة',country:'البلد',public:'أبحث عن منشأة عامة باستخدام اسمها التجاري.',search:'البحث في OpenStreetMap',help:'تحقق من الاسم والمدينة. الاقتراح لا يؤكد هوية جهة الاتصال.',empty:'لم يُعثر على منشأة. وضّح الاسم والمدينة أو ابحث بالعنوان.',error:'البحث غير متاح. انتظر قليلاً ثم أعد المحاولة.',confirm:'تأكيد هذه المنشأة',replace:'استبدال الموقع المحفوظ',preview:'معاينة للتحقق',failed:'تعذر التأكيد. ربما انتهت صلاحية الاقتراح أو تغيرت جهة الاتصال. أعد البحث.',NAME:'اسم مطابق',CITY:'مدينة مطابقة',WEBSITE:'موقع ويب مطابق',none:'مطابقة تحتاج إلى تحقق',close:'إلغاء'},
};
const extra={fr:{retry:'Réessayer la localisation',loading:'Recherche OSM en cours…',empty:'Aucune correspondance OSM trouvée. Passez ce contact ou utilisez la recherche par adresse.',SIRET:'SIRET identique',POSTAL_CODE:'Code postal identique'},en:{retry:'Retry location search',loading:'Searching OSM…',empty:'No OSM match found. Skip this contact or search by address.',SIRET:'Matching SIRET',POSTAL_CODE:'Matching postal code'},ar:{retry:'إعادة البحث عن الموقع',loading:'جارٍ البحث في OSM…',empty:'لم يُعثر على مطابقة OSM. تجاوز جهة الاتصال أو ابحث بالعنوان.',SIRET:'رقم SIRET مطابق',POSTAL_CODE:'رمز بريدي مطابق'}};
const addressCopy={
  fr:{help:'Vérifiez l’adresse proposée avant de placer le contact sur la carte.',confirm:'Confirmer cette adresse',ADDRESS:'Adresse proposée',loading:'Localisation en cours…',empty:'Aucune localisation trouvée. Passez ce contact ou précisez son adresse.'},
  en:{help:'Check the suggested address before placing the contact on the map.',confirm:'Confirm this address',ADDRESS:'Suggested address',loading:'Finding location…',empty:'No location found. Skip this contact or refine its address.'},
  ar:{help:'تحقق من العنوان المقترح قبل وضع جهة الاتصال على الخريطة.',confirm:'تأكيد هذا العنوان',ADDRESS:'عنوان مقترح',loading:'جارٍ تحديد الموقع…',empty:'لم يُعثر على موقع. تجاوز جهة الاتصال أو وضّح عنوانها.'},
};
export default function BaitlyCrmOsmSearch({contact,hasLocation,onPreview,onSaved,initialOpen=false,onBusyChange,mode='manual',organizationId,persistentReview=false}:{contact:ProspectDto;hasLocation:boolean;onPreview:(place:BaitlyOsmCandidate|null)=>void;onSaved:()=>Promise<void>;initialOpen?:boolean;onBusyChange?:(busy:boolean)=>void;mode?:'manual'|'imported';organizationId?:number;persistentReview?:boolean}){
  const client=useQueryClient();const {user}=useAuth();
  const {currentLanguage}=useTranslation();const language=currentLanguage==='ar'?'ar':currentLanguage==='en'?'en':'fr';const m=copy[language];
  const sirene=contact.contactType==='PROVIDER'&&contact.contactNature==='PROFESSIONAL'&&contact.sourceType==='OPEN_DATA'&&/^https:\/\/annuaire-entreprises\.data\.gouv\.fr\/etablissement\/[0-9]{14}$/.test(contact.sourceUrl??'');
  const [advanceError,setAdvanceError]=useState(false);
  const [open,setOpen]=useState(initialOpen),[business,setBusiness]=useState(contact.name),[city,setCity]=useState(contact.city||''),[country,setCountry]=useState(sirene?'FR':''),[publicBusiness,setPublic]=useState(sirene),[selected,setSelected]=useState<number|null>(null),[replace,setReplace]=useState(false);
  const manual=useMutation({retry:false,mutationFn:()=>baitlyCrmLocationsApi.searchOsm(contact.id,{business:business.trim(),city:city.trim(),country,publicBusiness})});
  const automatic=useQuery({queryKey:['prospects',organizationId,user?.id,'osm-imported',contact.id,contact.name,contact.city,contact.website,persistentReview],queryFn:async({signal})=>{if(persistentReview){const outcome=await baitlyCrmLocationReviewApi.enrich(contact.id,signal);if(outcome.status!=='REVIEW')return {ticket:'',candidates:[],handled:true};if(outcome.proposal)return {...outcome.proposal,handled:false};}return {...await(persistentReview?baitlyCrmLocationReviewApi.search(contact.id,signal):baitlyCrmLocationsApi.searchImportedOsm(contact.id,signal)),handled:false};},
    enabled:mode==='imported'&&open&&!hasLocation&&!!organizationId,staleTime:persistentReview?0:60_000,refetchOnWindowFocus:false,refetchOnReconnect:false,
    retry:(attempt,error)=>attempt<1&&(error as {status?:number}).status===429,retryDelay:6000});
  const search=mode==='imported'?{data:automatic.isError?undefined:automatic.data,isPending:automatic.isFetching,isError:automatic.isError,reset:()=>{},mutate:()=>{void automatic.refetch();}}:manual;
  const ban=search.data?.candidates.some(place=>place.source==='BAN')??false;
  const confirm=useMutation({retry:false,mutationFn:()=>baitlyCrmLocationsApi.confirmOsm(contact.id,{ticket:search.data!.ticket,index:selected!,replace}),onSuccess:async()=>{onPreview(null);setOpen(false);search.reset();setSelected(null);await onSaved();}});
  const busy=(mode==='manual'&&search.isPending)||confirm.isPending;
  useEffect(()=>{onBusyChange?.(busy);},[busy,onBusyChange]);
  const proposedAt=useRef(0);
  useEffect(()=>{
    if(mode==='imported'&&automatic.data&&!automatic.isFetching&&!automatic.isError&&automatic.dataUpdatedAt!==proposedAt.current){
      proposedAt.current=automatic.dataUpdatedAt;if(persistentReview&&organizationId)void client.invalidateQueries({queryKey:locationReviewKey(organizationId,user?.id)});if(automatic.data.handled){onPreview(null);void onSaved().catch(()=>setAdvanceError(true));return;}const first=automatic.data.candidates[0];setSelected(first?0:null);onPreview(first??null);
    }
  },[mode,automatic.data,automatic.dataUpdatedAt,automatic.isFetching,automatic.isError,onPreview,persistentReview,organizationId,client,user?.id,onSaved]);
  const reset=()=>{search.reset();confirm.reset();setSelected(null);onPreview(null);};
  if(mode==='imported'&&automatic.data?.handled)return <div><p role="status">{language==='fr'?'Contact traité automatiquement.':language==='ar'?'تمت معالجة جهة الاتصال تلقائياً.':'Contact processed automatically.'}</p>{advanceError&&<Button variant="outline" onClick={()=>{setAdvanceError(false);void onSaved().catch(()=>setAdvanceError(true));}}>{extra[language].retry}</Button>}</div>;
  if(!open)return <Button variant="outline" size="sm" className="cursor-pointer" onClick={()=>setOpen(true)}>{m.title}</Button>;
  return <div className="bcrm-osm-search">
    <p className="bcrm-muted">{ban?addressCopy[language].help:m.help}</p>
    {mode==='imported'&&<p className="bcrm-muted">{contact.city}</p>}
    <fieldset disabled={search.isPending||confirm.isPending}>
      {mode==='manual'&&<>
      <div className="bcrm-form-pair"><label>{m.name}<Input maxLength={160} value={business} onChange={e=>{setBusiness(e.target.value);reset();}} /></label><label>{m.city}<Input value={city} maxLength={120} onChange={e=>{setCity(e.target.value);reset();}} /></label></div>
      <label>{m.country}<ProviderCountrySelect aria-label={m.country} value={country} placeholder={m.country} language={language} onChange={e=>{setCountry(e.target.value);reset();}} /></label>
      <label className="bcrm-osm-check"><input type="checkbox" checked={publicBusiness} onChange={e=>{setPublic(e.target.checked);reset();}} />{m.public}</label>
      <Button size="sm" variant="outline" className="cursor-pointer" disabled={business.trim().length<3||!city.trim()||!country||!publicBusiness} onClick={()=>{reset();search.mutate();}}>{m.search}</Button>
      </>}
      {mode==='imported'&&search.isPending&&<p role="status">{addressCopy[language].loading}</p>}
      {search.isPending&&<Skeleton className="h-16 w-full" />}
      {search.isError&&<p role="alert">{mode==='imported'?(automatic.error as {message?:string})?.message||m.error:m.error}</p>}
      {search.data?.candidates.length===0&&<p role="status">{mode==='imported'?addressCopy[language].empty:m.empty}</p>}
      {mode==='imported'&&(search.isError||search.data?.candidates.length===0||confirm.isError)&&<Button variant="outline" size="sm" onClick={()=>{reset();proposedAt.current=0;search.mutate();}}>{extra[language].retry}</Button>}
      <ul className="bcrm-osm-results">{search.data?.candidates.map((place,index)=><li key={place.source==='BAN'?`BAN:${place.reference}`:`${place.osmType}:${place.osmId}`}>
        <button type="button" aria-pressed={selected===index} onClick={()=>{setSelected(index);confirm.reset();onPreview(place);}}><strong>{place.name}</strong><span>{place.label}</span><small>{place.signals.length?place.signals.map(signal=>({...m,...extra[language],...addressCopy[language]})[signal]).join(' · '):m.none}{selected===index?` · ${m.preview}`:''}</small></button>
        {place.source==='BAN'?<small>Base Adresse Nationale</small>:<a href={`https://www.openstreetmap.org/${place.osmType}/${place.osmId}`} target="_blank" rel="noopener noreferrer">OpenStreetMap ↗</a>}
      </li>)}</ul>
      {selected!==null&&<>{hasLocation&&<label className="bcrm-osm-check"><input type="checkbox" checked={replace} onChange={e=>setReplace(e.target.checked)} />{m.replace}</label>}
        <Button size="sm" className="cursor-pointer" disabled={hasLocation&&!replace} onClick={()=>confirm.mutate()}>{ban?addressCopy[language].confirm:m.confirm}</Button></>}
      {mode==='manual'&&<Button size="sm" variant="ghost" className="cursor-pointer" onClick={()=>{reset();setOpen(false);}}>{m.close}</Button>}
      {confirm.isError&&<p role="alert">{m.failed}</p>}
    </fieldset>
    <small>{ban?<a href="https://adresse.data.gouv.fr/base-adresse-nationale" target="_blank" rel="noopener noreferrer">Base Adresse Nationale · Licence Ouverte 2.0</a>:<>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></>}</small>
  </div>;
}

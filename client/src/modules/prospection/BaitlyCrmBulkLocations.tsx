import {useMemo,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Button,Skeleton} from '../../components/ui';
import PagePagination from '../../components/PagePagination';
import {BaitlyPropertyMap,type PropertyMarker} from '../../components/BaitlyPropertyMap';
import ProviderCountrySelect from '../../../site/components/ProviderCountrySelect';
import {useTranslation} from '../../hooks/useTranslation';
import {baitlyCrmLocationBatchesApi as api} from '../../services/api/baitlyCrmLocationBatchesApi';
import type {BaitlyOsmCandidate} from '../../services/api/baitlyCrmLocationsApi';
import './baitly-crm-map.css';

const copy={
 fr:{title:'Localiser tous les leads',country:'Pays du lot',public:'Les noms des conciergeries et prestataires de ce lot sont des noms commerciaux publics.',help:'Tous les leads actifs de l’organisation sont inclus, au-delà des filtres et des pages du tableau. Les repères confirmés sont conservés. Les propriétaires sont recherchés uniquement par leur ville.',start:'Lancer la recherche groupée',disabled:'La recherche groupée doit être activée avec un service de géocodage adapté par votre administrateur. La localisation unitaire reste disponible dans la carte.',error:'Le traitement n’a pas pu être effectué. Actualisez la page ou réessayez.',confirmError:'La proposition n’a pas pu être confirmée. Le contact ou son repère a peut-être changé : passez ce résultat et relancez une recherche unitaire.',stop:'Arrêter les recherches',running:'Recherche en cours',completed:'Recherche terminée',cancelled:'Recherche arrêtée',empty:'Aucune proposition à vérifier.',review:'Correspondances à vérifier',pending:'à rechercher',proposed:'à valider',confirmed:'confirmés',skipped:'conservés ou passés',choose:'Choisir une correspondance',confirm:'Valider le repère',skip:'Passer',preview:'Aperçu non enregistré',city:'Centre de ville',address:'Établissement',NOT_FOUND:'Aucune correspondance trouvée',NEEDS_DATA:'Ville à compléter',FAILED:'Recherche échouée',PROPOSED:'À vérifier',source:'OpenStreetMap',retry:'Actualiser'},
 en:{title:'Locate all leads',country:'Batch country',public:'Concierge and provider names in this batch are public business names.',help:'All active leads in the organization are included, beyond table filters and pages. Confirmed markers are preserved. Owners are searched by city only.',start:'Start batch search',disabled:'Your administrator must enable batch search with a suitable geocoding service. Individual location search remains available on the map.',error:'The operation failed. Refresh or try again.',confirmError:'The suggestion could not be confirmed. The contact or marker may have changed: skip this result and run an individual search.',stop:'Stop searches',running:'Search in progress',completed:'Search complete',cancelled:'Search stopped',empty:'No suggestions to review.',review:'Matches to review',pending:'to search',proposed:'to review',confirmed:'confirmed',skipped:'preserved or skipped',choose:'Choose a match',confirm:'Confirm marker',skip:'Skip',preview:'Unsaved preview',city:'City centre',address:'Business',NOT_FOUND:'No match found',NEEDS_DATA:'City needed',FAILED:'Search failed',PROPOSED:'To review',source:'OpenStreetMap',retry:'Refresh'},
 ar:{title:'تحديد مواقع كل العملاء المحتملين',country:'بلد المجموعة',public:'أسماء شركات الإدارة ومقدمي الخدمات في هذه المجموعة أسماء تجارية عامة.',help:'يشمل البحث جميع جهات الاتصال النشطة في المؤسسة بغض النظر عن فلاتر الجدول وصفحاته. تُحفظ المواقع المؤكدة. يُبحث عن المالكين باسم المدينة فقط.',start:'بدء البحث الجماعي',disabled:'يجب على المسؤول تفعيل البحث الجماعي باستخدام خدمة مناسبة لتحديد المواقع. يظل البحث الفردي متاحاً في الخريطة.',error:'تعذر تنفيذ العملية. حدّث الصفحة أو أعد المحاولة.',confirmError:'تعذر تأكيد الاقتراح. ربما تغيرت جهة الاتصال أو الموقع. تجاوز النتيجة وأعد البحث بشكل فردي.',stop:'إيقاف البحث',running:'البحث جارٍ',completed:'اكتمل البحث',cancelled:'توقف البحث',empty:'لا توجد اقتراحات للمراجعة.',review:'مطابقات للمراجعة',pending:'بانتظار البحث',proposed:'للمراجعة',confirmed:'مؤكدة',skipped:'محفوظة أو متجاوزة',choose:'اختيار مطابقة',confirm:'تأكيد الموقع',skip:'تجاوز',preview:'معاينة غير محفوظة',city:'مركز المدينة',address:'منشأة',NOT_FOUND:'لا توجد مطابقة',NEEDS_DATA:'المدينة مطلوبة',FAILED:'فشل البحث',PROPOSED:'للمراجعة',source:'OpenStreetMap',retry:'تحديث'},
};
export default function BaitlyCrmBulkLocations({org}:{org:number}){
 const {currentLanguage}=useTranslation();const language=currentLanguage==='ar'?'ar':currentLanguage==='en'?'en':'fr';const m=copy[language];const client=useQueryClient();
 const [country,setCountry]=useState(''),[publicBusinesses,setPublic]=useState(false),[page,setPage]=useState(0);
 const [preview,setPreview]=useState<{batchId:string;prospect:number;kind:'owner'|'concierge'|'provider';index:number;candidate:BaitlyOsmCandidate}|null>(null);
 const config=useQuery({queryKey:['prospects',org,'location-batch-config'],queryFn:api.config,retry:false});
 const batch=useQuery({queryKey:['prospects',org,'location-batch',page],queryFn:()=>api.latest(page),retry:false,refetchInterval:query=>query.state.data?.job?.status==='RUNNING'?3000:false});
 const done=async()=>{setPreview(null);setPage(0);await Promise.all([client.invalidateQueries({queryKey:['prospects',org,'location-batch']}),client.invalidateQueries({queryKey:['prospects',org,'locations']})]);};
 const start=useMutation({retry:false,mutationFn:()=>api.start(country,publicBusinesses),onSuccess:done});
 const confirm=useMutation({retry:false,mutationFn:()=>api.confirm(preview!.batchId,preview!.prospect,preview!.index),onSuccess:done});
 const skip=useMutation({mutationFn:(prospect:number)=>api.skip(batch.data!.job!.id,prospect),onSuccess:done});
 const cancel=useMutation({mutationFn:()=>api.cancel(batch.data!.job!.id),onSuccess:()=>client.invalidateQueries({queryKey:['prospects',org,'location-batch']})});
 const busy=start.isPending||confirm.isPending||skip.isPending||cancel.isPending;
 const counts=Object.fromEntries((batch.data?.counts??[]).map(row=>[row.status,Number(row.count)]));
 const marker=useMemo<PropertyMarker[]>(()=>preview?[{id:preview.prospect,name:preview.candidate.name,lat:preview.candidate.latitude,lng:preview.candidate.longitude,type:`crm_${preview.kind}`,subtitle:m.preview}]:[],[preview,m.preview]);
 const camera=useMemo(()=>preview?{center:[preview.candidate.longitude,preview.candidate.latitude] as [number,number],zoom:preview.candidate.precision==='CITY'?11:15,bearing:0,pitch:0}:undefined,[preview]);
 const running=batch.data?.job?.status==='RUNNING';
 return <section className="bcrm-bulk-location" aria-label={m.title}>
  <h2>{m.title}</h2><p className="bcrm-muted">{m.help}</p>
  {config.isPending||batch.isPending?<Skeleton className="h-20 w-full" />:<>
   {config.isError||batch.isError?<p role="alert">{m.error}<Button variant="outline" onClick={()=>{void config.refetch();void batch.refetch();}}>{m.retry}</Button></p>:<>
    {!config.data?.enabled&&<p role="status" className="bcrm-bulk-location__notice">{m.disabled}</p>}
    <fieldset disabled={busy||running||Number(counts.PROPOSED||0)>0||!config.data?.enabled} className="bcrm-bulk-location__start">
     <label>{m.country}<ProviderCountrySelect aria-label={m.country} language={language} placeholder={m.country} value={country} onChange={e=>setCountry(e.target.value)}/></label>
     <label className="bcrm-osm-check"><input type="checkbox" checked={publicBusinesses} onChange={e=>setPublic(e.target.checked)}/>{m.public}</label>
     <Button className="cursor-pointer" disabled={!country||!publicBusinesses} onClick={()=>start.mutate()}>{m.start}</Button>
    </fieldset>
   </>}
   {(start.isError||skip.isError||cancel.isError)&&<p role="alert">{m.error}</p>}{confirm.isError&&<p role="alert">{m.confirmError}</p>}
   {batch.data?.job&&<>
    <div className="bcrm-bulk-location__progress" role="status"><strong>{running?m.running:batch.data.job.status==='CANCELLED'?m.cancelled:m.completed}</strong>
     <span>{Number(counts.QUEUED||0)} {m.pending} · {Number(counts.PROPOSED||0)} {m.proposed} · {Number(counts.CONFIRMED||0)} {m.confirmed} · {Number(counts.SKIPPED||0)} {m.skipped}</span>
     {running&&<Button variant="outline" size="sm" disabled={busy} onClick={()=>cancel.mutate()}>{m.stop}</Button>}
    </div>
    <div className="bcrm-bulk-location__review"><div><h3>{m.review}</h3>
     {!batch.data.content?.length&&<p>{m.empty}</p>}
     {batch.data.content?.map(item=><article key={item.prospect_id} className="bcrm-bulk-location__item">
      <div><strong>{item.name}</strong><small>{item.city}</small></div>
      {item.status==='PROPOSED'?<><label className="sr-only" htmlFor={`bulk-location-${item.prospect_id}`}>{m.choose} : {item.name}</label>
       <select id={`bulk-location-${item.prospect_id}`} disabled={busy} value={preview?.batchId===batch.data!.job!.id&&preview?.prospect===item.prospect_id?preview.index:''} onChange={e=>{const index=Number(e.target.value);if(e.target.value==='')setPreview(null);else setPreview({batchId:batch.data!.job!.id,prospect:item.prospect_id,kind:item.contact_type==='OWNER'?'owner':item.category==='CONCIERGERIES'?'concierge':'provider',index,candidate:item.candidates[index]});confirm.reset();}}><option value="">{m.choose}</option>{item.candidates.map((candidate,index)=><option key={index} value={index}>{candidate.label}</option>)}</select>
       {preview?.batchId===batch.data!.job!.id&&preview?.prospect===item.prospect_id&&<small>{preview.candidate.precision==='CITY'?m.city:m.address} · <a href={`https://www.openstreetmap.org/${preview.candidate.osmType}/${preview.candidate.osmId}`} target="_blank" rel="noopener noreferrer">{m.source} ↗</a></small>}
       <Button size="sm" disabled={busy||preview?.batchId!==batch.data!.job!.id||preview?.prospect!==item.prospect_id} onClick={()=>confirm.mutate()}>{m.confirm}</Button></>:<span className="bcrm-muted">{m[item.status as 'NOT_FOUND'|'NEEDS_DATA'|'FAILED']}</span>}
      <Button variant="ghost" size="sm" disabled={busy} onClick={()=>skip.mutate(item.prospect_id)}>{m.skip}</Button>
     </article>)}
     <PagePagination page={page} rowsPerPage={10} count={batch.data.totalElements??0} onPageChange={setPage}/>
    </div>{preview?.batchId===batch.data!.job!.id&&<div className="bcrm-bulk-location__preview bcrm-geography"><p>{m.preview}</p><BaitlyPropertyMap properties={marker} camera={camera} height="360px"/></div>}</div>
   </>}
  </>}
 </section>;
}

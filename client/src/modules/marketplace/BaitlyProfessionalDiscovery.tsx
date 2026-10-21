import { lazy,Suspense,useEffect,useRef,useState } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { Button,Input,Skeleton } from '../../components/ui';
import { Search } from '../../icons/glyphs';
import { professionalDirectoryApi,crmProfessionalImportsApi,type DirectoryImportChoice,type DirectoryService } from '../../services/api/baitlyProfessionalDirectoryApi';
import { professionalDirectoryMessages } from '../../i18n/baitlyProfessionalDirectoryMessages';
import {importedCrmContactIds} from '../prospection/baitlyCrmImportedContacts';
import {enrichImportedContacts,type BaitlyEnrichmentSummary} from '../prospection/baitlyEnrichImportedContacts';
import {collectCrmProfessionals} from './baitlyCaptureProfessionals';
import {baitlyDirectoryServices as services} from '../../config/baitlyDirectoryServices';

const ImportedLocations=lazy(()=>import('../prospection/BaitlyCrmImportedLocations'));

const selectClass='mt-1 h-9 w-full cursor-pointer rounded-md border border-border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50';

/** Source selections keep their own actor-bound ticket when navigating to another page. */
export default function BaitlyProfessionalDiscovery({language,target='directory',onContact,organizationId}:{language:string;target?:'directory'|'crm';onContact?:(id:number)=>void;organizationId?:number}) {
 const m=professionalDirectoryMessages(language),qc=useQueryClient();
 const api=target==='crm'?crmProfessionalImportsApi:professionalDirectoryApi;
 const [cityName,setCityName]=useState(''),[communeCode,setCommuneCode]=useState('');
 const [service,setService]=useState<DirectoryService|''>(''),[query,setQuery]=useState(''),[page,setPage]=useState(1);
 const [selection,setSelection]=useState<Record<string,DirectoryImportChoice>>({});
 const [reviewOpen,setReviewOpen]=useState(false);
 const [enrichment,setEnrichment]=useState<BaitlyEnrichmentSummary|null>(null);
 const [cityTerm,setCityTerm]=useState(''),[found,setFound]=useState(0);
 const captureController=useRef<AbortController|null>(null);
 useEffect(()=>()=>captureController.current?.abort(),[]);
 useEffect(()=>{if(target!=='crm')return;const timer=setTimeout(()=>setCityTerm(cityName.trim()),350);return()=>clearTimeout(timer);},[cityName,target]);
 const suggestions=useQuery({queryKey:['professional-cities',cityTerm],queryFn:()=>crmProfessionalImportsApi.cities(cityTerm),enabled:target==='crm'&&cityTerm.length>=2&&cityTerm===cityName.trim()&&!communeCode,staleTime:300_000,retry:false,refetchOnWindowFocus:false});
 useEffect(()=>{
  if(target!=='crm'||communeCode||cityTerm!==cityName.trim())return;
  const exact=suggestions.data?.filter(city=>city.nom.toLocaleLowerCase()===cityTerm.toLocaleLowerCase());
  if(exact?.length===1)setCommuneCode(exact[0].code);
 },[target,communeCode,cityTerm,cityName,suggestions.data]);
 const cities=useMutation({mutationFn:api.cities});
 const cityResults=target==='crm'?suggestions:cities;
 const discovery=useMutation({mutationFn:(nextPage:number)=>api.discover({query,communeCode,service,page:nextPage})});
 const batch=useMutation({mutationFn:api.importBatch,onSuccess:()=>{setSelection({});void qc.invalidateQueries({queryKey:[target==='crm'?'prospects':'professional-directory']});}});
 const capture=useMutation({retry:false,mutationFn:async()=>{
  const controller=new AbortController();captureController.current=controller;setFound(0);setEnrichment(null);
  const collected=await collectCrmProfessionals({query:'',communeCode,service},controller.signal,setFound);
  controller.signal.throwIfAborted();
  if(collected.choices.length){const report=await batch.mutateAsync(collected.choices);const summary=await enrichImportedContacts(report,controller.signal,setEnrichment);setEnrichment(summary);await qc.invalidateQueries({queryKey:['prospects']});}
  return collected;
 }});
 const importedCount=target==='crm'&&batch.data?importedCrmContactIds(batch.data).length:0;
 const reviewCount=enrichment?enrichment.review+enrichment.pending:importedCount;
 const busy=discovery.isPending||cities.isPending||batch.isPending||capture.isPending;
 const reset=()=>{discovery.reset();batch.reset();capture.reset();setSelection({});setPage(1);setFound(0);setEnrichment(null);};
 const count=Object.keys(selection).length;
 const candidates=discovery.data?.candidates??[];
 const allPage=!!candidates.length&&candidates.every(item=>selection[item.siret]);
 const togglePage=()=>setSelection(old=>{
  const next={...old};candidates.forEach((item,index)=>{if(allPage)delete next[item.siret];else if(Object.keys(next).length<100)next[item.siret]={ticket:discovery.data!.ticket,index};});return next;
 });
 if(reviewOpen&&target==='crm'&&organizationId&&batch.data)return <Suspense fallback={<Skeleton className="h-96 w-full"/>}><ImportedLocations results={batch.data} org={organizationId} onContact={onContact} onClose={()=>setReviewOpen(false)}/></Suspense>;
 return <section className="space-y-3 border-b border-border p-3" aria-label={target==='crm'?m.findProfessionals:m.add}>
  {target==='crm'&&<p className="text-xs text-muted-foreground">{m.captureHelp}</p>}
  <div className="flex flex-wrap items-end gap-2">
   <label className="min-w-40 flex-1 text-xs">{m.city}<Input value={cityName} maxLength={80} disabled={busy} onChange={e=>{setCityName(e.target.value);setCommuneCode('');cities.reset();reset();}} onKeyDown={e=>{if(e.key==='Enter'&&cityName.trim().length>=2){e.preventDefault();if(target!=='crm')cities.mutate(cityName);}}}/></label>
   {target!=='crm'&&<Button size="sm" variant="outline" disabled={busy||cityName.trim().length<2} onClick={()=>cities.mutate(cityName)}>{m.findCity}</Button>}
   {cityResults.isSuccess&&!!cityResults.data.length&&(target!=='crm'||(cityTerm===cityName.trim()&&(!communeCode||suggestions.data?.filter(city=>city.nom.toLocaleLowerCase()===cityTerm.toLocaleLowerCase()).length!==1)))&&<label className="min-w-48 flex-1 text-xs">{m.chooseCity}<select className={selectClass} value={communeCode} disabled={busy} onChange={e=>{setCommuneCode(e.target.value);reset();}}>
    <option value="">{m.chooseCity}</option>{cityResults.data.map(city=><option key={city.code} value={city.code}>{city.nom} ({city.codesPostaux.join(', ')})</option>)}
   </select></label>}
   <label className="min-w-44 flex-1 text-xs">{m.service}<select className={selectClass} value={service} disabled={busy} onChange={e=>{setService(e.target.value as DirectoryService|'');reset();}}>
    <option value="">{target==='crm'?m.chooseService:m.allServices}</option>{services.map(code=><option key={code} value={code}>{m[code]}</option>)}
   </select></label>
   {target!=='crm'&&<label className="min-w-44 flex-1 text-xs">{m.business} · {m.optional}<Input value={query} maxLength={120} disabled={busy} onChange={e=>{setQuery(e.target.value);reset();}}/></label>}
   <Button size="sm" disabled={busy||!communeCode||(target==='crm'&&!service)} aria-busy={capture.isPending} onClick={()=>{reset();if(target==='crm')capture.mutate();else discovery.mutate(1);}}><Search className="size-4"/>{target==='crm'?(capture.isPending?(batch.isSuccess?m.enriching:m.capturing):m.capture):m.discover}</Button>
   {capture.isPending&&!batch.isPending&&<Button size="sm" variant="ghost" onClick={()=>captureController.current?.abort()}>{m.cancelCapture}</Button>}
  </div>
  <p className="text-xs text-muted-foreground">{m.activityHint}</p>
  {cityResults.isSuccess&&!cityResults.data.length&&<p role="status" className="text-sm">{m.noCity}</p>}
  {(cityResults.isError||discovery.isError||batch.isError||(capture.isError&&(capture.error as Error).name!=='AbortError'))&&<p role="alert" className="text-sm text-destructive">{batch.isError?m.importError:m.error}</p>}
  {(cities.isPending||discovery.isPending||capture.isPending||suggestions.isFetching)&&<Skeleton className="h-20 w-full"/>}
  {capture.isPending&&<p role="status" className="text-xs tabular-nums">{found} {m.found}</p>}
  {enrichment&&<p role="status" className="text-xs tabular-nums">{enrichment.confirmed} {m.autoLocated} · {enrichment.review} {m.manualReview} · {enrichment.pending} {m.enrichmentPending}</p>}
  {capture.isSuccess&&!capture.data.choices.length&&<p role="status" className="text-sm">{m.emptySource}</p>}
  {capture.isSuccess&&capture.data.hasMore&&<p className="text-xs text-muted-foreground">{m.captureMore}</p>}
  {discovery.isSuccess&&<>
   <div className="flex flex-wrap items-center gap-3 text-xs">
    <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={allPage} disabled={busy||!candidates.length} onChange={togglePage}/>{m.selectPage}</label>
    <span className="tabular-nums" role="status">{count} {m.selected}</span>
    <Button size="sm" variant="ghost" disabled={busy||!count} onClick={()=>setSelection({})}>{m.clearSelection}</Button>
    <Button size="sm" className="ms-auto" disabled={busy||!count} aria-busy={batch.isPending} onClick={()=>batch.mutate(Object.values(selection))}>{batch.isPending?m.importing:`${target==='crm'?m.importCrm:m.importSelection} (${count})`}</Button>
   </div>
   <p className="text-xs text-muted-foreground">{m.selectBusiness} {m.limitSelection}</p>
   {!candidates.length&&<p className="text-sm">{m.emptySource}</p>}
   <div className="max-h-80 overflow-y-auto divide-y divide-border">
    {candidates.map((item,index)=><label key={item.siret} className="flex cursor-pointer items-start gap-3 py-2 text-sm hover:bg-muted/50">
     <input type="checkbox" className="mt-1" checked={!!selection[item.siret]} disabled={busy||(!selection[item.siret]&&count>=100)} onChange={()=>setSelection(old=>{const next={...old};if(next[item.siret])delete next[item.siret];else next[item.siret]={ticket:discovery.data!.ticket,index};return next;})}/>
     <span><span className="font-medium">{item.name}</span><span className="mt-1 block text-xs text-muted-foreground">{item.address} · {item.siret} · {item.activity}</span></span>
    </label>)}
   </div>
   <div className="flex items-center gap-2"><Button size="sm" variant="ghost" disabled={busy||page===1} onClick={()=>{setPage(page-1);discovery.mutate(page-1);}}>{m.previous}</Button><span className="text-xs tabular-nums">{page}</span><Button size="sm" variant="ghost" disabled={busy||page>=100||!discovery.data.hasNext} onClick={()=>{setPage(page+1);discovery.mutate(page+1);}}>{m.next}</Button></div>
  </>}
  {batch.isSuccess&&<section aria-label={m.importReport} className="max-h-48 overflow-y-auto text-xs" role="status"><strong>{m.importReport}</strong>{batch.data.map(item=><p key={item.siret} className="mt-1">{item.name} · {item.siret} : {m[item.status]}{onContact&&item.id&&<Button variant="link" size="sm" onClick={()=>onContact(item.id!)}>{m.openContact}</Button>}</p>)}</section>}
  {organizationId&&batch.isSuccess&&importedCount>0&&<div><Button size="sm" variant="outline" disabled={capture.isPending} onClick={()=>setReviewOpen(true)}>{reviewCount?`${m.reviewImported} (${reviewCount})`:m.viewImportedMap}</Button></div>}
 </section>;
}

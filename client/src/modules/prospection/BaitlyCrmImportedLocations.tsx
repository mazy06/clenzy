import {useEffect,useMemo,useRef} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Button,Skeleton,Alert,AlertDescription} from '../../components/ui';
import {useAuth} from '../../hooks/useAuth';
import {useTranslation} from '../../hooks/useTranslation';
import {prospectsApi} from '../../services/api/prospectsApi';
import type {DirectoryImportResult} from '../../services/api/baitlyProfessionalDirectoryApi';
import {professionalDirectoryMessages} from '../../i18n/baitlyProfessionalDirectoryMessages';
import {baitlyCrmLocationReviewApi} from "../../services/api/baitlyCrmLocationReviewApi";
import {locationReviewKey,reviewCopy} from "./BaitlyCrmReviewResume";
import {importedCrmContactIds} from './baitlyCrmImportedContacts';
import BaitlyCrmMap from './BaitlyCrmMap';
import {useBaitlyCrmEnrichment} from './useBaitlyCrmEnrichment';
import './baitly-prospection.css';
import './baitly-crm-workflows.css';

/** Reuses the CRM map; manual review opens only when server enrichment is no longer running. */
export default function BaitlyCrmImportedLocations({results,org,onClose,onContact}:{results:DirectoryImportResult[];org:number;onClose:()=>void;onContact?:(id:number)=>void}){
 const {user}=useAuth();const {currentLanguage}=useTranslation();const m=professionalDirectoryMessages(currentLanguage??'fr');
 const client=useQueryClient();
 const automatic=useBaitlyCrmEnrichment(undefined,org);
 const ids=useMemo(()=>importedCrmContactIds(results),[results]);
 const enqueue=useQuery({queryKey:[...locationReviewKey(org,user?.id),'enqueue',ids],queryFn:async()=>{const result=await baitlyCrmLocationReviewApi.enqueue(ids);client.setQueryData(locationReviewKey(org,user?.id),result);return result;},enabled:!!ids.length,retry:false,refetchOnWindowFocus:false});
 const progress=useQuery({queryKey:locationReviewKey(org,user?.id),queryFn:baitlyCrmLocationReviewApi.progress,enabled:!ids.length||enqueue.isSuccess,retry:false,refetchOnWindowFocus:false});
 const contacts=useQuery({queryKey:['prospects',org,'imported-matching',user?.id,ids],queryFn:prospectsApi.getAll,enabled:progress.isSuccess,retry:false,refetchOnWindowFocus:false});
 const imported=useMemo(()=>{const selected=new Set(progress.data?.items.map(item=>item.id)??[]);return (contacts.data??[]).filter(contact=>selected.has(contact.id)&&!contact.archived);},[contacts.data,progress.data]);
 const q=reviewCopy[currentLanguage==="ar"?"ar":currentLanguage==="en"?"en":"fr"];
 const failed=enqueue.isError||progress.isError||contacts.isError;const loading=!failed&&(automatic.isLoading||(!!ids.length&&enqueue.isPending)||progress.isPending||!progress.isFetchedAfterMount||contacts.isPending);
 const root=useRef<HTMLElement>(null);
 useEffect(()=>{root.current?.focus({preventScroll:true});root.current?.scrollIntoView({block:'start'});return()=>{void client.invalidateQueries({predicate:query=>query.queryKey[0]==='prospects'&&!query.queryKey.includes('osm-imported')&&!query.queryKey.includes('location-review')});};},[client]);
 return <section ref={root} tabIndex={-1} aria-label={m.postImportTitle} className="bcrm-theme bcrm-geography flex min-h-0 flex-1 flex-col gap-3 focus-visible:outline-2 focus-visible:outline-ring">
  <h2 className="text-base font-medium">{m.postImportTitle}</h2>
  <p className="text-xs text-muted-foreground">{m.postImportHelp}</p>
  {progress.data&&!failed&&!loading&&<p role="status" className="text-xs text-muted-foreground tabular-nums">{q.saved} · {progress.data.remaining} {q.remaining} · {progress.data.confirmed} {q.confirmed} · {progress.data.skipped} {q.skipped} · {progress.data.notFound} {q.notFound}</p>}
  {loading&&<Button size="sm" variant="ghost" onClick={onClose}>{m.backToImport}</Button>}
  {loading?<Skeleton className="h-96 w-full"/>:failed?<Alert variant="destructive"><AlertDescription>{m.error} <Button size="sm" variant="outline" onClick={()=>{if(ids.length)void enqueue.refetch();void progress.refetch();void contacts.refetch();}}>{m.retry}</Button></AlertDescription></Alert>:imported.length?<div className="relative flex h-[70dvh] min-h-96 flex-col">
   <BaitlyCrmMap key={`${org}:${ids.join(',')}`} contacts={imported} org={org} canManage initialMatching={!automatic.enrich.isPending} matchingMode="imported" onOpen={onContact} onExit={onClose} exitLabel={m.backToImport}/>
  </div>:<><p role="status" className="text-sm">{m.importedUnavailable}</p><Button size="sm" variant="outline" onClick={onClose}>{m.backToImport}</Button></>}
  {failed&&<Button size="sm" variant="ghost" onClick={onClose}>{m.backToImport}</Button>}
 </section>;
}

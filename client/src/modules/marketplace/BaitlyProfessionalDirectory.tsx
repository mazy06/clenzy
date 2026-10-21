import BaitlyDirectoryContactFilter from './BaitlyDirectoryContactFilter';
import type {DirectoryContactFilter} from '../../config/baitlyDirectoryContacts';
import PageHeaderViewControls from "../../components/PageHeaderViewControls";
import {PageHeaderFilterControls} from "../../components/PageHeaderActionsContext";
import {List as HeaderList,Map as HeaderMap} from "../../icons/glyphs";
import {enrichImportedContacts} from '../prospection/baitlyEnrichImportedContacts';
import BaitlyCrmReviewResume from '../prospection/BaitlyCrmReviewResume';
import { lazy,Suspense,useEffect,useMemo,useRef,useState } from 'react';
import { useInfiniteQuery,useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useThemeMode } from '../../hooks/useThemeMode';
import { useScreenSearch } from '../../components/ScreenChrome';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import { Button,Skeleton,Alert,AlertDescription } from '../../components/ui';
import EmptyState from '../../components/EmptyState';
import MapWithSheet from '../../components/baitly/MapWithSheet';
import { BaitlyMapCanvas,type PropertyMarker } from '../../components/BaitlyMapCanvas';
import { MapCardCoordinator } from '../../components/map/MapCardCoordinator';
import { MapPin,Check,Plus } from '../../icons/glyphs';
import BaitlyProfessionalDiscovery from './BaitlyProfessionalDiscovery';
import { professionalDirectoryApi as api,crmProfessionalImportsApi,type ReferencedProfessional } from '../../services/api/baitlyProfessionalDirectoryApi';
import { prospectsApi } from '../../services/api/prospectsApi';
import { DirectoryToolbar,DirectorySegments,DirectorySegment } from '../../components/catalog/DirectoryToolbar';
import { professionalDirectoryMessages } from '../../i18n/baitlyProfessionalDirectoryMessages';
import {importedCrmContactIds} from '../prospection/baitlyCrmImportedContacts';
import {baitlyDirectoryServices} from '../../config/baitlyDirectoryServices';
import type {DirectoryService} from '../../services/api/baitlyProfessionalDirectoryApi';
import {baitlyDirectoryGlyph} from '../../config/baitlyDirectoryGlyphs';
import BaitlyProfessionalMapCard from './BaitlyProfessionalMapCard';

const ImportedLocations=lazy(()=>import('../prospection/BaitlyCrmImportedLocations'));

export default function BaitlyProfessionalDirectory(){
 const {user}=useAuth();return <ProfessionalDirectory key={`${user?.id}:${user?.organizationId??'none'}`}/>;
}
function ProfessionalDirectory(){
 const {currentLanguage}=useTranslation();const m=professionalDirectoryMessages(currentLanguage??'fr');
 const {hasAnyRole,user}=useAuth();const canManage=hasAnyRole(['SUPER_ADMIN','SUPER_MANAGER']);const {isDark}=useThemeMode();
 const qc=useQueryClient();
 const [query,setQuery]=useState(''),[map,setMap]=useState(false),[missing,setMissing]=useState(false);
 const [contacts,setContacts]=useState<DirectoryContactFilter>('');
 const [service,setService]=useState<DirectoryService|''>('');
 const [importing,setImporting]=useState<'directory'|'crm'|null>(null);
 const [crmReviewOpen,setCrmReviewOpen]=useState(false);
 const crmAccess=useQuery({queryKey:['prospects',user?.id,user?.organizationId,'access'],queryFn:prospectsApi.access,enabled:!!user?.permissions?.includes('baitly-crm:view')});
 const canImportCrm=!!crmAccess.data?.canManage;
 const crmImport=useMutation({mutationFn:async(id:number)=>{const result=await crmProfessionalImportsApi.importReference(id);await enrichImportedContacts([result],new AbortController().signal);return result;},onSuccess:()=>{void qc.invalidateQueries({queryKey:['prospects']});}});
 const [matchingId,setMatchingId]=useState<number|null>(null),[selected,setSelected]=useState<number>();
 const [locate,setLocate]=useState<{id:number;request:number}|null>(null);
 useScreenSearch(query,setQuery,m.search);
 const sync=useQuery({queryKey:['professional-directory-sync'],queryFn:()=>api.synchronization(),refetchInterval:30_000});
 const directory=useInfiniteQuery({queryKey:['professional-directory',query,service,contacts],initialPageParam:0,
  queryFn:({pageParam})=>api.list(query,pageParam,service,contacts),getNextPageParam:last=>(last.page+1)*30<last.total?last.page+1:undefined,
  refetchInterval:sync.data?.phase&&sync.data.phase!=='COMPLETED'?30_000:false});
 const rows=useMemo(()=>directory.data?.pages.flatMap(p=>p.items)??[],[directory.data]);
 const isLocated=(row:ReferencedProfessional)=>row.latitude!==null&&row.longitude!==null;
 const visible=missing?rows.filter(row=>!isLocated(row)):rows;
 const matches=useMutation({mutationFn:api.match});
 const save=useMutation({mutationFn:async(action:{kind:'osm';id:number;ticket:string;index:number}|{kind:'remove';id:number})=>{
  if(action.kind==='osm')await api.confirm(action.id,action.ticket,action.index);else await api.remove(action.id);
 },onSuccess:(_,action)=>{void qc.invalidateQueries({queryKey:['professional-directory']});if(action.kind==='osm'){matches.reset();setMatchingId(null);}if(action.kind==='remove')setSelected(undefined);}});
 const sentinel=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!sentinel.current||!directory.hasNextPage||directory.isFetchingNextPage||typeof IntersectionObserver==='undefined')return;
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))void directory.fetchNextPage();},{root:sentinel.current.closest('[data-map-list-scroll]'),rootMargin:'150px'});
  observer.observe(sentinel.current);return()=>observer.disconnect();
 },[directory.hasNextPage,directory.isFetchingNextPage,directory.fetchNextPage,map]);
 const header=usePageHeaderActions(<>{canManage&&<Button size="sm" disabled={save.isPending} onClick={()=>{setImporting(v=>v==='directory'?null:'directory');save.reset();}}><Plus className="size-4"/>{m.add}</Button>}{canImportCrm&&<Button size="sm" variant={canManage?'outline':'default'} onClick={()=>setImporting(v=>v==='crm'?null:'crm')}>{m.findProfessionals}</Button>}</>);
 const markers=useMemo<PropertyMarker[]>(()=>visible.flatMap(row=>row.latitude!==null&&row.longitude!==null?[{id:row.id,name:row.name,lat:row.latitude,lng:row.longitude,type:'crm_provider',glyph:baitlyDirectoryGlyph(row.activity),subtitle:row.address}]:[]),[visible]);
 const select=(row:ReferencedProfessional)=>{setSelected(row.id);if(isLocated(row))setLocate(old=>({id:row.id,request:(old?.request??0)+1}));};
 const renderRow=(row:ReferencedProfessional)=><article key={row.id} className="border-b border-border px-3 py-3 text-sm">
  <button type="button" className="w-full cursor-pointer text-start font-medium focus-visible:outline-2 focus-visible:outline-ring" onClick={()=>select(row)}>{row.name}</button>
  <p className="mt-1 text-xs text-muted-foreground">{row.address}</p>
  <p className="mt-1 text-xs tabular-nums text-muted-foreground">{row.siret} · {m.activity} {row.activity}</p>
  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">{row.phone&&<span dir="ltr">{row.phone}</span>}{row.email&&<span dir="ltr">{row.email}</span>}{row.website&&<a href={row.website} target="_blank" rel="noopener noreferrer" className="underline">{m.website}</a>}</div>
  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
   <a href={`https://annuaire-entreprises.data.gouv.fr/etablissement/${row.siret}`} target="_blank" rel="noopener noreferrer" className="underline">Sirene · Licence Ouverte 2.0</a>
   <time dateTime={row.sirene_retrieved_at}>{new Date(row.sirene_retrieved_at).toLocaleDateString(currentLanguage)}</time>
   {row.rge_retrieved_at&&<a href="https://data.ademe.fr/datasets/liste-des-entreprises-rge-2" target="_blank" rel="noopener noreferrer" className="underline">ADEME RGE · Licence Ouverte 2.0</a>}
   {row.osm_key&&<a href={`https://www.openstreetmap.org/${row.osm_key}`} target="_blank" rel="noopener noreferrer" className="underline">OSM · ODbL</a>}
   <span>{row.osm_confirmed_at?m.located:isLocated(row)?m.sireneLocated:m.unlocated}</span>
  </div>
  <p className="mt-1 text-xs text-muted-foreground">{m.referenced}</p>
  {canManage&&<div className="mt-2 flex flex-wrap gap-1">
   <Button size="sm" variant="outline" disabled={matches.isPending||save.isPending} onClick={()=>{setMatchingId(row.id);save.reset();matches.mutate(row.id);}}><MapPin className="size-3.5"/>{m.match}</Button>
   <Button size="sm" variant="ghost" disabled={save.isPending||matches.isPending} onClick={()=>save.mutate({kind:'remove',id:row.id})}>{m.remove}</Button>
  </div>}
  {canImportCrm&&<div className="mt-2"><Button size="sm" variant="outline" disabled={crmImport.isPending} onClick={()=>crmImport.mutate(row.id)}>{m.importCrm}</Button>
   {crmImport.variables===row.id&&crmImport.isSuccess&&<p role="status" className="mt-1 text-xs">{m[crmImport.data.status]} · {m.privateCopy}</p>}
   {crmImport.variables===row.id&&crmImport.isSuccess&&!!importedCrmContactIds([crmImport.data]).length&&<Button size="sm" className="mt-2" onClick={()=>setCrmReviewOpen(true)}>{m.reviewImported}</Button>}
   {crmImport.variables===row.id&&crmImport.isError&&<p role="alert" className="mt-1 text-xs text-destructive">{m.importError}</p>}
  </div>}
  {canManage&&matchingId===row.id&&<section className="mt-3 space-y-2" aria-label={m.matches}>
   {matches.isPending&&<Skeleton className="h-20 w-full"/>}{matches.isError&&<p role="alert">{m.error}</p>}
   {matches.isSuccess&&!matches.data.candidates.length&&<p>{m.noMatch}</p>}
   {matches.data?.candidates.map((place,index)=><div key={place.key} className="rounded-md bg-muted p-2">
    <p className="font-medium">{place.name}</p><p className="text-xs">{place.address}</p><p className="text-xs tabular-nums">{place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}</p>
    <p className="text-xs">{place.signals.map(s=>m[s as 'NAME'|'SIRET'|'POSTAL_CODE']).join(' · ')||m.proximity}</p>
    <a href={`https://www.openstreetmap.org/${place.key}`} target="_blank" rel="noopener noreferrer" className="me-3 text-xs underline">{m.inspect}</a>
    <Button size="sm" disabled={save.isPending} onClick={()=>save.mutate({kind:'osm',id:row.id,ticket:matches.data!.ticket,index})}><Check className="size-3.5"/>{row.osm_confirmed_at?m.replace:m.confirm}</Button>
   </div>)}
   <Button size="sm" variant="ghost" disabled={matches.isPending||save.isPending} onClick={()=>{setMatchingId(null);matches.reset();}}>{m.close}</Button>
  </section>}
 </article>;
 if(crmReviewOpen&&canImportCrm&&crmAccess.data)return <section className="flex min-h-0 flex-1 flex-col gap-3">{header}<Suspense fallback={<Skeleton className="h-96 w-full"/>}><ImportedLocations results={crmImport.data?[crmImport.data]:[]} org={crmAccess.data.organizationId} onClose={()=>setCrmReviewOpen(false)}/></Suspense></section>;
 const list=<>{visible.map(renderRow)}<div ref={sentinel} className="p-3">{directory.hasNextPage&&<Button size="sm" variant="ghost" disabled={directory.isFetchingNextPage} onClick={()=>directory.fetchNextPage()}>{m.more}</Button>}</div></>;
 return <section className="flex min-h-0 flex-1 flex-col gap-3">{header}
  {canImportCrm&&crmAccess.data&&<BaitlyCrmReviewResume org={crmAccess.data.organizationId} onOpen={()=>setCrmReviewOpen(true)}/>}
  {importing&&((importing==='directory'&&canManage)||(importing==='crm'&&canImportCrm))&&<BaitlyProfessionalDiscovery key={`${importing}:${user?.organizationId}`} language={currentLanguage??'fr'} target={importing} organizationId={crmAccess.data?.organizationId}/>}
  {save.isError&&<Alert variant="destructive"><AlertDescription>{(save.error as {message?:string}).message||m.error}</AlertDescription></Alert>}{save.isSuccess&&<p role="status" className="px-3 text-sm">{m.saved}</p>}
  <PageHeaderViewControls label={m.title} value={map?"map":"list"} onChange={value=>setMap(value==="map")} options={[{value:"list",label:m.list,icon:<HeaderList size={16}/>},{value:"map",label:m.map,icon:<HeaderMap size={16}/>,action:"locate"}]} />
  <PageHeaderFilterControls><div className="flex flex-col gap-3">
   <BaitlyDirectoryContactFilter language={currentLanguage??'fr'} value={contacts} onChange={setContacts}/>
   <label className="flex items-center gap-2 text-xs">{m.service}<select value={service} onChange={e=>setService(e.target.value as DirectoryService|'')} className="h-8 max-w-56 cursor-pointer rounded-md border border-border bg-background px-2 focus-visible:outline-2 focus-visible:outline-ring"><option value="">{m.allServices}</option>{baitlyDirectoryServices.map(code=><option key={code} value={code}>{m[code]}</option>)}</select></label>
   <Button size="sm" variant="ghost" aria-pressed={missing} onClick={()=>setMissing(v=>!v)}>{m.missing}</Button><span className="ms-auto text-xs tabular-nums">{rows.length} / {directory.data?.pages[0]?.total??0}</span>
  </div></PageHeaderFilterControls>
  {sync.data?.enabled&&<p role="status" className="px-3 text-xs tabular-nums text-muted-foreground">{m.nationalDirectory} · {sync.data.retry_at?m.syncPaused:sync.data.phase==='COMPLETED'?m.syncComplete:m.syncRunning}{sync.data.scanned!==undefined&&` · ${sync.data.scanned.toLocaleString(currentLanguage)} ${m.sourceRows}`}{sync.data.completed_at&&` · ${new Date(sync.data.completed_at).toLocaleDateString(currentLanguage)}`}</p>}
  {directory.isError?<Alert variant="destructive"><AlertDescription>{m.error} <Button size="sm" variant="outline" onClick={()=>directory.refetch()}>{m.retry}</Button></AlertDescription></Alert>:directory.isPending?<Skeleton className="h-48 w-full"/>:map?<MapCardCoordinator><MapWithSheet desktopLayout="split" listWidth="clamp(280px, 30vw, 400px)" listTitle={m.title} listInteraction={matchingId?'form':'browse'} listResetKey={query+missing+service}
   map={<BaitlyMapCanvas height="100%" colorMode={isDark?'dark':'light'} properties={markers} selectedPropertyId={selected} locateProperty={locate} onMarkerClick={marker=>setSelected(marker.id)}
    renderPopup={marker=>{const row=rows.find(item=>item.id===marker.id);return row?<BaitlyProfessionalMapCard row={row} language={currentLanguage??'fr'}/>:null;}}/>}>
   {!visible.length&&<p className="p-3 text-sm text-muted-foreground">{m.empty}</p>}{list}
  </MapWithSheet></MapCardCoordinator>:rows.length?<div className="min-h-0 flex-1 overflow-y-auto">{list}</div>:<EmptyState icon={<MapPin/>} title={m.empty} description={m.emptyHelp}/>}
 </section>;
}

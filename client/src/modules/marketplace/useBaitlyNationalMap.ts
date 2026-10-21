import {useEffect,useMemo,useRef,useState} from 'react';
import {useInfiniteQuery,useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useBaitlyDeferredStartup} from '../../hooks/useBaitlyDeferredStartup';
import {professionalDirectoryApi,type DirectoryService,type DirectoryServiceFilter,type DirectoryMapSort,type ReferencedProfessional} from '../../services/api/baitlyProfessionalDirectoryApi';
import {rankDirectoryRows,inDirectoryViewport} from './baitlyDirectoryRanking';
import {directoryCountriesBounds} from './BaitlyDirectoryCountries';
import type {DirectoryCountry} from './BaitlyDirectoryCountry';
import type {MapBounds,PropertyMarker} from '../../components/BaitlyMapCanvas';
import {baitlyDirectoryGlyph} from '../../config/baitlyDirectoryGlyphs';
import {baitlyDirectoryActivity} from '../../config/baitlyDirectoryActivities';

import {matchesDirectoryContacts,type DirectoryContactFilter} from '../../config/baitlyDirectoryContacts';
import {mergeMapAreas,nextMapAreaBatch,loadMapAreaBatch,type MapAreaBatch,type MapDirectorySnapshot} from './baitlyMapCoverage';

const FRANCE:MapBounds={west:-5.5,south:41,east:10,north:51.5};
const WORLD:MapBounds={west:-180,south:-90,east:180,north:90};
function normalizeBounds(next:MapBounds):MapBounds|null{
 if(!Object.values(next).every(Number.isFinite))return null;
 const wrap=(n:number)=>((n+180)%360+360)%360-180;
 return {west:next.east-next.west>=360?-180:wrap(next.west),east:next.east-next.west>=360?180:wrap(next.east),south:Math.max(-90,next.south),north:Math.min(90,next.north)};
}
const sameBounds=(a:MapBounds,b:MapBounds)=>a.west===b.west&&a.east===b.east&&a.south===b.south&&a.north===b.north;
const loadedAreas=(snapshot:MapDirectorySnapshot|undefined)=>[...(snapshot?.areas??[]),...(snapshot?.rankedCoverage??[]).map(bounds=>({bounds,after:0,nextCursor:null}))];
/** Public-source query keys never include or fetch organization CRM data. */
export function useBaitlyNationalMap(enabled:boolean,query:string,country:string='FR',ranked=false,keepId?:number){
 const available=enabled;
 const countries=country.split(',') as DirectoryCountry[];
 const countryBounds=directoryCountriesBounds(countries);
 const keepRef=useRef(keepId);keepRef.current=keepId;
 const cache=useQueryClient();
 const backgroundReady=useBaitlyDeferredStartup();
 const synchronization=useQuery({queryKey:['professional-directory-sync',country],queryFn:async()=>{
  const statuses=await Promise.all(countries.map(code=>professionalDirectoryApi.synchronization(code)));
  if(statuses.length===1)return statuses[0];
  return {...statuses[0],enabled:statuses.some(status=>status.enabled),published:statuses.reduce((sum,status)=>sum+(status.published??0),0),phase:statuses.every(status=>status.phase==='COMPLETED')?'COMPLETED' as const:statuses.find(status=>status.phase!=='COMPLETED')?.phase,completed_at:statuses.map(status=>status.completed_at??'').sort().at(-1)};
 },enabled:available&&backgroundReady,refetchInterval:30_000,staleTime:15_000});
 const [city,setCity]=useState(''),[services,setServices]=useState<DirectoryService[]>([]);
 const service=services.join(',') as DirectoryServiceFilter;
 const setService=(value:DirectoryService|'')=>setServices(value?[value]:[]);
 const [contacts,setContacts]=useState<DirectoryContactFilter>('');
 const [sort,setSort]=useState<DirectoryMapSort>('PROXIMITY');
 const [bounds,setBounds]=useState(FRANCE),[coverageBounds,setCoverageBounds]=useState(FRANCE),[settled,setSettled]=useState({city:'',bounds:FRANCE,coverageBounds:FRANCE,query:'',ready:false,country});
 useEffect(()=>{const timer=setTimeout(()=>setSettled({city:city.trim(),bounds,coverageBounds,query:query.trim(),ready:true,country}),120);return()=>clearTimeout(timer);},[city,bounds,coverageBounds,query,country]);
 useEffect(()=>{setBounds(countryBounds);setCoverageBounds(countryBounds);},[country]);
 const extent=settled.city?WORLD:settled.bounds;
 const index=useQuery({queryKey:['professional-directory-index'],queryFn:professionalDirectoryApi.mapIndex,enabled:available&&ranked,
  staleTime:30_000,retry:false,refetchOnWindowFocus:false,refetchOnReconnect:false});
 const [failedTileRevision,setFailedTileRevision]=useState<number|null>(null);
 const tilesFailed=failedTileRevision!==null&&failedTileRevision===index.data?.revision;
 const [cameraZoom,setCameraZoom]=useState<number>();
 const [vectorScale,setVectorScale]=useState(true);
 useEffect(()=>{
  const zoom=cameraZoom??Math.log2(360/Math.max(.00001,settled.coverageBounds.east-settled.coverageBounds.west));
  setVectorScale(previous=>previous?zoom<9.5:zoom<8.5);
 },[cameraZoom,settled.coverageBounds]);
 const useTiles=available&&ranked&&!tilesFailed&&!settled.city&&!settled.query&&index.data?.spatial&&index.data.revision===index.data.indexedRevision&&
  vectorScale;
 const filterKey=[country,settled.city,service,settled.query,contacts,ranked?index.data?.revision??0:0];
 const scopeKey=JSON.stringify(filterKey);
 const coverage=useQuery({queryKey:['professional-directory-coverage',scopeKey,settled.coverageBounds],enabled:available&&(settled.ready&&settled.country===country)&&!useTiles&&(!ranked||!index.isPending),
  queryFn:async({signal})=>({...await professionalDirectoryApi.clusters({country,city:settled.city,service,query:settled.query,bounds:settled.coverageBounds,contacts},signal),scopeKey}),
  placeholderData:previous=>previous?.scopeKey===scopeKey?previous:undefined,staleTime:60_000,refetchOnWindowFocus:false,refetchOnReconnect:false});
 // Preserve the previous vector surface until its exact, close-up replacement is ready.
 const keepTiles=available&&ranked&&!tilesFailed&&!settled.city&&!settled.query&&index.data?.spatial&&index.data.revision===index.data.indexedRevision&&!coverage.data&&!coverage.isError;
 const tilesUrl=useTiles||keepTiles?professionalDirectoryApi.tilesUrl(index.data!.revision,service,contacts,country):undefined;
 const snapshotKey=['professional-directory-map-snapshot',...filterKey];
 // Cache de données backend, partagé avec React Query et isolé par filtres.
 const snapshot=useQuery({queryKey:snapshotKey,queryFn:async():Promise<MapDirectorySnapshot>=>({rows:[],areas:[]}),enabled:false,initialData:():MapDirectorySnapshot=>({rows:[],areas:[]})});
 const next=nextMapAreaBatch(extent,loadedAreas(snapshot.data));
 const result=useInfiniteQuery({queryKey:['professional-directory-map',...filterKey,'areas-v2'],enabled:available&&!ranked&&(settled.ready&&settled.country===country),
  initialPageParam:{bounds:extent,after:0} as MapAreaBatch,queryFn:async({pageParam,signal})=>{
   const pages=await loadMapAreaBatch(pageParam,area=>professionalDirectoryApi.map({country,city:settled.city,service,query:settled.query,...area,contacts},signal));
   if(!signal.aborted)cache.setQueryData<MapDirectorySnapshot>(snapshotKey,previous=>mergeMapAreas(previous,pages));
   return {items:pages.flatMap(({page})=>page.items),nextCursor:pages[0].page.nextCursor};
  },
  getNextPageParam:()=>nextMapAreaBatch(extent,loadedAreas(cache.getQueryData<MapDirectorySnapshot>(snapshotKey))),staleTime:30_000,
  // Le cadrage reste stable au repos ; les nouvelles zones sont chargées sur navigation.
  refetchOnWindowFocus:false,refetchOnReconnect:false});
 const nextKey=JSON.stringify(next);
 useEffect(()=>{
  if(available&&!ranked&&(settled.ready&&settled.country===country)&&result.data&&!result.isFetching&&!result.isError&&next?.after===0)void result.fetchNextPage();
 },[available,ranked,(settled.ready&&settled.country===country),nextKey,result.dataUpdatedAt,result.isFetching,result.isError]);
 // La publication invalide le cache sans modifier la carte ouverte au repos.
 useEffect(()=>{
  if(enabled&&(synchronization.data?.published||synchronization.data?.phase==='COMPLETED'))void cache.invalidateQueries({queryKey:['professional-directory-map'],refetchType:'none'});
 },[cache,enabled,synchronization.data?.published,synchronization.data?.phase,synchronization.data?.completed_at]);
 const rows=useMemo(()=>{const selected=new Set(country.split(','));return available?snapshot.data.rows.filter(row=>selected.has(row.country_code??'FR')&&Number.isFinite(row.latitude)&&Number.isFinite(row.longitude)&&(!service||services.includes((row.service??baitlyDirectoryActivity(row.activity)) as DirectoryService))&&matchesDirectoryContacts(row,contacts)):[];},[available,snapshot.data.rows,service,contacts,country]);
 // Only deliberate navigation changes this viewport. Selection camera moves update coverage alone.
 const rankingKey=['professional-directory-ranked',scopeKey,sort,settled.bounds];
 const rankedResult=useInfiniteQuery({queryKey:rankingKey,enabled:available&&ranked&&(settled.ready&&settled.country===country)&&!index.isPending,initialPageParam:0,maxPages:10,
  queryFn:async({pageParam,signal})=>{
   const previous=cache.getQueryData<MapDirectorySnapshot>(snapshotKey);
   const complete=previous&&!nextMapAreaBatch(extent,loadedAreas(previous))&&!cache.getQueryData(rankingKey);
   const ordered=complete?rankDirectoryRows(previous.rows,settled.bounds,sort).filter(row=>inDirectoryViewport(row,extent)):undefined;
   const start=pageParam&&ordered?ordered.findIndex(row=>row.id===pageParam)+1:0;
   const cachedItems=ordered?.slice(start,start+200);
   const page=cachedItems?{items:cachedItems,nextCursor:start+200<ordered!.length?cachedItems.at(-1)!.id:null}:await professionalDirectoryApi.rankedMap({country,city:settled.city,service,query:settled.query,contacts,sort,bounds:extent,centerBounds:settled.bounds,after:pageParam},signal);
   if(!signal.aborted)cache.setQueryData<MapDirectorySnapshot>(snapshotKey,previous=>{
    const merged=new Map((previous?.rows??[]).map(row=>[row.id,row]));page.items.forEach(row=>{merged.delete(row.id);merged.set(row.id,row);});
    // A bounded backend-data cache; the focused company is never evicted.
    const evicted=merged.size>2000;
    for(const id of merged.keys()){if(merged.size<=2000)break;if(id!==keepRef.current)merged.delete(id);}
    const complete=evicted?[]:previous?.rankedCoverage??[];
    return {rows:[...merged.values()],areas:evicted?[]:previous?.areas??[],truncated:evicted||previous?.truncated,rankedCoverage:page.nextCursor===null&&(pageParam===0||!evicted&&!previous?.truncated)&&!complete.some(area=>sameBounds(area,extent))?[...complete,extent]:complete};
   });
   return {...page,scopeKey,sort};
  },getNextPageParam:page=>page.nextCursor??undefined,
  placeholderData:previous=>previous?.pages[0]?.scopeKey===scopeKey&&previous.pages[0]?.sort===sort?previous:undefined,
  staleTime:60_000,refetchOnWindowFocus:false,refetchOnReconnect:false});
 const reference=useMutation({mutationFn:professionalDirectoryApi.reference,onSuccess:row=>cache.setQueryData<MapDirectorySnapshot>(snapshotKey,previous=>{
  if(!countries.includes(row.country_code??'FR'))return previous;
  const merged=new Map((previous?.rows??[]).map(row=>[row.id,row]));merged.set(row.id,row);
  const evicted=merged.size>2000;
  for(const id of merged.keys()){if(merged.size<=2000)break;if(id!==row.id&&id!==keepRef.current)merged.delete(id);}
  return {...previous,rows:[...merged.values()],areas:evicted?[]:previous?.areas??[],rankedCoverage:evicted?[]:previous?.rankedCoverage,truncated:evicted||previous?.truncated};
 })});
 const listRows=useMemo(()=>ranked?rankDirectoryRows(rows,settled.bounds,sort):rows,[ranked,rows,settled.bounds,sort]);
 // Negative IDs separate public references from positive, organization-private prospect IDs.
 const markers=useMemo<PropertyMarker[]>(()=>rows.map(row=>({id:-row.id,name:row.name,lat:row.latitude!,lng:row.longitude!,type:(row.service??baitlyDirectoryActivity(row.activity))==='CONCIERGE'?'crm_concierge':'crm_provider',glyph:baitlyDirectoryGlyph(row.activity,row.service),subtitle:row.address})),[rows]);
 const cityFocusKey=JSON.stringify([country,settled.city,service,settled.query,contacts]);
 const [cityFocus,setCityFocus]=useState<{key:string;bounds:[number,number,number,number]}|null>(null);
 const cityPoints=ranked?rankedResult.data?.pages[0]?.items:result.data?.pages[0]?.items;
 useEffect(()=>{
  // City framing is a search action, not a side effect of pagination, re-sorting or tile refresh.
  if(!available||!settled.city||cityFocus?.key===cityFocusKey||!cityPoints?.length)return;
  const points=cityPoints.filter(row=>Number.isFinite(row.latitude)&&Number.isFinite(row.longitude)&&(!service||services.includes((row.service??baitlyDirectoryActivity(row.activity)) as DirectoryService))&&matchesDirectoryContacts(row,contacts));
  if(points.length)setCityFocus({key:cityFocusKey,bounds:[Math.min(...points.map(r=>r.longitude!)),Math.min(...points.map(r=>r.latitude!)),Math.max(...points.map(r=>r.longitude!)),Math.max(...points.map(r=>r.latitude!))]});
 },[available,settled.city,cityFocus?.key,cityFocusKey,cityPoints,service,contacts]);
 const focusBounds=cityFocus?.key===cityFocusKey?cityFocus.bounds:null;

 return {reference,tilesUrl,onTilesError:()=>{setFailedTileRevision(index.data?.revision??null);void index.refetch();},rows,listRows,listResult:ranked?rankedResult:result,sort,setSort,markers,coverage,contacts,setContacts,city,setCity,service,setService,services,setServices,focusBounds,result:ranked?rankedResult:result,synchronization,resetKey:JSON.stringify(filterKey),onCoverageBoundsChange:(next:MapBounds,zoom?:number)=>{
  if(zoom!==undefined&&Number.isFinite(zoom))setCameraZoom(zoom);
  const normalized=normalizeBounds(next);if(normalized)setCoverageBounds(previous=>sameBounds(previous,normalized)?previous:normalized);
 },onBoundsChange:(next:MapBounds)=>{
  const normalized=normalizeBounds(next);if(!normalized)return;
  setBounds(previous=>sameBounds(previous,normalized)?previous:normalized);
  setCoverageBounds(previous=>sameBounds(previous,normalized)?previous:normalized);
  if(Date.now()-index.dataUpdatedAt>30_000&&ranked)void index.refetch();
 }};
}

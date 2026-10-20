import {useEffect,useMemo,useState} from 'react';
import {useInfiniteQuery,useQuery,useQueryClient} from '@tanstack/react-query';
import {professionalDirectoryApi,type DirectoryService,type DirectoryMapSort} from '../../services/api/baitlyProfessionalDirectoryApi';
import {rankDirectoryRows} from './baitlyDirectoryRanking';
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
export function useBaitlyNationalMap(enabled:boolean,query:string,country:'FR'|'MA'|'SA'='FR',ranked=false){
 const available=enabled&&country==='FR';
 const cache=useQueryClient();
 const synchronization=useQuery({queryKey:['professional-directory-sync'],queryFn:professionalDirectoryApi.synchronization,enabled:available,refetchInterval:30_000,staleTime:15_000});
 const [city,setCity]=useState(''),[service,setService]=useState<DirectoryService|''>('');
 const [contacts,setContacts]=useState<DirectoryContactFilter>('');
 const [sort,setSort]=useState<DirectoryMapSort>('PROXIMITY');
 const [bounds,setBounds]=useState(FRANCE),[coverageBounds,setCoverageBounds]=useState(FRANCE),[settled,setSettled]=useState({city:'',bounds:FRANCE,coverageBounds:FRANCE,ready:false});
 useEffect(()=>{const timer=setTimeout(()=>setSettled({city:city.trim(),bounds,coverageBounds,ready:true}),120);return()=>clearTimeout(timer);},[city,bounds,coverageBounds]);
 const extent=settled.city?WORLD:settled.bounds;
 const filterKey=[country,settled.city,service,query,contacts];
 const scopeKey=JSON.stringify(filterKey);
 const coverage=useQuery({queryKey:['professional-directory-coverage',scopeKey,settled.coverageBounds],enabled:available&&settled.ready,
  queryFn:async({signal})=>({...await professionalDirectoryApi.clusters({city:settled.city,service,query,bounds:settled.coverageBounds,contacts},signal),scopeKey}),
  placeholderData:previous=>previous?.scopeKey===scopeKey?previous:undefined,staleTime:60_000,refetchOnWindowFocus:false,refetchOnReconnect:false});
 const snapshotKey=['professional-directory-map-snapshot',...filterKey];
 // Cache de données backend, partagé avec React Query et isolé par filtres.
 const snapshot=useQuery({queryKey:snapshotKey,queryFn:async():Promise<MapDirectorySnapshot>=>({rows:[],areas:[]}),enabled:false,initialData:():MapDirectorySnapshot=>({rows:[],areas:[]})});
 const next=nextMapAreaBatch(extent,loadedAreas(snapshot.data));
 const result=useInfiniteQuery({queryKey:['professional-directory-map',...filterKey,'areas-v2'],enabled:available&&settled.ready,
  initialPageParam:{bounds:extent,after:0} as MapAreaBatch,queryFn:async({pageParam,signal})=>{
   const pages=await loadMapAreaBatch(pageParam,area=>professionalDirectoryApi.map({city:settled.city,service,query,...area,contacts},signal));
   if(!signal.aborted)cache.setQueryData<MapDirectorySnapshot>(snapshotKey,previous=>mergeMapAreas(previous,pages));
   return {items:pages.flatMap(({page})=>page.items),nextCursor:pages[0].page.nextCursor};
  },
  getNextPageParam:()=>nextMapAreaBatch(extent,loadedAreas(cache.getQueryData<MapDirectorySnapshot>(snapshotKey))),staleTime:30_000,
  // Le cadrage reste stable au repos ; les nouvelles zones sont chargées sur navigation.
  refetchOnWindowFocus:false,refetchOnReconnect:false});
 const nextKey=JSON.stringify(next);
 useEffect(()=>{
  if(available&&settled.ready&&result.data&&!result.isFetching&&!result.isError&&next?.after===0)void result.fetchNextPage();
 },[available,settled.ready,nextKey,result.dataUpdatedAt,result.isFetching,result.isError]);
 // La publication invalide le cache sans modifier la carte ouverte au repos.
 useEffect(()=>{
  if(enabled&&(synchronization.data?.published||synchronization.data?.phase==='COMPLETED'))void cache.invalidateQueries({queryKey:['professional-directory-map'],refetchType:'none'});
 },[cache,enabled,synchronization.data?.published,synchronization.data?.phase,synchronization.data?.completed_at]);
 const rows=useMemo(()=>available?snapshot.data.rows.filter(row=>Number.isFinite(row.latitude)&&Number.isFinite(row.longitude)&&(!service||baitlyDirectoryActivity(row.activity)===service)&&matchesDirectoryContacts(row,contacts)):[],[available,snapshot.data.rows,service,contacts]);
 // Only deliberate navigation changes this viewport. Selection camera moves update coverage alone.
 const rankingKey=['professional-directory-ranked',scopeKey,sort,settled.bounds];
 const rankedResult=useInfiniteQuery({queryKey:rankingKey,enabled:available&&ranked&&settled.ready,initialPageParam:0,
  queryFn:async({pageParam,signal})=>{
   const page=await professionalDirectoryApi.rankedMap({city:settled.city,service,query,contacts,sort,bounds:settled.bounds,after:pageParam},signal);
   if(!signal.aborted)cache.setQueryData<MapDirectorySnapshot>(snapshotKey,previous=>{
    const merged=new Map((previous?.rows??[]).map(row=>[row.id,row]));page.items.forEach(row=>merged.set(row.id,row));
    const complete=previous?.rankedCoverage??[];
    return {rows:[...merged.values()],areas:previous?.areas??[],rankedCoverage:page.nextCursor===null&&!complete.some(area=>sameBounds(area,settled.bounds))?[...complete,settled.bounds]:complete};
   });
   return {...page,scopeKey,sort};
  },getNextPageParam:page=>page.nextCursor??undefined,
  placeholderData:previous=>previous?.pages[0]?.scopeKey===scopeKey&&previous.pages[0]?.sort===sort?previous:undefined,
  staleTime:60_000,refetchOnWindowFocus:false,refetchOnReconnect:false});
 const listRows=useMemo(()=>ranked?rankDirectoryRows(rows,settled.bounds,sort):rows,[ranked,rows,settled.bounds,sort]);
 // Negative IDs separate public references from positive, organization-private prospect IDs.
 const markers=useMemo<PropertyMarker[]>(()=>rows.map(row=>({id:-row.id,name:row.name,lat:row.latitude!,lng:row.longitude!,type:baitlyDirectoryActivity(row.activity)==='CONCIERGE'?'crm_concierge':'crm_provider',glyph:baitlyDirectoryGlyph(row.activity),subtitle:row.address})),[rows]);
 const focusBounds=useMemo<[number,number,number,number]|null>(()=>{
  const points=available&&settled.city?result.data?.pages[0]?.items:undefined;if(!points?.length)return null;
  const located=points.filter(row=>Number.isFinite(row.latitude)&&Number.isFinite(row.longitude)&&(!service||baitlyDirectoryActivity(row.activity)===service)&&matchesDirectoryContacts(row,contacts));if(!located.length)return null;
  return [Math.min(...located.map(r=>r.longitude!)),Math.min(...located.map(r=>r.latitude!)),Math.max(...located.map(r=>r.longitude!)),Math.max(...located.map(r=>r.latitude!))];
 },[available,settled.city,result.data?.pages[0],service,contacts]);
 return {rows,listRows,listResult:ranked?rankedResult:result,sort,setSort,markers,coverage,contacts,setContacts,city,setCity,service,setService,focusBounds,result,synchronization,resetKey:JSON.stringify(filterKey),onCoverageBoundsChange:(next:MapBounds)=>{
  const normalized=normalizeBounds(next);if(normalized)setCoverageBounds(previous=>sameBounds(previous,normalized)?previous:normalized);
 },onBoundsChange:(next:MapBounds)=>{
  const normalized=normalizeBounds(next);if(!normalized)return;
  setBounds(previous=>sameBounds(previous,normalized)?previous:normalized);
  setCoverageBounds(previous=>sameBounds(previous,normalized)?previous:normalized);
 }};
}

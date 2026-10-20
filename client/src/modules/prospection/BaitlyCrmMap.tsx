import {MapLoadingIndicator,MapListSkeleton} from '../../components/map/MapLoading';
import BaitlyDirectoryContactFilter from '../marketplace/BaitlyDirectoryContactFilter';
import { useCallback,useEffect,useMemo,useRef,useState,type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BaitlyMapCanvas,type PropertyMarker } from '../../components/BaitlyMapCanvas';
import { Button,Input,Skeleton,Tooltip,TooltipTrigger,TooltipContent } from '../../components/ui';
import { Home,KeyRound,Wrench,MapPin,ListChecks,X } from '../../icons/glyphs';
import { useTranslation } from '../../hooks/useTranslation';
import { useThemeMode } from '../../hooks/useThemeMode';
import { prospectionMessages } from '../../i18n/baitlyProspectionMessages';
import { baitlyCrmLocationsApi } from '../../services/api/baitlyCrmLocationsApi';
import { contactKind,type BaitlyCrmContact } from './baitlyCrmWorkspace';
import BaitlyCrmContactCard from './BaitlyCrmContactCard';
import BaitlyCrmMapContact from './BaitlyCrmMapContact';
import BaitlyCrmMapMatching,{type BaitlyCrmMapPreview} from './BaitlyCrmMapMatching';
import MapWithSheet from '../../components/baitly/MapWithSheet';
import { MapCardCoordinator } from '../../components/map/MapCardCoordinator';
import MapFilterTool from '../../components/map/MapFilterTool';
import MapProgressiveList from '../../components/map/MapProgressiveList';
import {useBaitlyCrmEnrichment} from './useBaitlyCrmEnrichment';
import {professionalDirectoryMessages} from '../../i18n/baitlyProfessionalDirectoryMessages';
import {useBaitlyNationalMap} from '../marketplace/useBaitlyNationalMap';
import BaitlyProfessionalMapCard from '../marketplace/BaitlyProfessionalMapCard';
import {directoryCoverageMarkers} from '../marketplace/baitlyDirectoryCoverageMarkers';
import {baitlyDirectoryServices} from '../../config/baitlyDirectoryServices';
import type {DirectoryService,DirectoryMapSort} from '../../services/api/baitlyProfessionalDirectoryApi';
import {PageHeaderFilterControls,usePageHeaderFilterHost,usePageHeaderActions} from '../../components/PageHeaderActionsContext';
import BaitlyDirectoryCountry,{type DirectoryCountry} from '../marketplace/BaitlyDirectoryCountry';
import MapLoadMore from '../../components/map/MapLoadMore';
import {useBaitlyProfessionalMapImport} from '../marketplace/useBaitlyProfessionalMapImport';
import './baitly-crm-map.css';

export default function BaitlyCrmMap({contacts,org,onOpen,filtersSlot,filtersActive=false,canManage=false,initialMatching=false,onExit,exitLabel,matchingMode='manual',nationalDirectory=false,search='',publicOnly=false,onFiltersActiveChange}:{onFiltersActiveChange?:(active:boolean)=>void;publicOnly?:boolean;contacts:BaitlyCrmContact[];org?:number;onOpen?:(id:number)=>void;filtersSlot?:ReactNode;filtersActive?:boolean;canManage?:boolean;initialMatching?:boolean;onExit?:()=>void;exitLabel?:string;matchingMode?:'manual'|'imported';nationalDirectory?:boolean;search?:string}){
  const headerFilters=usePageHeaderFilterHost();const directoryOnly=nationalDirectory&&(org===undefined||publicOnly);
  const {t,currentLanguage}=useTranslation();const {isDark}=useThemeMode();const m=prospectionMessages(currentLanguage);
  const [onlyMissing,setOnlyMissing]=useState(false);const [locate,setLocate]=useState<{id:number;request:number}|null>(null);
  const [showNational,setShowNational]=useState(true),[showCrm,setShowCrm]=useState(!publicOnly);
  const [country,setCountry]=useState<DirectoryCountry>('FR');
  const [focusedId,setFocusedId]=useState<number>();const focusRef=useRef(focusedId);focusRef.current=focusedId;
  const [matching,setMatching]=useState(initialMatching),[matchingBusy,setMatchingBusy]=useState(false),[preview,setPreview]=useState<BaitlyCrmMapPreview|null>(null);
  const locations=useQuery({queryKey:['prospects',org,'locations'],queryFn:baitlyCrmLocationsApi.list,enabled:org!==undefined&&!publicOnly});
  const positions=useMemo(()=>new Map((locations.data??[]).map(location=>[location.prospect_id,location])),[locations.data]);
  const byId=useMemo(()=>new Map(contacts.map(contact=>[contact.id,contact])),[contacts]);
  const crmMarkers=useMemo(()=>contacts.flatMap(contact=>{
    const location=positions.get(contact.id);if(!location)return [];
    return [{id:contact.id,name:`${m[`${contactKind(contact)}Label`]} : ${contact.name}`,lat:location.latitude,lng:location.longitude,type:`crm_${contactKind(contact)}` as PropertyMarker['type'],subtitle:location.label}];
  }),[contacts,positions,m]);
  const list=!showCrm?[]:onlyMissing?contacts.filter(contact=>!positions.has(contact.id)):contacts;
  const missing=contacts.filter(contact=>!positions.has(contact.id));
  const automatic=useBaitlyCrmEnrichment(missing.map(contact=>contact.id),org,true,canManage&&org!==undefined&&!publicOnly);
  const a=professionalDirectoryMessages(currentLanguage??'fr');
  const matchingActive=matching&&canManage&&showCrm;
  const national=useBaitlyNationalMap(nationalDirectory&&showNational&&!matchingActive,search,country,true);
  const sortControl=nationalDirectory&&showNational&&!matchingActive?<select className="bcrm-directory-sort" aria-label={a.sortProfessionals} title={a.sortProfessionals} value={national.sort} onChange={event=>national.setSort(event.target.value as DirectoryMapSort)}><option value="PROXIMITY">{a.sortProximity}</option><option value="CONTACTS">{a.sortContacts}</option><option value="NAME">{a.sortName}</option></select>:null;
  const sortHeader=usePageHeaderActions(sortControl);
  const publicFiltersActive=!!national.city.trim()||!!national.service||!!national.contacts||country!=='FR';
  useEffect(()=>{onFiltersActiveChange?.(publicFiltersActive);return()=>onFiltersActiveChange?.(false);},[publicFiltersActive,onFiltersActiveChange]);
  const selection=useBaitlyProfessionalMapImport(org,canManage&&nationalDirectory);
  const selectedMarkerIds=useMemo(()=>[...selection.selected].map(id=>-id),[selection.selected]);
  const selectableRows=national.rows.slice(0,100);
  const selectionFor=(id:number)=>selection.canImport?{checked:selection.selected.has(id),disabled:selection.request.isPending||selection.selected.size>=100&&!selection.selected.has(id),onChange:()=>selection.toggle(id)}:undefined;
  const coverageMarkers=useMemo(()=>showNational&&country==='FR'?directoryCoverageMarkers(national.rows,national.coverage.data?.clusters,focusedId!==undefined&&focusedId<0?-focusedId:undefined,count=>`${count} ${a.professionals}`):[],[showNational,country,national.rows,national.coverage.data?.clusters,focusedId,a.professionals]);
  const markers=useMemo(()=>[...(showCrm?crmMarkers:[]),...(nationalDirectory?coverageMarkers:national.markers)],[showCrm,crmMarkers,nationalDirectory,coverageMarkers,national.markers]);
  const nationalById=useMemo(()=>new Map(national.rows.map(row=>[-row.id,row])),[national.rows]);
  const previewChanged=useCallback((next:BaitlyCrmMapPreview|null)=>setPreview(next),[]);
  const closeMatching=()=>{setPreview(null);setMatching(false);setMatchingBusy(false);};
  const mapMarkers=useMemo(()=>matchingActive&&preview?[...markers.filter(marker=>marker.id!==preview.contact.id),{id:preview.contact.id,name:preview.contact.name,lat:preview.point.latitude,lng:preview.point.longitude,type:`crm_${contactKind(preview.contact)}` as PropertyMarker['type'],subtitle:m.locationPreview}]:markers,[markers,matchingActive,preview,m.locationPreview]);
  const previewCamera=useMemo(()=>matchingActive&&preview?{center:[preview.point.longitude,preview.point.latitude] as [number,number],zoom:15,bearing:0,pitch:0}:undefined,[matchingActive,preview]);
  const listKey=`${onlyMissing}:${list.map(contact=>contact.id).join(',')}`;
  const focused=focusedId!==undefined?byId.get(focusedId):undefined;
  const open=(id:number)=>{
    if(id<0){setFocusedId(id);setLocate(previous=>({id,request:(previous?.request??0)+1}));return;}
    // Le moteur sort d'abord le repère de son groupe avant d'ouvrir sa bulle.
    if(positions.has(id))setLocate(previous=>({id,request:(previous?.request??0)+1}));
    else setFocusedId(id);
  };
  const publicFilters=<><label className="bcrm-toolbar-filter"><span>{a.city}</span><Input aria-label={a.city} placeholder={a.city} maxLength={120} value={national.city} onChange={e=>national.setCity(e.target.value)}/></label><label className="bcrm-toolbar-filter"><span>{a.service}</span><select aria-label={a.service} title={a.activityHint} value={national.service} onChange={e=>national.setService(e.target.value as DirectoryService|'')}><option value="">{a.allServices}</option>{baitlyDirectoryServices.map(code=><option key={code} value={code}>{a[code]}</option>)}</select></label><BaitlyDirectoryContactFilter language={currentLanguage??'fr'} value={national.contacts} onChange={value=>{national.setContacts(value);selection.clear();setFocusedId(undefined);}}/>{publicFiltersActive&&<Button size="sm" variant="ghost" onClick={()=>{national.setCity('');national.setService('');national.setContacts('');setCountry('FR');selection.clear();setFocusedId(undefined);}} disabled={selection.request.isPending}>{a.clearFilters}</Button>}</>;
  return <section className="bcrm-geography baitly-map-stage relative flex min-h-0 flex-1 flex-col" aria-label={m.map}>
    {sortHeader}
    {directoryOnly&&headerFilters&&<PageHeaderFilterControls><div className="bcrm-header-filters">{publicFilters}</div></PageHeaderFilterControls>}
    {onExit&&org!==undefined&&(locations.isError||locations.isPending)&&<Button size="sm" variant="ghost" onClick={onExit}>{exitLabel??m.back}</Button>}
    {org!==undefined&&locations.isError&&!nationalDirectory?<div role="alert" className="bcrm-inline-empty"><p>{m.locationError}</p><Button variant="outline" onClick={()=>locations.refetch()}>{m.locationRetry}</Button></div>:
      org!==undefined&&locations.isPending&&!nationalDirectory?<Skeleton className="min-h-48 w-full flex-1" />:<MapCardCoordinator><MapWithSheet
        desktopLayout="split"
        listInteraction={matchingActive?'form':'browse'}
        className="bcrm-map-surface"
        listWidth={matchingActive?'clamp(310px, 32vw, 420px)':'clamp(280px, 25vw, 360px)'}
        sheetClassName="bcrm-geography bcrm-theme bcrm-map-sheet"
        listTitle={matchingActive?m.matchContacts:directoryOnly?<BaitlyDirectoryCountry value={country} onChange={value=>{if(selection.request.isPending)return;selection.clear();selection.setMode(false);setCountry(value);setFocusedId(undefined);}} language={currentLanguage??'fr'}/>:nationalDirectory?a.mapDirectoryTitle:`${list.length} ${m.contacts}`}
        listResetKey={matchingActive?'matching':listKey+national.resetKey}
        listIndicators={<>{!headerFilters&&sortControl}{onExit&&<button type="button" disabled={matchingBusy} className="bcrm-text-button text-xs" onClick={onExit}>{exitLabel??m.back}</button>}{matchingActive?<button type="button" disabled={matchingBusy} className="bcrm-text-button text-xs" onClick={closeMatching}>{m.matchClose}</button>:org!==undefined&&!directoryOnly?<button type="button" className="bcrm-text-button text-xs" aria-pressed={onlyMissing} onClick={()=>setOnlyMissing(value=>!value)}>{onlyMissing?m.allLocations:m.onlyUnlocated}</button>:null}</>}
        map={<div className="bcrm-map-canvas relative size-full min-h-0">
          <BaitlyMapCanvas properties={mapMarkers} camera={previewCamera} center={nationalDirectory?(country==='MA'?[-7,31.5]:country==='SA'?[45,24]:[2.5,46.5]):undefined}  zoom={nationalDirectory?5:undefined} focusBounds={national.focusBounds} onBoundsChange={nationalDirectory?national.onBoundsChange:undefined} onCoverageBoundsChange={nationalDirectory?national.onCoverageBoundsChange:undefined} resetCameraKey={nationalDirectory?['FR','MA','SA'].indexOf(country):automatic.enrich.isSuccess?automatic.enrich.submittedAt:undefined} colorMode={isDark?'dark':'light'} height="100%" selectedPropertyId={matchingActive?preview?.contact.id:focusedId} highlightedPropertyId={focusedId} highlightedPropertyIds={selectedMarkerIds} locateProperty={matchingActive?null:locate}
            mapInfo={directoryOnly?undefined:<div className="bcrm-map-legend"><span><Home size={15} aria-hidden/><span>{m.owner}</span></span><span><KeyRound size={15} aria-hidden/><span>{m.concierge}</span></span><span><Wrench size={15} aria-hidden/><span>{m.provider}</span></span></div>}
            mapTools={<>{(filtersSlot||nationalDirectory)&&!(directoryOnly&&headerFilters)&&!matchingActive&&<MapFilterTool label={t('mapPilot.filters','Filtres de la carte')} active={filtersActive||!!national.city||!!national.service||!!national.contacts||!showNational||!showCrm} contentClassName="bcrm-theme bcrm-map-filter-content">
              {nationalDirectory&&<>{!directoryOnly&&<label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={showNational} onChange={e=>setShowNational(e.target.checked)}/>{a.nationalDirectory}</label>}{publicFilters}</>}
              {nationalDirectory&&org!==undefined&&<label className="flex cursor-pointer items-center gap-2 border-t border-border pt-3"><input type="checkbox" checked={showCrm} onChange={e=>setShowCrm(e.target.checked)}/>{a.crmContacts}</label>}{filtersSlot}
            </MapFilterTool>}{selection.canImport&&showNational&&!matchingActive&&<Tooltip><TooltipTrigger asChild><button type="button" className="baitly-map-tool" aria-label={a.selectOnMap} aria-pressed={selection.mode} disabled={selection.request.isPending} onClick={()=>selection.setMode(value=>!value)}><ListChecks size={18} aria-hidden/></button></TooltipTrigger><TooltipContent>{a.selectOnMap}</TooltipContent></Tooltip>}{canManage&&showCrm&&<Tooltip><TooltipTrigger asChild><button type="button" className="baitly-map-tool bcrm-map-match-tool" aria-label={`${m.matchContacts} (${missing.length})`} aria-busy={automatic.enrich.isPending} disabled={matchingBusy||automatic.enrich.isPending||!missing.length} onClick={()=>{closeMatching();setFocusedId(undefined);automatic.enrich.mutate();}}><MapPin size={17} aria-hidden/><small className="tabular-nums">{missing.length}</small></button></TooltipTrigger><TooltipContent side="bottom" sideOffset={8}>{automatic.enrich.isPending?a.enriching:`${m.matchContacts} : ${missing.length} ${m.unlocated}`}</TooltipContent></Tooltip>}</>}
            onMarkerClick={marker=>{if(!matchingActive&&marker.id!==undefined){if(selection.mode&&marker.id<0)selection.toggle(-marker.id);setFocusedId(focusRef.current===marker.id?undefined:marker.id);}}}
            onMarkerClose={marker=>setFocusedId(previous=>previous===marker.id?undefined:previous)} renderPopup={matchingActive?undefined:marker=>{
              const reference=marker.id!==undefined?nationalById.get(marker.id):undefined;
              if(reference)return <BaitlyProfessionalMapCard row={reference} language={currentLanguage??'fr'} selection={selectionFor(reference.id)}/>;
              const contact=marker.id!==undefined?byId.get(marker.id):undefined;const location=marker.id!==undefined?positions.get(marker.id):undefined;
              return contact?<BaitlyCrmMapContact contact={contact} location={location} onOpen={onOpen?()=>onOpen(contact.id):undefined}/>:null;
            }} />
          {nationalDirectory&&showNational&&country==='FR'&&(national.coverage.isFetching||national.result.isFetching&&!national.result.isFetchingNextPage||national.listResult.isFetching&&!national.listResult.isFetchingNextPage)&&!matchingActive&&<MapLoadingIndicator overlay label={national.coverage.data?a.refreshingProfessionals:a.loadingProfessionals}/>}
          {nationalDirectory&&showNational&&country==='FR'&&national.coverage.isError&&<div className="bcrm-map-progress" role="alert">{a.error}<Button size="sm" variant="ghost" onClick={()=>national.coverage.refetch()}>{a.retry}</Button></div>}
          {(automatic.enrich.isPending||automatic.enrich.isSuccess||automatic.enrich.isError)&&<div className="bcrm-map-progress">
            <div role={automatic.enrich.isError&&automatic.enrich.error.name!=='AbortError'?'alert':'status'}>
              <strong>{automatic.enrich.isError?(automatic.enrich.error.name==='AbortError'?a.enrichmentStopped:a.error):automatic.enrich.isPending?a.enriching:automatic.enrich.data?.cancelled?a.enrichmentStopped:automatic.enrich.data?.total===0?a.noImportedToEnrich:m.matchContacts}</strong>
              {automatic.summary&&<p className="tabular-nums">{automatic.summary.confirmed} {a.autoLocated} · {automatic.summary.review} {a.manualReview} · {automatic.summary.pending} {a.enrichmentPending}</p>}
              {automatic.enrich.isPending&&<progress aria-label={a.enriching} {...(automatic.summary?{max:Math.max(1,automatic.summary.confirmed+automatic.summary.review+automatic.summary.pending),value:automatic.summary.confirmed+automatic.summary.review}:{})}/>}
            </div>
            {automatic.enrich.isPending?<Button size="sm" variant="ghost" onClick={automatic.cancel}>{a.cancelCapture}</Button>:missing.length>0&&<Button size="sm" variant="outline" onClick={()=>setMatching(true)}>{a.reviewImported}</Button>}
          </div>}
          {!markers.length&&!preview&&!automatic.enrich.isPending&&!automatic.enrich.isSuccess&&!automatic.enrich.isError&&!national.result.isFetching&&!national.result.isError&&(!nationalDirectory||country!=='FR'||!national.coverage.isPending&&!national.coverage.isError)&&(!national.synchronization.isPending||country!=='FR')&&<div className="bcrm-map-empty" role="status"><MapPin size={20} aria-hidden/><div><strong>{nationalDirectory?a.mapDirectoryEmpty:m.mapEmpty}</strong><p>{country!=='FR'?a.countryEmpty:nationalDirectory?a.mapDirectoryHelp:m.mapEmptyHelp}</p></div></div>}
        </div>}>
        {matchingActive&&org!==undefined?<BaitlyCrmMapMatching contacts={missing} org={org} mode={matchingMode} onPreview={previewChanged} onBusyChange={setMatchingBusy} onClose={closeMatching}/>:<div className="bcrm-map-list">
          {(nationalDirectory&&showNational||selection.canImport&&selection.selected.size>0)&&<div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs">
            {selection.canImport&&(selection.selected.size>0||showNational&&national.rows.length>0)&&<div className="flex shrink-0 items-center gap-2" aria-label={a.importSelection}>
            <label className="flex cursor-pointer items-center gap-1.5" title={a.selectLoaded}><input type="checkbox" aria-label={a.selectLoaded} checked={!!selectableRows.length&&selectableRows.every(row=>selection.selected.has(row.id))} disabled={selection.request.isPending||!selectableRows.length} onChange={()=>selection.toggleLoaded(selectableRows.map(row=>row.id))}/><span className="sr-only">{a.mapSelectAll}</span></label>
            <Button size="sm" disabled={!selection.selected.size||selection.request.isPending} aria-label={`${a.importCrm} (${selection.selected.size})`} title={a.importCrm} aria-busy={selection.request.isPending} onClick={selection.submit}>{selection.request.isPending?a.importing:`${a.mapImportAction} (${selection.selected.size})`}</Button>
            {!!selection.selected.size&&<Button size="icon-sm" variant="ghost" aria-label={a.clearSelection} title={a.clearSelection} disabled={selection.request.isPending} onClick={selection.clear}><X size={15} aria-hidden/></Button>}
            </div>}
            {nationalDirectory&&showNational&&<h3 className="ms-auto whitespace-nowrap text-xs font-medium">{a.professionals} {!(national.result.isFetching&&!national.rows.length)&&<span className="tabular-nums text-muted-foreground">{national.rows.length}{national.result.hasNextPage?' +':''}</span>}</h3>}
          </div>}
          {selection.canImport&&selection.request.isError&&<p role="alert" className="p-3 text-xs text-destructive">{a.importError}</p>}
          {selection.canImport&&selection.request.data&&<div role="status" className="border-b border-border p-3 text-xs tabular-nums"><p>{selection.request.data.filter(r=>r.status==='CREATED').length} {a.mapImported} · {selection.request.data.filter(r=>r.status==='EXISTING').length} {a.mapExisting} · {selection.request.data.filter(r=>r.status==='REVIEW'||r.status==='REMOVED').length} {a.manualReview}</p>{selection.request.data.some(r=>r.status==='REVIEW'||r.status==='REMOVED')&&<details className="mt-2"><summary className="cursor-pointer">{a.importReport}</summary>{selection.request.data.filter(r=>r.status==='REVIEW'||r.status==='REMOVED').map(r=><p key={r.siret} className="mt-1">{r.name} : {a[r.status]}</p>)}</details>}</div>}
          {nationalDirectory&&showNational&&<section aria-label={a.nationalDirectory} aria-busy={country==='FR'&&national.listResult.isFetching}>{country==='FR'&&national.listResult.isFetching&&!national.rows.length&&<MapListSkeleton/>}{country==='FR'&&national.listResult.isError&&<p role="alert" className="p-3 text-xs">{a.error} <Button size="sm" variant="ghost" onClick={()=>national.listResult.refetch()}>{a.retry}</Button></p>}<MapProgressiveList items={national.listRows} activeIndex={national.listRows.findIndex(row=>focusedId===-row.id)} resetKey={national.resetKey} renderItem={row=><BaitlyProfessionalMapCard key={row.id} row={row} language={currentLanguage??'fr'} onLocate={()=>open(-row.id)} selected={focusedId===-row.id} selection={selectionFor(row.id)}/>}/><MapLoadMore hasMore={country==='FR'&&!!national.listResult.hasNextPage&&(!national.listResult.isFetching||national.listResult.isFetchingNextPage)} busy={national.listResult.isFetchingNextPage} onMore={()=>void national.listResult.fetchNextPage()} label={a.more} loadingLabel={a.loadingMoreProfessionals}/></section>}
          {org!==undefined&&locations.isError&&nationalDirectory&&<p role="alert" className="p-3 text-xs">{m.locationError} <Button size="sm" variant="ghost" onClick={()=>locations.refetch()}>{m.locationRetry}</Button></p>}
          {showCrm&&org!==undefined&&<div className="bcrm-map-count tabular-nums">{nationalDirectory&&`${a.crmContacts} · `}{crmMarkers.length} {m.located} · {contacts.length-crmMarkers.length} {m.unlocated}</div>}
          {focused&&!positions.has(focused.id)&&<div className="bcrm-map-unlocated-preview"><BaitlyCrmMapContact contact={focused} onOpen={onOpen?()=>onOpen(focused.id):undefined}/></div>}
          <div className="bcrm-map-list__rows"><MapProgressiveList items={list} activeIndex={list.findIndex(contact=>focusedId===contact.id)} resetKey={listKey} renderItem={contact=><div key={contact.id}><BaitlyCrmContactCard contact={contact} compact locationLabel={positions.get(contact.id)?.label||(contact.city?`${contact.city} · ${m.onlyUnlocated}`:m.onlyUnlocated)} selected={focused?.id===contact.id} onOpen={()=>open(contact.id)} /></div>}/></div>
        </div>}
      </MapWithSheet></MapCardCoordinator>}
  </section>;
}

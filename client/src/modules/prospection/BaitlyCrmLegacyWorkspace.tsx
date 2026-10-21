import {NationalProspectionMap} from './ProspectionPage';
import {lazy,Suspense,useDeferredValue,useEffect,useMemo,useRef,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {Alert,AlertDescription,Button,Skeleton} from '../../components/ui';
import {Plus,Upload,Map as MapIcon,MapPin,Inbox,Send,Users,FileText,LayoutDashboard,RefreshCw,Search,Table} from '../../icons/glyphs';
import {useTranslation} from '../../hooks/useTranslation';
import {useUserPreference} from '../../hooks/useUserPreference';
import {useAuth} from '../../hooks/useAuth';
import {useThemeMode} from '../../hooks/useThemeMode';
import {prospectsApi} from '../../services/api/prospectsApi';
import {baitlyCrmDetailsApi} from '../../services/api/baitlyCrmDetailsApi';
import {prospectionMessages} from '../../i18n/baitlyProspectionMessages';
import {professionalDirectoryMessages} from '../../i18n/baitlyProfessionalDirectoryMessages';
import {BAITLY_CRM_STATUSES,baitlyCrmError} from './BaitlyCrmFields';
import {filterCrmContacts,type BaitlyCrmKind} from './baitlyCrmWorkspace';
import BaitlyCrmIconAction from "./BaitlyCrmIconAction";
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import {PageHeaderActionsProvider,usePageHeaderActionsSlot,usePageHeaderFiltersSlot} from '../../components/PageHeaderActionsContext';
import {useScreenSearch} from '../../components/ScreenChrome';
import {loadBaitlyContactMap} from './baitlyProspectionChunks';
import {releaseBaitlyProspectionStartup} from '../../services/baitlyProspectionTiming';
import './baitly-prospection.css';
import './baitly-crm-workflows.css';

const BaitlyCrmBoard=lazy(()=>import('./BaitlyCrmBoard'));
const BaitlyCrmNationalTable=lazy(()=>import('./BaitlyCrmNationalTable'));
const BaitlyCrmTable=lazy(()=>import('./BaitlyCrmTable'));
const BaitlyCrmContactEditor=lazy(()=>import('./BaitlyCrmContactEditor'));
const BaitlyCrmContactDetail=lazy(()=>import('./BaitlyCrmContactDetail'));
const BaitlyCrmReviewResume=lazy(()=>import('./BaitlyCrmReviewResume'));
const BaitlyCrmEnrichImported=lazy(()=>import('./BaitlyCrmEnrichImported'));
const ProspectImportModal=lazy(()=>import('./ProspectImportModal'));
const ContactMap=lazy(loadBaitlyContactMap);
const Campaigns=lazy(()=>import('./BaitlyCrmCampaigns'));
const Inquiries=lazy(()=>import('./BaitlyCrmInquiries'));
const PublicPage=lazy(()=>import('./BaitlyCrmPublicPage'));
const Recruitment=lazy(()=>import('./BaitlyCrmRecruitment'));
const Insights=lazy(()=>import('./BaitlyCrmInsights'));
const BulkLocations=lazy(()=>import('./BaitlyCrmBulkLocations'));
const ImportedLocations=lazy(()=>import('./BaitlyCrmImportedLocations'));
const ProfessionalDiscovery=lazy(()=>import('../marketplace/BaitlyProfessionalDiscovery'));
const TAB_KEYS=['contacts','map','campaigns','inquiries','acquisition','analysis'] as const;
type Tab=typeof TAB_KEYS[number];

export function BaitlyCrmWorkspace({directoryMode=false,initialTab}:{directoryMode?:boolean;initialTab?:string}){
  const {slot,portalContainer}=usePageHeaderActionsSlot();
  const {filtersSlot,filtersContainer}=usePageHeaderFiltersSlot();
  const {t,currentLanguage}=useTranslation();const m=prospectionMessages(currentLanguage);const {user}=useAuth();const {isDark}=useThemeMode();
  const platformStaff=user?.roles?.some(role=>role==='SUPER_ADMIN'||role==='SUPER_MANAGER')??false;
  const [params,setParams]=useSearchParams();const [search,setSearch]=useState('');const query=useDeferredValue(search);
  const [preferences,setPreferences]=useUserPreference<{kind:BaitlyCrmKind;status:string;view:'crm'|'map';layout?:'table'|'board'}>('baitly.crm.workspace',{kind:'all',status:'all',view:'crm',layout:'table'});
  const [source,setSource]=useUserPreference<"directory"|"followed">("baitly.crm.source","directory");
  const hasCrm=platformStaff||!!user?.permissions.includes("baitly-crm:view");
  const nationalTable=directoryMode&&(!hasCrm||source==="directory");
  const rawTab=params.get('tab')??initialTab;const tab:Tab=TAB_KEYS.includes(rawTab as Tab)&&(!directoryMode||hasCrm||rawTab==="contacts"||rawTab==="map")?rawTab as Tab:preferences.view==='map'?'map':'contacts';
  const [acquisition,setAcquisition]=useState('recruitment');const [panel,setPanel]=useState<'create'|'import'|'professionals'|'review'|number|null>(null);const panelRef=useRef<HTMLElement>(null);
  const [bulkOpen,setBulkOpen]=useState(false);
  const [directoryFiltersActive,setDirectoryFiltersActive]=useState(false);
  const access=useQuery({queryKey:['prospects',user?.id,user?.organizationId,'access'],queryFn:prospectsApi.access,enabled:hasCrm});
  const contactSurface=['contacts','map','analysis'].includes(tab);
  const contacts=useQuery({queryKey:['prospects',user?.id,user?.organizationId,'workspace'],queryFn:prospectsApi.getAll,enabled:access.isSuccess&&contactSurface&&!(nationalTable&&tab==='contacts')&&!(directoryMode&&tab==='map'),staleTime:60_000});
  const details=useQuery({queryKey:['prospects',user?.organizationId,'details'],queryFn:baitlyCrmDetailsApi.list,enabled:access.isSuccess&&contactSurface&&!(nationalTable&&tab==='contacts')&&!(directoryMode&&tab==='map'),staleTime:30_000});
  const enriched=useMemo(()=>{const byId=new Map((details.data??[]).map(detail=>[detail.prospect_id,detail]));return (contacts.data??[]).map(contact=>({...contact,crm:byId.get(contact.id)}));},[contacts.data,details.data]);
  const filtered=useMemo(()=>filterCrmContacts(enriched,query,preferences.kind,preferences.status),[enriched,query,preferences.kind,preferences.status]);
  const permissions=access.data;
  const directoryVisible=directoryMode&&tab==="contacts"&&(nationalTable||access.isError)&&panel===null;
  const directoryMessages=professionalDirectoryMessages(currentLanguage??"fr");
  const canManageCommercial=!!permissions?.canManage||platformStaff;
  useEffect(()=>{
    if(directoryMode&&tab!=='map'&&((directoryVisible)||(access.isSuccess||access.isError)))return releaseBaitlyProspectionStartup();
  },[directoryMode,tab,directoryVisible,access.isSuccess,access.isError]);
  useEffect(()=>{if(panel!==null){panelRef.current?.focus({preventScroll:true});panelRef.current?.scrollIntoView({block:'start'});}},[panel]);
  function navigate(next:Tab){setParams(previous=>{const result=new URLSearchParams(previous);result.set('tab',next);return result;});setPanel(null);setBulkOpen(false);if(next==='contacts'||next==='map')setPreferences({...preferences,view:next==='map'?'map':'crm'});}
  function openContact(id:number){if(tab!=='contacts'&&tab!=='map')navigate('contacts');setPanel(id);}
  const tabs=[{key:'contacts',label:m.crm,icon:Users},{key:'map',label:m.map,icon:MapIcon},{key:'campaigns',label:m.campaigns,icon:Send},{key:'inquiries',label:m.inquiries,icon:Inbox},{key:'acquisition',label:m.forms,icon:FileText},{key:'analysis',label:m.analysis,icon:LayoutDashboard}] as const;
  const contactFilters=<><label className="bcrm-toolbar-filter"><span>{t('baitlyCrm.type')}</span><select aria-label={t('baitlyCrm.type')} value={preferences.kind} onChange={event=>setPreferences({...preferences,kind:event.target.value as BaitlyCrmKind})}>{(['all','owner','concierge','provider'] as const).map(kind=><option key={kind} value={kind}>{m[kind]}</option>)}</select></label><label className="bcrm-toolbar-filter"><span>{m.stage}</span><select aria-label={m.stage} value={preferences.status} onChange={event=>setPreferences({...preferences,status:event.target.value})}><option value="all">{t('baitlyCrm.values.all')}</option>{BAITLY_CRM_STATUSES.map(status=><option key={status} value={status}>{t('baitlyCrm.values.'+status)}</option>)}</select></label></>;
  const viewActions=<div className="bcrm-header-views" role="group" aria-label={m.views}><BaitlyCrmIconAction action="table" label={m.table} icon={<Table size={16}/>} aria-pressed={(nationalTable||preferences.layout!=="board")} onClick={()=>setPreferences({...preferences,layout:"table"})}/><BaitlyCrmIconAction action="pipeline" label={m.pipeline} icon={<LayoutDashboard size={16}/>} aria-pressed={(!nationalTable&&preferences.layout==="board")} onClick={()=>{setSource("followed");setPreferences({...preferences,layout:"board"});}}/></div>;
  if(!directoryMode&&access.isError&&(access.error as {status?:number}).status===403)return <NationalProspectionMap/>;
  return <PageHeaderActionsProvider slot={slot} filtersSlot={filtersSlot}><div className={`bcrm-page bcrm-theme${tab==='map'&&panel===null?' baitly-map-page':''}`} data-map={tab==='map'&&panel===null} data-mode={isDark?'dark':'light'}>
    <PageHeader filtersActive={directoryFiltersActive} filters={directoryMode&&tab==="map"&&panel===null?filtersContainer:(permissions||directoryVisible)&&contactSurface&&tab!=="map"&&panel===null&&!bulkOpen?<div className="bcrm-header-filters">{directoryMode&&tab==="contacts"&&<label className="bcrm-toolbar-filter"><span>{directoryMessages.sources}</span><select aria-label={directoryMessages.sources} value={source} onChange={event=>{setSource(event.target.value as "directory"|"followed");setPreferences({...preferences,layout:"table"});}}><option value="directory">{directoryMessages.directory}</option>{permissions&&<option value="followed">{directoryMessages.myProspecting}</option>}</select></label>}{!directoryVisible&&contactFilters}{tab==="contacts"&&(directoryVisible||preferences.layout!=="board")&&filtersContainer}</div>:undefined} title={t('directoryPage.tabs.prospection')} iconBadge={<Users size={17}/>} onBack={panel!==null||bulkOpen?()=>{setPanel(null);setBulkOpen(false);}:undefined} backLabel={m.back} actions={<>
      {!directoryMode&&permissions?.canManage&&contactSurface&&panel===null&&!bulkOpen&&<Suspense fallback={null}><BaitlyCrmReviewResume org={permissions.organizationId} onOpen={()=>setPanel('review')}/></Suspense>}
      {!directoryMode&&permissions?.canManage&&tab==='contacts'&&panel===null&&!bulkOpen&&<BaitlyCrmIconAction action="locate" label={m.bulkLocate} icon={<MapPin size={16}/>} disabled={contacts.isPending||contacts.isError} onClick={()=>setBulkOpen(true)}/>}
      {!directoryMode&&permissions?.canManage&&contactSurface&&tab!=='analysis'&&panel===null&&!bulkOpen&&<><BaitlyCrmIconAction action="search" label={professionalDirectoryMessages(currentLanguage??'fr').findProfessionals} icon={<Search size={16}/>} onClick={()=>setPanel('professionals')}/><BaitlyCrmIconAction action="import" label={t('baitlyCrm.import')} icon={<Upload size={16}/>} onClick={()=>setPanel('import')}/><BaitlyCrmIconAction action="create" label={t('baitlyCrm.create')} icon={<Plus size={16}/>} onClick={()=>setPanel('create')}/></>}
      {tab==='analysis'&&<BaitlyCrmIconAction action="refresh" label={t('common.refresh','Actualiser')} icon={<RefreshCw size={16}/>} disabled={contacts.isFetching||details.isFetching} onClick={()=>{void contacts.refetch();void details.refetch();}}/>}
      {permissions&&tab==="contacts"&&panel===null&&!bulkOpen&&viewActions}
      {portalContainer}
    </>}/>
    <PageTabs options={tabs.filter(item=>!directoryMode||hasCrm||item.key==="contacts"||item.key==="map").map(({key,label,icon:Icon})=>({value:key,label,icon:<Icon size={16}/>}))} value={tab} onChange={navigate} ariaLabel={t('directoryPage.tabs.prospection')} size="compact"/>
    {contactSurface&&panel===null&&!bulkOpen&&<ContactSearch value={search} onChange={setSearch} placeholder={m.search}/>}
    <div className="bcrm-workspace" data-map={tab==='map'&&panel===null} data-mode={isDark?'dark':'light'} data-record={panel!==null}>
    {access.isError&&tab!=='map'&&!directoryVisible&&<Alert variant="destructive"><AlertDescription>{baitlyCrmError(access.error,t('baitlyCrm.accessDenied'))}</AlertDescription></Alert>}
    {access.isError&&tab==='map'&&!directoryMode&&<Suspense fallback={<Skeleton className="h-96 w-full"/>}><ContactMap contacts={[]} nationalDirectory onFiltersActiveChange={setDirectoryFiltersActive} search={query}/></Suspense>}
    {access.isPending&&!directoryVisible&&tab!=='map'&&<Skeleton className="h-64 w-full" />}
    {directoryVisible&&<Suspense fallback={<Skeleton className="h-96 w-full"/>}><BaitlyCrmNationalTable onFiltersActiveChange={setDirectoryFiltersActive} key={permissions?.organizationId??"shared"} search={query} canManage={!!permissions?.canManage} organizationId={permissions?.organizationId} onImported={()=>{setSource("followed");setPreferences({...preferences,layout:"table"});}}/></Suspense>}
    {directoryMode&&tab==='map'&&<Suspense fallback={<Skeleton className="h-96 w-full"/>}><ContactMap contacts={[]} publicOnly org={permissions?.organizationId} canManage={!!permissions?.canManage} nationalDirectory onFiltersActiveChange={setDirectoryFiltersActive} search={query}/></Suspense>}
    {permissions&&!directoryVisible&&!(directoryMode&&tab==='map')&&<>
      {!directoryMode&&permissions.canManage&&tab==='contacts'&&panel===null&&!bulkOpen&&<Suspense fallback={null}><BaitlyCrmEnrichImported key={permissions.organizationId} onReview={()=>setPanel('review')}/></Suspense>}

      {contactSurface&&details.isError&&<Alert variant="destructive"><AlertDescription>{m.detailsError}</AlertDescription><Button variant="outline" onClick={()=>details.refetch()}>{t('baitlyCrm.retry')}</Button></Alert>}
      <div className="bcrm-content" data-panel={panel!==null}>
        {panel!==null&&<aside ref={panelRef} tabIndex={-1} className="bcrm-record" aria-label={t('baitlyCrm.contactRecord')}>
          <Suspense fallback={<Skeleton className="h-72 w-full"/>}>
          {panel==='create'&&permissions.canManage&&<BaitlyCrmContactEditor onDone={id=>setPanel(id??null)} />}
          {panel==='import'&&permissions.canManage&&<ProspectImportModal open onClose={()=>setPanel(null)} />}
          {panel==='review'&&permissions.canManage&&<Suspense fallback={<Skeleton className="h-96 w-full"/>}><ImportedLocations results={[]} org={permissions.organizationId} onClose={()=>setPanel(null)} onContact={openContact}/></Suspense>}
          {panel==='professionals'&&permissions.canManage&&<Suspense fallback={<Skeleton className="h-72 w-full"/>}><ProfessionalDiscovery key={permissions.organizationId} language={currentLanguage??'fr'} target="crm" organizationId={permissions.organizationId} onContact={openContact}/></Suspense>}
          {typeof panel==='number'&&<BaitlyCrmContactDetail key={panel} id={panel} org={permissions.organizationId} canManage={!directoryMode&&permissions.canManage} canFollowUp={permissions.canManage} canAuthorize={permissions.canAuthorize} onClose={()=>setPanel(null)} />}
          </Suspense>
        </aside>}
        <div className="bcrm-main"><Suspense fallback={<Skeleton className="h-72 w-full" />}>
          {contactSurface&&(tab==='map'?<ContactMap onFiltersActiveChange={setDirectoryFiltersActive} key={permissions.organizationId} publicOnly={directoryMode} contacts={directoryMode?[]:filtered} org={permissions.organizationId} canManage={permissions.canManage} onOpen={openContact} filtersSlot={directoryMode?undefined:contactFilters} filtersActive={preferences.kind!=='all'||preferences.status!=='all'} nationalDirectory search={query}/>:
            contacts.isPending?<Skeleton className="h-96 w-full" />:contacts.isError?<Alert variant="destructive"><AlertDescription>{t('baitlyCrm.loadError')}</AlertDescription><Button variant="outline" onClick={()=>contacts.refetch()}>{t('baitlyCrm.retry')}</Button></Alert>:
            tab==='contacts'&&bulkOpen&&permissions.canManage?<BulkLocations org={permissions.organizationId}/>:
            tab==='analysis'?<Insights contacts={filtered} />:
            preferences.layout==='board'?<BaitlyCrmBoard canManage={permissions.canManage} contacts={filtered} status={preferences.status} selected={typeof panel==='number'?panel:undefined} onOpen={openContact} />:
            <BaitlyCrmTable allowFactEditing={!directoryMode} contacts={filtered} org={permissions.organizationId} status={preferences.status} selected={typeof panel==='number'?panel:undefined} canManage={permissions.canManage} onOpen={openContact} />)}
          {tab==='campaigns'&&<div className="bcrm-workflow"><Campaigns org={permissions.organizationId} canManage={canManageCommercial} canSend={platformStaff||!!permissions.canSendCampaigns} onContact={openContact} /></div>}
          {tab==='inquiries'&&<div className="bcrm-workflow"><Inquiries org={permissions.organizationId} canManage={permissions.canManage} onContact={openContact} /></div>}
          {tab==='acquisition'&&<div className="bcrm-workflow"><div className="bcrm-form-tabs"><button type="button" aria-pressed={acquisition==='recruitment'} onClick={()=>setAcquisition('recruitment')}>{m.recruitment}</button><button type="button" aria-pressed={acquisition==='public'} onClick={()=>setAcquisition('public')}>{m.publicPage}</button></div><div className="bcrm-acquisition-layout"><section>{acquisition==='recruitment'?<Recruitment org={permissions.organizationId} canManage={canManageCommercial} />:<PublicPage org={permissions.organizationId} canManage={canManageCommercial} />}</section></div></div>}
        </Suspense></div>
      </div>
    </>}
    </div>
  </div></PageHeaderActionsProvider>;
}
function ContactSearch({value,onChange,placeholder}:{value:string;onChange:(value:string)=>void;placeholder:string}){useScreenSearch(value,onChange,placeholder);return null;}

import {lazy,Suspense,useState} from 'react';
import {Skeleton} from '../../components/ui';
import {Map as MapIcon,Users} from '../../icons/glyphs';
import {useTranslation} from '../../hooks/useTranslation';
import {useAuth} from '../../hooks/useAuth';
import {useThemeMode} from '../../hooks/useThemeMode';
import {prospectionMessages} from '../../i18n/baitlyProspectionMessages';
import {professionalDirectoryMessages} from '../../i18n/baitlyProfessionalDirectoryMessages';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import {PageHeaderActionsProvider,usePageHeaderActionsSlot,usePageHeaderFiltersSlot} from '../../components/PageHeaderActionsContext';
import {useScreenSearch} from '../../components/ScreenChrome';
import './baitly-prospection.css';
import './baitly-crm-workflows.css';

const CrmWorkspace=lazy(()=>import("./BaitlyCrmLegacyWorkspace").then(module=>({default:module.BaitlyCrmWorkspace})));
const ContactMap=lazy(()=>import('./BaitlyCrmMap'));
function ContactSearch({value,onChange,placeholder}:{value:string;onChange:(value:string)=>void;placeholder:string}){useScreenSearch(value,onChange,placeholder);return null;}
/** Shared professional directory: the same read-only experience for every authenticated user. */
export function NationalProspectionMap(){
 const {slot,portalContainer}=usePageHeaderActionsSlot();const {filtersSlot,filtersContainer}=usePageHeaderFiltersSlot();const {t,currentLanguage}=useTranslation();const m=prospectionMessages(currentLanguage);const {isDark}=useThemeMode();
 const [search,setSearch]=useState('');const [filtersActive,setFiltersActive]=useState(false);
 return <PageHeaderActionsProvider slot={slot} filtersSlot={filtersSlot}><div className="bcrm-page bcrm-theme baitly-map-page" data-map="true" data-mode={isDark?'dark':'light'}>
  <PageHeader filtersActive={filtersActive} title={t('directoryPage.tabs.prospection')} iconBadge={<Users size={17}/>} actions={portalContainer} filters={filtersContainer}/>
  <PageTabs options={[{value:'map',label:m.map,icon:<MapIcon size={16}/>}]} value="map" onChange={()=>{}} ariaLabel={t('directoryPage.tabs.prospection')} size="compact"/>
  <ContactSearch value={search} onChange={setSearch} placeholder={professionalDirectoryMessages(currentLanguage??'fr').search}/>
  <div className="bcrm-workspace" data-map="true"><Suspense fallback={<Skeleton className="h-96 w-full"/>}><ContactMap onFiltersActiveChange={setFiltersActive} contacts={[]} nationalDirectory search={search}/></Suspense></div>
 </div></PageHeaderActionsProvider>;
}
export default function ProspectionPage(){const {user}=useAuth();return <Suspense fallback={<Skeleton className="h-96 w-full"/>}><CrmWorkspace key={`${user?.id}:${user?.organizationId}`} directoryMode/></Suspense>;}

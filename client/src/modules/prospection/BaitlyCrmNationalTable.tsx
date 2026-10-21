import BaitlyDirectoryContactFilter from '../marketplace/BaitlyDirectoryContactFilter';
import type {DirectoryContactFilter} from '../../config/baitlyDirectoryContacts';
import {useDeferredValue,useEffect,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {professionalDirectoryApi as api,crmProfessionalImportsApi,type DirectoryService} from '../../services/api/baitlyProfessionalDirectoryApi';
import {useTranslation} from '../../hooks/useTranslation';
import {professionalDirectoryMessages} from '../../i18n/baitlyProfessionalDirectoryMessages';
import {usePageHeaderActions,usePageHeaderFilters} from '../../components/PageHeaderActionsContext';
import {Alert,AlertDescription,Button,Skeleton} from '../../components/ui';
import PagePagination from '../../components/PagePagination';
import BaitlyCrmEmptyState from './BaitlyCrmEmptyState';
import {prospectionGuidanceMessages} from '../../i18n/baitlyProspectionGuidanceMessages';
import {Users,Download,RefreshCw,X} from '../../icons/glyphs';
import {baitlyDirectoryServices} from '../../config/baitlyDirectoryServices';
import {type DirectoryCountry} from '../marketplace/BaitlyDirectoryCountry';
import BaitlyDirectoryCountries from '../marketplace/BaitlyDirectoryCountries';
import BaitlyDirectoryService from '../marketplace/BaitlyDirectoryService';
import BaitlyProfessionalMapCard from '../marketplace/BaitlyProfessionalMapCard';
import BaitlyCrmIconAction from './BaitlyCrmIconAction';
import './baitly-crm-national-table.css';

/** Browse the shared source without copying a national database into each tenant. */
export default function BaitlyCrmNationalTable({search,canManage,organizationId,onImported,onFiltersActiveChange,onExplore,onClearSearch}:{onFiltersActiveChange?:(active:boolean)=>void;search:string;canManage:boolean;organizationId?:number;onImported:()=>void;onExplore?:()=>void;onClearSearch?:()=>void}){
 const {currentLanguage}=useTranslation(),language=currentLanguage??'fr',m=professionalDirectoryMessages(language);
 const guidance=prospectionGuidanceMessages(language);
 const qc=useQueryClient();
 const [countries,setCountries]=useState<DirectoryCountry[]>(['FR']);
 const country=countries.join(',');
 const [service,setService]=useState<DirectoryService|''>('');
 const [contacts,setContacts]=useState<DirectoryContactFilter>('');
 const filtersActive=country!=='FR'||service!==''||contacts!=='';
 useEffect(()=>{onFiltersActiveChange?.(filtersActive);return()=>onFiltersActiveChange?.(false);},[filtersActive,onFiltersActiveChange]);
 const query=useDeferredValue(search.trim());
 // The existing endpoint returns 30 rows. Reuse that contract with ten rows per CRM page.
 const [paging,setPaging]=useState({key:'',page:0});
 const filterKey=JSON.stringify([query,service,country,contacts]);
 const page=paging.key===filterKey?paging.page:0;
 const [selection,setSelection]=useState<Set<number>>(()=>new Set());
 const [opened,setOpened]=useState<number|null>(null);
 const directory=useQuery({queryKey:['professional-directory','crm',query,service,country,contacts,Math.floor(page/3)],queryFn:()=>api.list(query,Math.floor(page/3),service,contacts,country),staleTime:30_000,refetchInterval:30_000});
 const rows=directory.data?.items.slice(page%3*10,page%3*10+10)??[];
 const active=rows.find(row=>row.id===opened);
 const importing=useMutation({mutationFn:()=>crmProfessionalImportsApi.importReferences([...selection]),onSuccess:async results=>{
   await qc.invalidateQueries({queryKey:['prospects']});
   setSelection(new Set());
 }});
 const imported=importing.data?.filter(result=>result.status==='CREATED'||result.status==='EXISTING').length??0;
 const filters=usePageHeaderFilters(<><BaitlyDirectoryCountries inline disabled={importing.isPending} value={countries} onChange={value=>{if(importing.isPending)return;importing.reset();setCountries(value);setSelection(new Set());setOpened(null);}} language={language}/><label className="bcrm-toolbar-filter"><span>{m.service}</span><select aria-label={m.service} value={service} onChange={event=>{setService(event.target.value as DirectoryService|'');setOpened(null);}}><option value="">{m.allServices}</option>{baitlyDirectoryServices.map(value=><option key={value} value={value}>{m[value]}</option>)}</select></label><BaitlyDirectoryContactFilter language={language} value={contacts} onChange={value=>{setContacts(value);setOpened(null);setSelection(new Set());}}/>{filtersActive&&<Button size="sm" variant="ghost" disabled={importing.isPending} onClick={()=>{setCountries(['FR']);setService('');setContacts('');setSelection(new Set());setOpened(null);importing.reset();}}>{m.clearFilters}</Button>}</>);
 const actions=usePageHeaderActions(<>
  <BaitlyCrmIconAction action="refresh" label={m.retry} icon={<RefreshCw size={16}/>} disabled={directory.isFetching} onClick={()=>void directory.refetch()}/>
  {canManage&&organizationId!==undefined&&<BaitlyCrmIconAction action="import" label={m.importSelection} icon={<Download size={16}/>} disabled={!selection.size||importing.isPending} onClick={()=>importing.mutate()}/>}
 </>);
 function toggle(id:number){setSelection(previous=>{const next=new Set(previous);if(next.has(id))next.delete(id);else if(next.size<100)next.add(id);return next;});}
 return <section className="bcrm-national" aria-label={m.nationalDirectory}>
  {filters}{actions}
  {importing.isError&&<Alert variant="destructive"><AlertDescription>{m.importError}</AlertDescription></Alert>}
  {importing.isSuccess&&<div role="status" className="bcrm-national-report"><span>{importing.data.filter(result=>result.status==='CREATED').length} {m.mapImported} · {importing.data.filter(result=>result.status==='EXISTING').length} {m.mapExisting}</span>{importing.data.filter(result=>result.status!=='CREATED'&&result.status!=='EXISTING').map((result,index)=><span key={`${result.siret}:${index}`}>{result.name} · {m[result.status]}</span>)}{imported>0&&<Button size="sm" variant="outline" onClick={onImported}>{m.crmContacts}</Button>}</div>}
  {!!selection.size&&<div className="bcrm-selection"><strong>{selection.size} {m.selected}</strong><button type="button" disabled={importing.isPending} onClick={()=>setSelection(new Set())}>{m.clearSelection}</button></div>}
  {directory.isError?<Alert variant="destructive"><AlertDescription>{m.error}</AlertDescription><Button variant="outline" onClick={()=>void directory.refetch()}>{m.retry}</Button></Alert>:directory.isPending?<Skeleton className="h-96 w-full"/>:!rows.length?<BaitlyCrmEmptyState icon={<Users/>} title={m.empty} description={m.emptyHelp}
    action={filtersActive||query?{label:guidance.reset,onClick:()=>{setCountries(['FR']);setService('');setContacts('');setSelection(new Set());setOpened(null);importing.reset();onClearSearch?.();}}:onExplore?{label:guidance.explore,onClick:onExplore}:undefined}/>:<>
   <div className="bcrm-table-scroll"><table><thead><tr>
    {canManage&&<th className="bcrm-check-cell"><input type="checkbox" aria-label={m.selectPage} checked={rows.every(row=>selection.has(row.id))} disabled={importing.isPending} onChange={event=>setSelection(previous=>{const next=new Set(previous);rows.forEach(row=>{if(!event.target.checked)next.delete(row.id);else if(next.size<100)next.add(row.id);});return next;})}/></th>}
    <th scope="col">{m.business}</th><th scope="col">{m.service}</th><th scope="col">{m.city}</th><th scope="col">{m.phone}</th><th scope="col">{m.email}</th><th scope="col">{m.website}</th>
   </tr></thead><tbody>{rows.map(row=><tr key={row.id} data-selected={opened===row.id}>
    {canManage&&<td className="bcrm-check-cell"><input type="checkbox" aria-label={`${m.selectProfessional} : ${row.name}`} checked={selection.has(row.id)} disabled={importing.isPending||selection.size>=100&&!selection.has(row.id)} onChange={()=>toggle(row.id)}/></td>}
    <td><button type="button" className="bcrm-national-name" onClick={()=>setOpened(row.id)}>{row.name}</button><span className="bcrm-national-address">{row.address}</span></td>
    <td><BaitlyDirectoryService activity={row.activity} service={row.service} language={language}/></td><td>{[row.postal_code,row.city].filter(Boolean).join(' ')}</td>
    <td>{row.phone||'·'}</td><td>{row.email||'·'}</td><td>{row.website||'·'}</td>
   </tr>)}</tbody></table></div>
   <PagePagination page={page} onPageChange={next=>{setPaging({key:filterKey,page:next});setOpened(null);}} count={directory.data?.total??0} rowsPerPage={10} hideOnSinglePage={false}/>
  </>}
  {active&&<aside className="bcrm-national-detail" aria-label={m.openContact}><button type="button" className="bcrm-national-close" onClick={()=>setOpened(null)} aria-label={m.close}><X size={16}/></button><BaitlyProfessionalMapCard row={active} language={language}/></aside>}
 </section>;
}

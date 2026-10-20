import BaitlyCrmAssigneeAvatar from './BaitlyCrmAssigneeAvatar';
import {useMemo,useRef,useState,type ReactNode} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Alert,AlertDescription,Popover,PopoverTrigger,PopoverContent} from '../../components/ui';
import {usePageHeaderFilters} from "../../components/PageHeaderActionsContext";
import PagePagination from '../../components/PagePagination';
import {ChevronDown,ArrowDownAZ,Download,Eye,Trash2,Check,ArrowUpRight,X} from '../../icons/glyphs';
import {useTranslation} from '../../hooks/useTranslation';
import {useUserPreference} from '../../hooks/useUserPreference';
import {prospectsApi,type BaitlyCrmContactWrite} from '../../services/api/prospectsApi';
import {prospectionMessages} from '../../i18n/baitlyProspectionMessages';
import {baitlyCrmDetailsApi} from '../../services/api/baitlyCrmDetailsApi';
import {BAITLY_CRM_STATUSES,baitlyCrmError} from './BaitlyCrmFields';
import {BAITLY_CRM_STAGE_KEYS} from './BaitlyCrmBoard';
import {BaitlyCrmKindIcon} from './BaitlyCrmContactCard';
import BaitlyCrmDeleteContacts from './BaitlyCrmDeleteContacts';
import {crmDeletionMessages} from '../../i18n/baitlyCrmDeletionMessages';
import {contactKind,type BaitlyCrmContact} from './baitlyCrmWorkspace';
const COLUMNS=['assignee','status','qualification','company','score','email','jobTitle','specificRole','region','type','city','phone','source','updated'] as const;
type Column=typeof COLUMNS[number];
const INITIAL_HIDDEN:Column[]=['type','city','phone','source','updated'];

export default function BaitlyCrmTable({contacts,org,status,selected,canManage,onOpen,filtersSlot,viewActions,allowFactEditing=true}:{allowFactEditing?:boolean;filtersSlot?:ReactNode;viewActions?:ReactNode;contacts:BaitlyCrmContact[];org:number;status:string;selected?:number;canManage:boolean;onOpen:(id:number)=>void}){
  const {t,currentLanguage}=useTranslation();const m=prospectionMessages(currentLanguage);const deletion=crmDeletionMessages(currentLanguage);const client=useQueryClient();
  const [sort,setSort]=useUserPreference<{field:'name'|'city';descending:boolean}>('baitly.crm.table.order',{field:'name',descending:false});
  const [filters,setFilters]=useUserPreference('baitly.crm.table.filters',{assignee:'all',qualification:'all'});
  const [hidden,setHidden]=useUserPreference<Column[]>('baitly.crm.columns',INITIAL_HIDDEN);
  const [deleting,setDeleting]=useState<BaitlyCrmContact[]|null>(null);
  const [selection,setSelection]=useState<Set<number>>(()=>new Set());
  const team=useQuery({queryKey:['prospects',org,'assignees'],queryFn:baitlyCrmDetailsApi.assignees,enabled:canManage});
  const [draft,setDraft]=useState<{id:number;field:string;value:string}|null>(null);
  const inputRef=useRef<HTMLInputElement>(null);
  const edit=useMutation({mutationFn:async({contact,field,value}:{contact:BaitlyCrmContact;field:string;value:string})=>{
    const detailKeys:Record<string,string>={assignee:'assignedUserId',qualification:'qualification',company:'companyName',jobTitle:'jobTitle',specificRole:'specificRole',region:'region'};
    if(detailKeys[field]){
      const current=contact.crm;
      if(!current)throw new Error(t('baitlyCrm.saveError'));
      await baitlyCrmDetailsApi.save(contact.id,{assignedUserId:current?.assigned_user_id??null,companyName:current?.company_name??'',jobTitle:current?.job_title??'',specificRole:current?.specific_role??'',region:current?.region??'',qualification:current?.qualification??'TO_QUALIFY',[detailKeys[field]]:field==='assignee'?(value?Number(value):null):value});
    }else{
      const data:BaitlyCrmContactWrite=field==='type'?{contactType:value==='owner'?'OWNER':'PROVIDER',category:value==='owner'?'OWNERS':value==='concierge'?'CONCIERGERIES':'PROVIDERS'}:{[field]:value};
      await prospectsApi.update(contact.id,data);
    }
  },onSuccess:async()=>{await client.invalidateQueries({queryKey:['prospects']});setDraft(null);}});
  function begin(contact:BaitlyCrmContact,field:string,value:string){if(!canManage||edit.isPending||(draft&&(draft.id!==contact.id||draft.field!==field)))return;edit.reset();setDraft({id:contact.id,field,value});}
  function cancel(){if(!edit.isPending){setDraft(null);edit.reset();}}
  function confirm(){if(!draft||edit.isPending||!canManage||inputRef.current&&!inputRef.current.reportValidity())return;const contact=contacts.find(item=>item.id===draft.id);if(contact)edit.mutate({contact,field:draft.field,value:draft.value.trim()});}
  function textCell(contact:BaitlyCrmContact,field:string,value:string|undefined|null,label:string){
    if(draft?.id===contact.id&&draft.field===field)return <input ref={inputRef} autoFocus className="bcrm-cell-input" aria-label={`${label} : ${contact.name}`} type={field==='email'?'email':field==='phone'?'tel':'text'} required={field==='name'} maxLength={field==='phone'?40:['jobTitle','specificRole','region'].includes(field)?150:255} value={draft.value} disabled={edit.isPending} onFocus={event=>event.target.select()} onChange={event=>setDraft({...draft,value:event.target.value})} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();confirm();}}}/>;
    return canManage&&(allowFactEditing||["jobTitle","specificRole","region"].includes(field))?<button type="button" className="bcrm-editable-cell" disabled={!!draft||edit.isPending||(['company','jobTitle','specificRole','region'].includes(field)&&!contact.crm)} onClick={()=>begin(contact,field,value??'')}>{value||m.missing}</button>:<span>{value||m.missing}</span>;
  }
  const pendingValue=(contact:BaitlyCrmContact,field:string,value:string|number|null|undefined)=>draft?.id===contact.id&&draft.field===field?draft.value:value??'';
  const blocked=(contact:BaitlyCrmContact,field:string)=>edit.isPending||!!draft&&(draft.id!==contact.id||draft.field!==field);
  const sorted=useMemo(()=>contacts.filter(contact=>(status==='all'||contact.status===status)&&(filters.assignee==='all'||(filters.assignee==='none'?!contact.crm?.assigned_user_id:String(contact.crm?.assigned_user_id)===filters.assignee))&&(filters.qualification==='all'||(contact.crm?.qualification??'TO_QUALIFY')===filters.qualification)).sort((a,b)=>(a[sort.field]??'').localeCompare(b[sort.field]??'',currentLanguage)*(sort.descending?-1:1)),[contacts,sort,filters,currentLanguage,status]);
  const selectedRows=sorted.filter(contact=>selection.has(contact.id));
  const columns=COLUMNS.filter(column=>!hidden.includes(column));
  const assignees=useMemo(()=>Array.from(new Map(contacts.filter(contact=>contact.crm?.assigned_user_name).map(contact=>[contact.crm!.assigned_user_id!,contact.crm!.assigned_user_name!])).entries()),[contacts]);
  function exportSelection(){
    const fields=[t('baitlyCrm.name'),m.assignee,t('baitlyCrm.status'),m.qualification,m.company,m.score,t('baitlyCrm.email'),m.jobTitle,m.specificRole,m.region];
    const cell=(value:unknown)=>{let text=String(value??'');if(/^[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
    const rows=selectedRows.map(contact=>[contact.name,contact.crm?.assigned_user_name,t('baitlyCrm.values.'+contact.status),contact.crm?m[contact.crm.qualification]:'',contact.crm?.company_name,contact.crm?.score,contact.email,contact.crm?.job_title,contact.crm?.specific_role,contact.crm?.region||contact.city]);
    const url=URL.createObjectURL(new Blob(['\uFEFF'+[fields,...rows].map(row=>row.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='baitly-contacts.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),0);
  }
  function toggle(id:number){setSelection(previous=>{const result=new Set(previous);result.has(id)?result.delete(id):result.add(id);return result;});}
  function cell(contact:BaitlyCrmContact,column:Column){
    const details=contact.crm;
    switch(column){
      case 'assignee':return canManage&&details?<div className="bcrm-assignee"><BaitlyCrmAssigneeAvatar details={details}/><select aria-label={`${m.assignee} : ${contact.name}`} value={pendingValue(contact,'assignee',details.assigned_user_id)} disabled={team.isPending||team.isError||blocked(contact,'assignee')} onChange={event=>begin(contact,'assignee',event.target.value)}><option value="">{m.unassigned}</option>{details.assignee_unavailable&&<option disabled value={details.assigned_user_id!}>{m.unavailableAssignee}</option>}{team.data?.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></div>:<span className="bcrm-assignee"><BaitlyCrmAssigneeAvatar details={details}/>{details?.assignee_unavailable?m.unavailableAssignee:details?.assigned_user_name||m.unassigned}</span>;
      case 'status':return <span className="bcrm-status" data-stage={contact.status}>{canManage?<select aria-label={`${m.stage} : ${contact.name}`} value={pendingValue(contact,'status',contact.status)} disabled={blocked(contact,'status')} onChange={event=>begin(contact,'status',event.target.value)}>{BAITLY_CRM_STATUSES.map(value=><option key={value} value={value}>{t('baitlyCrm.values.'+value)}</option>)}</select>:t('baitlyCrm.values.'+contact.status)}</span>;
      case 'qualification':return <span className="bcrm-qualification" data-qualification={details?.qualification??'TO_QUALIFY'}>{canManage&&details?<select aria-label={`${m.qualification} : ${contact.name}`} value={pendingValue(contact,'qualification',details.qualification)} disabled={blocked(contact,'qualification')} onChange={event=>begin(contact,'qualification',event.target.value)}>{(['TO_QUALIFY','QUALIFIED','UNQUALIFIED'] as const).map(value=><option key={value} value={value}>{m[value]}</option>)}</select>:details?m[details.qualification]:m.missing}</span>;
      case 'score':return <span className="bcrm-score" data-score={details?.score??'missing'} title={m.scoreHelp}>{details?`${details.score}/5`:m.missing}</span>;
      case 'email':return <span className="bcrm-email">{textCell(contact,'email',contact.email,t('baitlyCrm.email'))}</span>;
      case 'type':return <span className="bcrm-type-tag" data-kind={contactKind(contact)}>{canManage&&allowFactEditing?<select aria-label={`${t('baitlyCrm.type')} : ${contact.name}`} value={pendingValue(contact,'type',contactKind(contact))} disabled={blocked(contact,'type')} onChange={event=>begin(contact,'type',event.target.value)}>{(['owner','concierge','provider'] as const).map(kind=><option key={kind} value={kind}>{m[`${kind}Label`]}</option>)}</select>:m[`${contactKind(contact)}Label`]}</span>;
      case 'city':return textCell(contact,'city',contact.city,t('baitlyCrm.city'));
      case 'phone':return textCell(contact,'phone',contact.phone,t('baitlyCrm.phone'));
      case 'source':return contact.sourceType==='PUBLIC_FORM'?t('baitlyInquiries.publicForm'):t('baitlyCrm.values.'+contact.sourceType);
      case 'updated':return details?.updated_at?new Date(details.updated_at).toLocaleDateString(currentLanguage):m.missing;
      case 'company':return textCell(contact,'company',details?.company_name,m.company);
      case 'jobTitle':return textCell(contact,'jobTitle',details?.job_title,m.jobTitle);
      case 'specificRole':return textCell(contact,'specificRole',details?.specific_role,m.specificRole);
      case 'region':return <span className="bcrm-region-tag">{textCell(contact,'region',details?.region||contact.city,m.region)}</span>;
    }
  }
  const tableFilters=<div className="bcrm-header-table-filters"><div className="bcrm-toolbar-group"><select aria-label={m.assignee} value={filters.assignee} onChange={event=>setFilters({...filters,assignee:event.target.value})}><option value="all">{m.allAssignees}</option><option value="none">{m.unassigned}</option>{assignees.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
      <select aria-label={m.qualification} value={filters.qualification} onChange={event=>setFilters({...filters,qualification:event.target.value})}><option value="all">{m.allQualifications}</option>{(['TO_QUALIFY','QUALIFIED','UNQUALIFIED'] as const).map(key=><option key={key} value={key}>{m[key]}</option>)}</select>
      </div><span className="bcrm-toolbar-divider" aria-hidden/><div className="bcrm-toolbar-group"><button type="button" onClick={()=>setSort({...sort,descending:!sort.descending})}><ArrowDownAZ size={16} />{t('baitlyCrm.name')}</button>
      <Popover><PopoverTrigger asChild><button type="button"><Eye size={16}/>{m.columns}</button></PopoverTrigger><PopoverContent className="bcrm-columns-menu" align="start" aria-label={m.columns}>{COLUMNS.map(column=><label key={column}><input type="checkbox" checked={!hidden.includes(column)} onChange={event=>setHidden(event.target.checked?hidden.filter(value=>value!==column):[...hidden,column])} />{column==='type'||column==='city'||column==='phone'||column==='source'||column==='status'||column==='email'?t('baitlyCrm.'+column):m[column as keyof typeof m]}</label>)}</PopoverContent></Popover></div></div>;
  const headerFilters=usePageHeaderFilters(tableFilters,{fallbackWithoutHeader:tableFilters});
  return <div className="bcrm-grouped-table" onKeyDown={event=>{if(event.key==='Escape'&&draft){event.preventDefault();cancel();}}}>
    <div className="bcrm-table-tools">{draft&&<button type="button" onClick={cancel} disabled={edit.isPending}><X size={15}/>{t('common.cancel')}</button>}{filtersSlot&&<><div className="bcrm-toolbar-group">{filtersSlot}</div><span className="bcrm-toolbar-divider" aria-hidden/></>}{headerFilters}<span className="bcrm-toolbar-divider" aria-hidden/><div className="bcrm-toolbar-group">
      {!!sorted.length&&<button type="button" onClick={()=>setSelection(new Set(sorted.map(contact=>contact.id)))}>{deletion.selectAll(sorted.length)}</button>}
      {!!selectedRows.length&&<div className="bcrm-selection"><strong>{selectedRows.length} {m.selected}</strong><button type="button" onClick={exportSelection}><Download size={16} />{m.export}</button>{canManage&&<button type="button" className="bcrm-delete-action" disabled={!!draft||edit.isPending} onClick={()=>setDeleting([...selectedRows])}><Trash2 size={16}/>{deletion.removeSelection}</button>}<button type="button" onClick={()=>setSelection(new Set())}>{m.clearSelection}</button></div>}
    </div>{viewActions&&<><span className="bcrm-toolbar-divider" aria-hidden/>{viewActions}</>}
    </div>
    {edit.isError&&<Alert variant="destructive"><AlertDescription>{baitlyCrmError(edit.error,t('baitlyCrm.saveError'))}</AlertDescription></Alert>}
    {BAITLY_CRM_STATUSES.map((stage,index)=>status==='all'||status===stage?<ContactGroup key={stage} stage={stage} index={index} contacts={sorted.filter(contact=>contact.status===stage)}>
      {items=><div className="bcrm-table-scroll" data-stage={stage}><table><thead><tr><th className="bcrm-check-cell"><input type="checkbox" aria-label={`${m.selectAll} : ${m[BAITLY_CRM_STAGE_KEYS[index]]}`} checked={sorted.some(contact=>contact.status===stage)&&sorted.filter(contact=>contact.status===stage).every(contact=>selection.has(contact.id))} onChange={event=>setSelection(previous=>{const result=new Set(previous);sorted.filter(contact=>contact.status===stage).forEach(contact=>event.target.checked?result.add(contact.id):result.delete(contact.id));return result;})} /></th>
        <th scope="col" className="bcrm-name-column" aria-sort={sort.descending?'descending':'ascending'}><button type="button" onClick={()=>setSort({...sort,descending:!sort.descending})}>{t('baitlyCrm.name')}</button></th>
        {columns.map(column=><th scope="col" data-column={column} key={column} title={column==='score'?m.scoreHelp:undefined}>{['type','city','phone','source','status','email'].includes(column)?t('baitlyCrm.'+column):m[column as keyof typeof m]}</th>)}
      {canManage&&<th scope="col" className="bcrm-row-actions"><span className="sr-only">{deletion.actions}</span></th>}</tr></thead><tbody>{items.map(contact=><tr key={contact.id} data-selected={selected===contact.id||selection.has(contact.id)}><td className="bcrm-check-cell"><input type="checkbox" aria-label={`${m.selectContact} ${contact.name}`} checked={selection.has(contact.id)} onChange={()=>toggle(contact.id)} /></td>
        <td className="bcrm-name-column"><div className="bcrm-table-name"><span className="bcrm-contact__avatar" data-kind={contactKind(contact)}><BaitlyCrmKindIcon contact={contact} /></span>{textCell(contact,'name',contact.name,t('baitlyCrm.name'))}<button type="button" className="bcrm-open-contact" aria-label={`${t('baitlyCrm.contactRecord')} : ${contact.name}`} onClick={()=>onOpen(contact.id)} disabled={!!draft}><ArrowUpRight size={14}/></button></div></td>
        {columns.map(column=><td key={column} data-column={column}>{cell(contact,column)}</td>)}
      {canManage&&<td className="bcrm-row-actions">{draft?.id===contact.id?<button type="button" aria-label={`${t('common.save')} : ${contact.name}`} title={t('common.save')} className="bcrm-confirm-cell" disabled={edit.isPending} onClick={confirm}><Check size={16}/></button>:<button type="button" aria-label={`${deletion.remove} : ${contact.name}`} title={deletion.remove} className="bcrm-delete-action" disabled={!!draft||edit.isPending} onClick={()=>setDeleting([contact])}><Trash2 size={15}/></button>}</td>}</tr>)}</tbody></table></div>}
    </ContactGroup>:null)}
    {canManage&&deleting&&<BaitlyCrmDeleteContacts targets={deleting} onCancel={()=>setDeleting(null)} onDeleted={ids=>{setSelection(previous=>new Set([...previous].filter(id=>!ids.includes(id))));setDeleting(null);}}/>}
  </div>;
}
function ContactGroup({stage,index,contacts,children}:{stage:string;index:number;contacts:BaitlyCrmContact[];children:(items:BaitlyCrmContact[])=>React.ReactNode}){
  const {currentLanguage}=useTranslation();const m=prospectionMessages(currentLanguage);const [closed,setClosed]=useUserPreference(`baitly.crm.group.${stage}`,false);const [page,setPage]=useState(0);const currentPage=Math.min(page,Math.max(0,Math.ceil(contacts.length/10)-1));
  return <section className="bcrm-contact-group" data-stage={stage}><h3><button type="button" className="bcrm-group-heading" aria-expanded={!closed} onClick={()=>setClosed(!closed)}><ChevronDown size={17} aria-hidden /><span>{m[BAITLY_CRM_STAGE_KEYS[index]]}</span><small>{contacts.length}</small></button></h3>
    {!closed&&<>{contacts.length?children(contacts.slice(currentPage*10,currentPage*10+10)):<p className="bcrm-table-empty">{m.noStage}</p>}{contacts.length>10&&<PagePagination page={currentPage} count={contacts.length} rowsPerPage={10} onPageChange={setPage} />}</>}
  </section>;
}

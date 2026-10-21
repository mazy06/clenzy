import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Button,Input,Skeleton} from '../../components/ui';
import {useTranslation} from '../../hooks/useTranslation';
import {prospectionMessages} from '../../i18n/baitlyProspectionMessages';
import {baitlyCrmDetailsApi,type BaitlyCrmDetails,type BaitlyCrmDetailsWrite} from '../../services/api/baitlyCrmDetailsApi';
import BaitlyCrmFollowUp from './BaitlyCrmFollowUp';
export default function BaitlyCrmDetailsEditor({id,org,canManage,canFollowUp=canManage,contactName=''}:{id:number;org:number;canManage:boolean;canFollowUp?:boolean;contactName?:string}){
  const {currentLanguage}=useTranslation();const m=prospectionMessages(currentLanguage);
  const query=useQuery({queryKey:['prospects',org,'details'],queryFn:baitlyCrmDetailsApi.list});
  if(query.isPending)return <Skeleton className="h-32 w-full" />;
  if(query.isError)return <div role="alert"><p>{m.detailsError}</p><Button variant="outline" onClick={()=>query.refetch()}>{m.locationRetry}</Button></div>;
  const value=query.data.find(row=>row.prospect_id===id);
  return <><BaitlyCrmFollowUp contact={{id,crm:value,name:contactName,archived:false}} canManage={canFollowUp}/><Details key={JSON.stringify(value)} id={id} org={org} canManage={canManage} value={value} /></>;
}
function Details({id,org,canManage,value}:{id:number;org:number;canManage:boolean;value?:BaitlyCrmDetails}){
  const {currentLanguage}=useTranslation();const m=prospectionMessages(currentLanguage);const client=useQueryClient();const [editing,setEditing]=useState(false);const [assignee,setAssignee]=useState(String(value?.assigned_user_id??''));
  const team=useQuery({queryKey:['prospects',org,'assignees'],queryFn:baitlyCrmDetailsApi.assignees,enabled:canManage&&editing});
  const save=useMutation({mutationFn:(draft:BaitlyCrmDetailsWrite)=>baitlyCrmDetailsApi.save(id,draft),onSuccess:async()=>{await client.invalidateQueries({queryKey:['prospects',org,'details']});setEditing(false);}});
  return <section className="bcrm-business-fields">
    <dl>{[[m.assignee,value?.assignee_unavailable?m.unavailableAssignee:value?.assigned_user_name||m.unassigned],[m.company,value?.company_name],[m.qualification,m[value?.qualification??'TO_QUALIFY']],[m.score,value?`${value.score}/5`:null],[m.jobTitle,value?.job_title],[m.specificRole,value?.specific_role],[m.region,value?.region]].map(([label,text])=><div key={label}><dt title={label===m.score?m.scoreHelp:undefined}>{label}</dt><dd>{text||m.missing}</dd></div>)}</dl>
    {canManage&&!editing&&<Button variant="outline" className="cursor-pointer" onClick={()=>setEditing(true)}>{m.editDetails}</Button>}
    {canManage&&editing&&<form className="bcrm-detail-form" onSubmit={event=>{
      event.preventDefault();const data=new FormData(event.currentTarget);
      save.mutate({assignedUserId:assignee?Number(assignee):null,companyName:String(data.get('companyName')),jobTitle:String(data.get('jobTitle')),specificRole:String(data.get('specificRole')),region:String(data.get('region')),qualification:String(data.get('qualification')) as BaitlyCrmDetails['qualification']});
    }}><fieldset disabled={save.isPending||team.isPending||team.isError}>
      <label>{m.assignee}<select name="assignedUserId" value={assignee} onChange={event=>setAssignee(event.target.value)}><option value="">{m.unassigned}</option>{value?.assignee_unavailable&&<option disabled value={value.assigned_user_id!}>{m.unavailableAssignee}</option>}{team.data?.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      <label>{m.qualification}<select name="qualification" defaultValue={value?.qualification??'TO_QUALIFY'}>{(['TO_QUALIFY','QUALIFIED','UNQUALIFIED'] as const).map(key=><option key={key} value={key}>{m[key]}</option>)}</select></label>
      {([['companyName','company_name',m.company],['jobTitle','job_title',m.jobTitle],['specificRole','specific_role',m.specificRole],['region','region',m.region]] as const).map(([name,key,label])=><label key={name}>{label}<Input name={name} maxLength={name==='companyName'?255:150} defaultValue={value?.[key]??''} /></label>)}
    </fieldset>
      {team.isError&&<p role="alert">{m.detailsError}<Button type="button" variant="link" onClick={()=>team.refetch()}>{m.locationRetry}</Button></p>}
      {save.isError&&<p role="alert">{m.locationError}</p>}
      <div className="bcrm-actions"><Button type="submit" disabled={save.isPending||team.isPending||team.isError}>{m.saveDetails}</Button><Button type="button" variant="ghost" onClick={()=>setEditing(false)}>{m.close}</Button></div>
    </form>}
  </section>;
}

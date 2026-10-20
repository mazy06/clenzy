import BaitlyCrmIconAction from "./BaitlyCrmIconAction";
import {Save} from "../../icons/glyphs";
import { useId,useState,type FormEvent } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { Alert,AlertDescription,Button,Input,Skeleton,Textarea } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { baitlyRecruitmentApi } from '../../services/api/baitlyRecruitmentApi';
import { BAITLY_RECRUITMENT_TRADES,recruitmentUrl,type BaitlyRecruitmentPage } from '../../services/baitlyRecruitment';
import { recruitmentMessages,recruitmentTrade } from '../../i18n/baitlyRecruitmentMessages';
import {crmWorkflowMessages} from '../../i18n/baitlyCrmWorkflowMessages';
import BaitlyCrmHeaderActions from './BaitlyCrmHeaderActions';
import {ArrowUpRight} from '../../icons/glyphs';
import ProviderCountrySelect from '../../../site/components/ProviderCountrySelect';

export default function BaitlyCrmRecruitment({org,canManage}:{org:number;canManage:boolean}) {
  const {currentLanguage}=useTranslation(); const m=recruitmentMessages(currentLanguage);
  const [saved,setSaved]=useState(false);
  const query=useQuery({queryKey:['prospects',org,'recruitment'],queryFn:baitlyRecruitmentApi.own});
  if(query.isPending)return <Skeleton className="h-32 w-full" />;
  if(query.isError)return <Alert variant="destructive"><AlertDescription>{m.error}</AlertDescription><Button variant="outline" onClick={()=>query.refetch()}>{m.retry}</Button></Alert>;
  if(!query.data.available)return <p className="text-sm text-muted-foreground">{m.unavailable}</p>;
  return <><RecruitmentEditor key={JSON.stringify(query.data.page)} page={query.data.page} org={org} canManage={canManage} onSaved={setSaved} />
    {saved&&<p role="status" className="mt-3 text-sm">{m.saved}</p>}</>;
}
function RecruitmentEditor({page,org,canManage,onSaved}:{page:Partial<BaitlyRecruitmentPage>;org:number;canManage:boolean;onSaved:(saved:boolean)=>void}) {
  const {currentLanguage}=useTranslation(); const m=recruitmentMessages(currentLanguage);const w=crmWorkflowMessages(currentLanguage);const client=useQueryClient();
  const [services,setServices]=useState(page.services??[]); const [selectionError,setSelectionError]=useState(false);
  const save=useMutation({mutationFn:baitlyRecruitmentApi.save,onSuccess:async()=>{onSaved(true);await client.invalidateQueries({queryKey:['prospects',org,'recruitment']});}});
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSelectionError(!services.length);if(!services.length)return;
    const fields=new FormData(event.currentTarget);onSaved(false);
    save.mutate({published:fields.get('published')==='on',recipientName:String(fields.get('recipientName')),title:String(fields.get('title')),
      city:String(fields.get('city')),countryCode:String(fields.get('countryCode')||'')||undefined,description:String(fields.get('description')),services});
  }
  const formId=useId();
  const language=currentLanguage==='ar'||currentLanguage==='en'?currentLanguage:'fr';
  return <form id={formId} className="bcrm-public-editor" onSubmit={submit} onChange={()=>onSaved(false)}>
    <BaitlyCrmHeaderActions>{canManage&&<BaitlyCrmIconAction action="save" label={m.save} icon={<Save size={16}/>} type="submit" form={formId} disabled={save.isPending}/>}</BaitlyCrmHeaderActions>
    <div className="bcrm-public-editor-head"><span className="bcrm-workflow-tag" data-status={page.published?'PUBLISHED':'DRAFT'}>{page.published?w.published:w.draft}</span>{page.id&&page.published&&<a href={recruitmentUrl(page.id,currentLanguage)} target="_blank" rel="noopener noreferrer">{m.share}<ArrowUpRight size={15}/></a>}</div>
    <fieldset disabled={!canManage||save.isPending} className="bcrm-public-fields">
      <label className="block text-sm">{m.recipient}<Input name="recipientName" required maxLength={150} defaultValue={page.recipientName??''} /></label>
      <label className="block text-sm">{m.headline}<Input name="title" required maxLength={160} defaultValue={page.title??''} /></label>
      <div className="bcrm-form-pair bcrm-wide-field"><label className="block text-sm">{m.city}<Input name="city" required maxLength={150} defaultValue={page.city??''} /></label>
        <label className="block text-sm">{m.country}<ProviderCountrySelect name="countryCode" language={language} defaultValue={page.countryCode??''} placeholder={m.countryNone} className="w-full" /></label></div>
      <fieldset className="bcrm-service-options bcrm-wide-field"><legend>{m.services}</legend>
        {BAITLY_RECRUITMENT_TRADES.map(code=><label key={code} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={services.includes(code)} onChange={e=>{setSelectionError(false);setServices(values=>e.target.checked?[...values,code]:values.filter(v=>v!==code));}} />{recruitmentTrade(code,currentLanguage)}</label>)}
      </fieldset>
      {selectionError&&<p role="alert" className="text-sm text-destructive">{m.select}</p>}
      <label className="bcrm-wide-field">{m.description}<Textarea name="description" maxLength={3000} rows={3} defaultValue={page.description??''} /></label>
      <div className="bcrm-publish-actions bcrm-wide-field"><label><input type="checkbox" name="published" defaultChecked={!!page.published} />{m.published}</label>
      </div>
    </fieldset>
    {save.isError&&<Alert variant="destructive"><AlertDescription>{m.error}</AlertDescription></Alert>}
  </form>;
}

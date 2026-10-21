import BaitlyCrmIconAction from "./BaitlyCrmIconAction";
import {Save,ArrowRight,Send,X,RefreshCw as HeaderRefresh,Plus as HeaderPlus} from "../../icons/glyphs";
import { useId,useRef,useState,type FormEvent } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { Alert,AlertDescription,Button,Input,Skeleton,Textarea } from '../../components/ui';
import PagePagination from '../../components/PagePagination';
import { useTranslation } from '../../hooks/useTranslation';
import { campaignLabel,campaignMessages } from '../../i18n/baitlyCampaignMessages';
import { baitlyCampaignsApi,type BaitlyCampaignDetail,type BaitlyCampaignSegment,type BaitlyCampaignTemplate } from '../../services/api/baitlyCampaignsApi';
import { BAITLY_RECRUITMENT_TRADES } from '../../services/baitlyRecruitment';
import { recruitmentTrade } from '../../i18n/baitlyRecruitmentMessages';
import {crmWorkflowMessages} from '../../i18n/baitlyCrmWorkflowMessages';
import BaitlyCrmHeaderActions from './BaitlyCrmHeaderActions';
import {Plus,ArrowLeft,RefreshCw} from '../../icons/glyphs';
import { prospectionMessages } from '../../i18n/baitlyProspectionMessages';
import { prospectionGuidanceMessages } from '../../i18n/baitlyProspectionGuidanceMessages';
import BaitlyCrmEmptyState from './BaitlyCrmEmptyState';

type WorkspaceProps={org:number;canManage:boolean;canSend:boolean;onContact?:(id:number)=>void;onContacts?:()=>void};
export default function BaitlyCrmCampaigns(props:WorkspaceProps){
  const {currentLanguage}=useTranslation();const m=campaignMessages(currentLanguage);const w=crmWorkflowMessages(currentLanguage);const [page,setPage]=useState(0);
  const guidance=prospectionGuidanceMessages(currentLanguage);
  const [mode,setMode]=useState<'list'|'create'|number>('list');
  const query=useQuery({queryKey:['prospects',props.org,'campaigns','list',page],queryFn:()=>baitlyCampaignsApi.list(page)});
  if(typeof mode==='number')return <CampaignDetails key={mode} {...props} id={mode} onBack={()=>setMode('list')} />;
  if(mode==='create'&&props.canManage)return <CampaignBuilder org={props.org} onBack={()=>setMode('list')} onCreated={setMode} />;
  return <section className="bcrm-campaigns" aria-label={m.title}>
    <BaitlyCrmHeaderActions>{props.canManage&&<BaitlyCrmIconAction action="create" label={m.new} icon={<HeaderPlus size={16}/>} onClick={()=>setMode('create')}/>}</BaitlyCrmHeaderActions>
    {query.isPending?<Skeleton className="h-32 w-full" />:query.isError?<Failure retry={()=>query.refetch()} />:<>
      {!query.data.content.length?<BaitlyCrmEmptyState icon={<Send />} title={guidance.campaignTitle} description={guidance.campaignHelp}
        action={props.canManage?{label:guidance.createCampaign,onClick:()=>setMode('create')}:undefined}
        secondaryAction={props.onContacts?{label:guidance.contacts,onClick:props.onContacts}:undefined}/>:<div className="bcrm-data-scroll"><table className="bcrm-data-table"><thead><tr><th>{w.campaign}</th><th>{w.audience}</th><th>{w.status}</th><th>{w.created}</th></tr></thead><tbody>{query.data.content.map(campaign=><tr key={campaign.id}>
        <td><button type="button" className="bcrm-row-link" onClick={()=>setMode(campaign.id)}>{campaign.name}</button></td>
        <td><span className="bcrm-workflow-tag" data-tone={campaign.contact_type==='OWNER'?'blue':'purple'}>{campaignLabel(campaign.contact_type,currentLanguage)}</span></td>
        <td><span className="bcrm-workflow-tag" data-status={campaign.status}>{campaignLabel(campaign.status,currentLanguage)}</span></td>
        <td><time dateTime={campaign.created_at}>{new Date(campaign.created_at).toLocaleDateString(currentLanguage)}</time></td>
      </tr>)}</tbody></table></div>}
      {query.data.totalElements>25&&<PagePagination page={page} count={query.data.totalElements} rowsPerPage={25} onPageChange={setPage} />}
    </>}
  </section>;
}
function Failure({retry}:{retry?:()=>void}){const {currentLanguage}=useTranslation();const m=campaignMessages(currentLanguage);return <Alert variant="destructive"><AlertDescription>{m.error}</AlertDescription>{retry&&<Button variant="outline" onClick={retry}>{m.retry}</Button>}</Alert>;}

function CampaignBuilder({org,onBack,onCreated}:{org:number;onBack:()=>void;onCreated:(id:number)=>void}){
  const {currentLanguage}=useTranslation();const m=campaignMessages(currentLanguage);
  const formId=useId();const navigation=prospectionMessages(currentLanguage);const w=crmWorkflowMessages(currentLanguage);const [step,setStep]=useState(0);
  const client=useQueryClient();
  const [segment,setSegment]=useState<BaitlyCampaignSegment>({type:'OWNER'});const [modelId,setModelId]=useState(0);const [name,setName]=useState('');const [reviewed,setReviewed]=useState('');
  const templates=useQuery({queryKey:['prospects',org,'campaigns','templates'],queryFn:baitlyCampaignsApi.templates});
  const preview=useMutation({mutationFn:({segment,page}:{segment:BaitlyCampaignSegment;page:number})=>baitlyCampaignsApi.preview(segment,page),onSuccess:(_,variables)=>setReviewed(JSON.stringify(variables.segment))});
  const fingerprint=useRef<{value:string;requestId:string}>();
  const create=useMutation({mutationFn:baitlyCampaignsApi.create,onSuccess:async campaign=>{await client.invalidateQueries({queryKey:['prospects',org,'campaigns','list']});onCreated(campaign.id);}});
  const model=templates.data?.find(item=>item.id===modelId&&item.contact_type===segment.type);
  const currentPreview=preview.data&&reviewed===JSON.stringify(segment)?preview.data:undefined;
  function field(key:keyof BaitlyCampaignSegment,value:string){setSegment(values=>({...values,[key]:value||undefined}));}
  function prepare(event:FormEvent){
    event.preventDefault();if(step!==2||!currentPreview?.eligible||!model)return;
    const payload={name,templateId:model.id,segment,language:currentLanguage==='ar'||currentLanguage==='en'?currentLanguage:'fr'};
    const value=JSON.stringify(payload);if(fingerprint.current?.value!==value)fingerprint.current={value,requestId:crypto.randomUUID()};
    create.mutate({...payload,requestId:fingerprint.current.requestId});
  }
  return <section className="bcrm-campaign-builder"><Button variant="link" className="bcrm-back-action" onClick={onBack}><ArrowLeft size={15} />{m.back}</Button>
    <nav className="bcrm-steps" aria-label={navigation.steps}>{[navigation.audience,navigation.message,navigation.review].map((label,index)=><button type="button" key={label} aria-label={`${index+1} ${label}`} aria-current={index===step?'step':undefined} disabled={create.isPending||(index===2&&!model)} onClick={()=>setStep(index)}><span>{index+1}</span>{label}</button>)}</nav>
    <BaitlyCrmHeaderActions>{step<2?<BaitlyCrmIconAction action="next" label={navigation.next} icon={<ArrowRight size={16}/>} type="button" disabled={create.isPending||(step===1&&!model)} onClick={()=>setStep(value=>value+1)}/>:<BaitlyCrmIconAction action="save" label={m.prepare} icon={<Save size={16}/>} type="submit" form={formId} disabled={!currentPreview?.eligible||!model||!name.trim()||create.isPending||preview.isPending}/>}</BaitlyCrmHeaderActions>
    <form id={formId} onSubmit={prepare} className="bcrm-campaign-form">
      <fieldset hidden={step!==0} disabled={create.isPending||preview.isPending} className="space-y-3">
        <p className="bcrm-field-hint">{m.limit}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">{m.type}<select aria-label={m.type} className="mt-1 block w-full cursor-pointer rounded-md border border-border bg-background p-2 text-foreground" value={segment.type} onChange={event=>{setSegment({type:event.target.value as 'OWNER'|'PROVIDER'});setModelId(0);}}>{['OWNER','PROVIDER'].map(type=><option key={type} value={type}>{campaignLabel(type,currentLanguage)}</option>)}</select></label>
          <label className="text-sm">{m.city}<Input maxLength={150} value={segment.city??''} onChange={e=>field('city',e.target.value)} /></label>
          <Filter label={m.status} value={segment.status} options={['TO_CONTACT','IN_DISCUSSION','PARTNER','REJECTED']} onChange={value=>field('status',value)} />
          <Filter label={m.category} value={segment.category} options={segment.type==='OWNER'?['OWNERS']:['PROVIDERS','CONCIERGERIES','MENAGE','ARTISANS','ENTRETIEN','BLANCHISSERIES']} onChange={value=>field('category',value)} />
          <Filter label={m.source} value={segment.source} options={['LEGACY','MANUAL','CSV','REFERRAL','PARTNER','OPEN_DATA','PUBLIC_FORM']} onChange={value=>field('source',value)} />
          {segment.type==='PROVIDER'&&<label className="text-sm">{m.specialty}<Input maxLength={150} value={segment.specialty??''} onChange={e=>field('specialty',e.target.value)} /></label>}
          {segment.type==='PROVIDER'&&<Filter label={m.trade} value={segment.trade} options={[...BAITLY_RECRUITMENT_TRADES]} labelFor={value=>recruitmentTrade(value,currentLanguage)} onChange={value=>field('trade',value)} />}
        </div>
      </fieldset>
      <section hidden={step!==1} className="space-y-3">
        {templates.isError&&<Failure retry={()=>templates.refetch()} />}
        <label className="block text-sm">{m.template}<select aria-label={m.template} className="mt-1 block w-full cursor-pointer rounded-md border border-border bg-background p-2 text-foreground" value={modelId} disabled={create.isPending||templates.isPending} onChange={e=>setModelId(Number(e.target.value))}>
          <option value={0}>{m.choose}</option>{templates.data?.filter(item=>item.contact_type===segment.type).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        {model&&<div className="bcrm-message-preview"><p className="font-medium break-words">{model.subject}</p><p className="whitespace-pre-wrap break-words">{model.body}</p></div>}
      </section>
      <section hidden={step!==2} className="space-y-3"><details className="bcrm-help-disclosure"><summary>{w.rules}</summary><p>{m.authorization}</p></details>
        <Button type="button" variant="outline" className="cursor-pointer" disabled={preview.isPending||create.isPending} onClick={()=>preview.mutate({segment,page:0})}>{m.preview}</Button>
        {preview.isError&&<Failure />}
        {preview.data&&!currentPreview&&<p className="text-sm" role="status">{m.refreshPreview}</p>}
        {currentPreview&&<div className="bcrm-audience-preview">
          <p className="bcrm-preview-counts">{m.total} : {currentPreview.total} · {m.eligible} : {currentPreview.eligible} · {m.excluded} : {currentPreview.total-currentPreview.eligible}</p>
          {Object.entries(currentPreview.exclusions).map(([reason,count])=><p key={reason} className="tabular-nums text-muted-foreground">{campaignLabel(reason,currentLanguage)} : {count}</p>)}
          {!currentPreview.eligible&&<p>{m.noEligible}</p>}
          <ul className="divide-y divide-border">{currentPreview.content.map(contact=><li key={contact.id} className="flex flex-wrap justify-between gap-2 py-2"><span className="break-all">{contact.name} · {contact.email??contact.city}</span><span>{campaignLabel(contact.reason,currentLanguage)}</span></li>)}</ul>
          {currentPreview.total>25&&<PagePagination page={currentPreview.page} count={currentPreview.total} rowsPerPage={25} onPageChange={page=>preview.mutate({segment,page})} />}
        </div>}
      </section>
      {step===2&&<label className="block text-sm">{m.campaignName}<Input required maxLength={150} value={name} disabled={create.isPending} onChange={e=>setName(e.target.value)} /></label>}
      <div className="bcrm-wizard-actions"><Button type="button" variant="outline" className="cursor-pointer" disabled={step===0||create.isPending} onClick={()=>setStep(value=>value-1)}>{navigation.previous}</Button>

      </div>
      {create.isError&&<Failure />}
    </form>
    <details hidden={step!==1} className="bcrm-template-disclosure"><summary className="cursor-pointer py-2 text-sm font-medium">{m.editModel}</summary>
      <TemplateEditor key={`${modelId}:${segment.type}`} org={org} type={segment.type} model={model} onSelected={setModelId} />
    </details>
  </section>;
}
function Filter({label,value,options,onChange,labelFor}:{label:string;value?:string;options:string[];onChange:(value:string)=>void;labelFor?:(value:string)=>string}){
  const {currentLanguage}=useTranslation();return <label className="text-sm">{label}<select aria-label={label} className="mt-1 block w-full cursor-pointer rounded-md border border-border bg-background p-2 text-foreground" value={value??''} onChange={e=>onChange(e.target.value)}><option value="">{campaignMessages(currentLanguage).all}</option>{options.map(option=><option key={option} value={option}>{labelFor?labelFor(option):campaignLabel(option,currentLanguage)}</option>)}</select></label>;
}
function TemplateEditor({org,type,model,onSelected}:{org:number;type:'OWNER'|'PROVIDER';model?:BaitlyCampaignTemplate;onSelected:(id:number)=>void}){
  const {currentLanguage}=useTranslation();const m=campaignMessages(currentLanguage);const client=useQueryClient();
  const save=useMutation({mutationFn:baitlyCampaignsApi.saveTemplate,onSuccess:async model=>{onSelected(model.id);await client.invalidateQueries({queryKey:['prospects',org,'campaigns','templates']});}});
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);save.mutate({id:model?.id,contactType:type,name:String(data.get('name')),subject:String(data.get('subject')),body:String(data.get('body'))});}
  return <form onSubmit={submit} className="space-y-3"><fieldset disabled={save.isPending} className="space-y-3">
    <label className="block text-sm">{m.modelName}<Input name="name" required maxLength={150} defaultValue={model?.name??''} /></label>
    <label className="block text-sm">{m.subject}<Input name="subject" required maxLength={200} defaultValue={model?.subject??(type==='OWNER'?m.seedOwnerSubject:m.seedProviderSubject)} /></label>
    <label className="block text-sm">{m.body}<Textarea name="body" required maxLength={6000} rows={7} defaultValue={model?.body??(type==='OWNER'?m.seedOwnerBody:m.seedProviderBody)} /></label>
    <p className="text-sm text-muted-foreground">{m.variables}</p><Button type="submit" variant="outline" className="cursor-pointer" disabled={save.isPending}>{m.saveModel}</Button>
  </fieldset>{save.isError&&<Failure />}{save.isSuccess&&<p className="text-sm" role="status">{m.modelSaved}</p>}</form>;
}

function CampaignDetails(props:WorkspaceProps&{id:number;onBack:()=>void}){
  const [page,setPage]=useState(0);const query=useQuery({queryKey:['prospects',props.org,'campaigns','detail',props.id,page],queryFn:()=>baitlyCampaignsApi.detail(props.id,page)});
  const {currentLanguage}=useTranslation();const m=campaignMessages(currentLanguage);
  return <section className="bcrm-campaign-detail"><Button variant="link" className="bcrm-back-action" onClick={props.onBack}><ArrowLeft size={15} />{m.back}</Button>
    {query.isPending?<Skeleton className="h-40 w-full" />:query.isError?<Failure retry={()=>query.refetch()} />:<><CampaignDetailsContent {...props} detail={query.data} />
      {query.data.totalElements>25&&<PagePagination page={page} count={query.data.totalElements} rowsPerPage={25} onPageChange={setPage} />}</>}
  </section>;
}
function CampaignDetailsContent({org,id,canManage,canSend,onContact,detail}:{detail:BaitlyCampaignDetail}&WorkspaceProps&{id:number}){
  const {currentLanguage}=useTranslation();const m=campaignMessages(currentLanguage);const w=crmWorkflowMessages(currentLanguage);const client=useQueryClient();const [confirmed,setConfirmed]=useState(false);
  const refresh=()=>client.invalidateQueries({queryKey:['prospects',org,'campaigns']});
  const transport=useQuery({queryKey:['prospects',org,'campaigns','transport'],queryFn:baitlyCampaignsApi.transport});
  const dispatch=useMutation({mutationFn:()=>baitlyCampaignsApi.dispatch(id),onSettled:refresh});
  const cancel=useMutation({mutationFn:()=>baitlyCampaignsApi.cancel(id),onSuccess:refresh});
  const active=detail.campaign.status==='READY'||detail.campaign.status==='ACTIVE';
  return <div className="space-y-4">
    <BaitlyCrmHeaderActions><BaitlyCrmIconAction action="refresh" label={m.refresh} icon={<HeaderRefresh size={16}/>} onClick={()=>refresh()}/>{active&&canManage&&<><BaitlyCrmIconAction action="cancel" label={m.cancel} icon={<X size={16}/>} disabled={cancel.isPending||dispatch.isPending} onClick={()=>cancel.mutate()}/>{canSend&&<BaitlyCrmIconAction action="send" label={detail.counts.QUEUED?m.send:m.reconcile} icon={<Send size={16}/>} disabled={!confirmed||!transport.data?.available||dispatch.isPending||cancel.isPending||!(detail.counts.QUEUED||detail.counts.SENDING)} onClick={()=>dispatch.mutate()}/>}</>}</BaitlyCrmHeaderActions>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="break-words text-base font-semibold">{detail.campaign.name}</h3><span className="bcrm-workflow-tag" data-status={detail.campaign.status}>{campaignLabel(detail.campaign.status,currentLanguage)}</span></div>
    <details className="bcrm-help-disclosure"><summary>{w.delivery}</summary><p>{m.deliveryHelp}</p></details>
    <div className="bcrm-delivery-counts">{['QUEUED','SENDING','ACCEPTED','UNKNOWN','SKIPPED'].map(status=><p key={status}>{campaignLabel(status,currentLanguage)} : {detail.counts[status]??0}</p>)}<p>{m.responded} : {detail.responded}</p></div>
    {active&&canManage&&<div className="bcrm-dispatch-actions">
      {!canSend&&<p className="text-sm text-muted-foreground">{m.sendPermission}</p>}
      {transport.isError&&<Failure retry={()=>transport.refetch()} />}
      {transport.data&&!transport.data.available&&<p className="text-sm text-muted-foreground">{m.transportMissing}</p>}
      {canSend&&<><label className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0 cursor-pointer" style={{accentColor:'var(--bui-primary)'}} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />{m.confirm}</label>
</>}
    </div>}
    {dispatch.isSuccess&&<p role="status" className="text-sm">{m.sent}</p>}
    {(dispatch.isError||cancel.isError)&&<Failure />}
    {(detail.counts.UNKNOWN>0||detail.counts.SENDING>0||dispatch.isError)&&<p className="max-w-3xl text-sm text-muted-foreground">{m.uncertain}</p>}
    {detail.content.map(recipient=><article key={recipient.id} className="bcrm-recipient-row">
      <div className="bcrm-recipient-heading"><h4>{recipient.contact_name}</h4><span className="bcrm-recipient-email">{recipient.email}</span><span className="bcrm-workflow-tag" data-status={recipient.status}>{campaignLabel(recipient.status,currentLanguage)}</span>{onContact&&<Button variant="link" size="sm" onClick={()=>onContact(recipient.prospect_id)}>{m.openContact}</Button>}</div>
      {recipient.reason&&<p>{campaignLabel(recipient.reason,currentLanguage)}</p>}
      <details><summary className="cursor-pointer py-1">{m.content}</summary><p className="break-words font-medium">{recipient.subject}</p><p className="whitespace-pre-wrap break-words">{recipient.body}</p><p className="mt-2 text-muted-foreground">{m.variables}</p></details>
      {recipient.responses.map(response=><div key={response.id} className="space-y-1"><p>{campaignLabel(response.decision,currentLanguage)} · {campaignLabel(response.source,currentLanguage)} · <time className="tabular-nums" dateTime={response.created_at}>{new Date(response.created_at).toLocaleString(currentLanguage)}</time></p><p className="whitespace-pre-wrap break-words">{response.message}</p></div>)}
      {canManage&&['SENDING','ACCEPTED','UNKNOWN'].includes(recipient.status)&&<details><summary className="cursor-pointer py-1">{m.reply}</summary><p className="mb-3 text-muted-foreground">{m.replyHelp}</p><ManualReply id={recipient.id} org={org} /></details>}
    </article>)}
  </div>;
}
function ManualReply({id,org}:{id:number;org:number}){
  const {currentLanguage}=useTranslation();const m=campaignMessages(currentLanguage);const client=useQueryClient();
  const fingerprint=useRef<{value:string;requestId:string}>();const [decision,setDecision]=useState('INTERESTED');
  const reply=useMutation({mutationFn:({requestId,decision,message}:{requestId:string;decision:string;message:string})=>baitlyCampaignsApi.respond(id,{requestId,decision,message}),onSuccess:()=>client.invalidateQueries({queryKey:['prospects',org,'campaigns']})});
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);const payload={decision,message:String(form.get('message'))};const value=JSON.stringify(payload);if(fingerprint.current?.value!==value)fingerprint.current={value,requestId:crypto.randomUUID()};reply.mutate({...payload,requestId:fingerprint.current.requestId});}
  return <form onSubmit={submit} className="max-w-2xl space-y-3"><fieldset disabled={reply.isPending} className="space-y-3">
    <label className="block">{m.decision}<select aria-label={m.decision} className="mt-1 block w-full cursor-pointer rounded-md border border-border bg-background p-2 text-foreground" value={decision} onChange={e=>setDecision(e.target.value)}>{['INTERESTED','NOT_INTERESTED','QUESTION','UNSUBSCRIBE'].map(code=><option key={code} value={code}>{campaignLabel(code,currentLanguage)}</option>)}</select></label>
    <label className="block">{m.note}<Textarea name="message" required={decision==='QUESTION'} maxLength={4000} rows={3} /></label>
    {['NOT_INTERESTED','UNSUBSCRIBE'].includes(decision)&&<p className="text-muted-foreground">{m.responsePrivacy}</p>}
    <Button type="submit" variant="outline" className="cursor-pointer" disabled={reply.isPending}>{m.record}</Button>
  </fieldset>{reply.isError&&<Failure />}{reply.isSuccess&&<p role="status">{m.recorded}</p>}</form>;
}

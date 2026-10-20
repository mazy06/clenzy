import {useCallback,useLayoutEffect,useRef,useState} from 'react';
import {Button,Skeleton} from '../../components/ui';
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {useAuth} from "../../hooks/useAuth";
import {baitlyCrmLocationReviewApi,type BaitlyLocationProgress} from "../../services/api/baitlyCrmLocationReviewApi";
import {locationReviewKey,reviewCopy} from "./BaitlyCrmReviewResume";
import {useTranslation} from '../../hooks/useTranslation';
import {prospectionMessages} from '../../i18n/baitlyProspectionMessages';
import {contactKind,type BaitlyCrmContact} from './baitlyCrmWorkspace';
import BaitlyCrmLocationEditor,{type BaitlyCrmLocationPoint} from './BaitlyCrmLocationEditor';
import {BaitlyCrmKindIcon} from './BaitlyCrmContactCard';

export interface BaitlyCrmMapPreview {contact:BaitlyCrmContact;point:BaitlyCrmLocationPoint}
/** Only the displayed contact is searched; every save remains explicit. */
type MatchingProps={contacts:BaitlyCrmContact[];org:number;onPreview:(preview:BaitlyCrmMapPreview|null)=>void;onBusyChange:(busy:boolean)=>void;onClose:()=>void;mode?:'manual'|'imported'};
export default function BaitlyCrmMapMatching(props:MatchingProps){
 const {user}=useAuth();const {currentLanguage}=useTranslation();const m=prospectionMessages(currentLanguage);
 const progress=useQuery({queryKey:locationReviewKey(props.org,user?.id),queryFn:baitlyCrmLocationReviewApi.progress,enabled:props.mode==='imported',retry:false});
 if(props.mode==='imported'){
  if(progress.isPending)return <Skeleton className="h-48 w-full"/>;
  if(progress.isError)return <div role="alert">{m.locationError}<Button variant="outline" onClick={()=>progress.refetch()}>{m.locationRetry}</Button><Button variant="ghost" onClick={props.onClose}>{m.matchClose}</Button></div>;
  return <MatchingQueue {...props} initialProgress={progress.data}/>;
 }
 return <MatchingQueue {...props}/>;
}
function MatchingQueue({contacts,org,onPreview,onBusyChange,onClose,mode='manual',initialProgress}:MatchingProps&{initialProgress?:BaitlyLocationProgress}){
  const {currentLanguage}=useTranslation();const m=prospectionMessages(currentLanguage);
  const [remaining,setRemaining]=useState(()=>initialProgress?initialProgress.items.filter(item=>item.status==='PENDING').flatMap(item=>{const contact=contacts.find(contact=>contact.id===item.id);return contact?[contact]:[];}):contacts),[busy,setBusy]=useState(false),[saved,setSaved]=useState(0),[skipped,setSkipped]=useState(0);
  const client=useQueryClient();const {user}=useAuth();const [error,setError]=useState(false);const [mutating,setMutating]=useState(false);
  const q=reviewCopy[currentLanguage==='ar'?'ar':currentLanguage==='en'?'en':'fr'];
  const current=remaining[0];
  const root=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{const scroll=root.current?.closest('[data-map-list-scroll]');if(scroll)scroll.scrollTop=0;},[current?.id]);
  const preview=useCallback((point:BaitlyCrmLocationPoint|null)=>onPreview(point&&current?{contact:current,point}:null),[current,onPreview]);
  const setPending=useCallback((value:boolean)=>{setBusy(value);onBusyChange(value);},[onBusyChange]);
  const next=useCallback(async()=>{if(initialProgress){await client.fetchQuery({queryKey:locationReviewKey(org,user?.id),queryFn:baitlyCrmLocationReviewApi.progress,staleTime:0});}onPreview(null);setSaved(value=>value+1);setRemaining(value=>value.slice(1));setPending(false);},[onPreview,setPending,initialProgress,client,org,user?.id]);
  const skip=async()=>{if(!current)return;setError(false);setMutating(true);onBusyChange(true);try{if(initialProgress){const result=await baitlyCrmLocationReviewApi.skip(current.id);client.setQueryData(locationReviewKey(org,user?.id),result);}onPreview(null);setSkipped(value=>value+1);setRemaining(value=>value.slice(1));}catch{setError(true);}finally{setMutating(false);onBusyChange(false);}};
  return <div ref={root} className="bcrm-map-matching">
    {!initialProgress&&<div className="bcrm-map-matching__progress tabular-nums" role="status">{remaining.length} {m.matchRemaining} · {saved} {m.matchSaved} · {skipped} {m.matchSkipped}</div>}
    {current?<><header className="bcrm-map-matching__heading"><span className="bcrm-contact__avatar" data-kind={contactKind(current)}><BaitlyCrmKindIcon contact={current}/></span><div><h3>{current.name}</h3><small>{m[`${contactKind(current)}Label`]}</small></div></header>
      <BaitlyCrmLocationEditor key={current.id} id={current.id} org={org} canManage contact={current} mapSession={{onPreview:preview,onSaved:next,onBusyChange:setPending,searchMode:mode,persistentReview:!!initialProgress}} />
      <Button variant="outline" size="sm" disabled={busy||mutating} className="cursor-pointer" onClick={()=>void skip()}>{m.matchSkip}</Button>
    </>:<p role="status">{m.matchFinished}</p>}
    {error&&<p role="alert">{q.error}</p>}
    <Button variant="ghost" size="sm" disabled={busy||mutating} className="cursor-pointer" onClick={onClose}>{m.matchClose}</Button>
  </div>;
}

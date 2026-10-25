import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';
import { assistantApi, type ConversationSummary } from '../../../services/api/assistantApi';
import { Button } from '../../../components/ui/button';
import { createBaitlyChatCandidate } from './baitly/createBaitlyChatCandidate';
import { BaitlyChatCandidate } from './baitly/BaitlyChatCandidate';
import { SUPERVISION_OPERATOR_ROLES } from '../roles';

/** Same authorized route, native protocol and renderers; no second execution engine. */
export default function SupervisionAgUiSpike() {
  const { user, hasAnyRole } = useAuth();
  const { t } = useTranslation();
  const [params,setParams]=useSearchParams();
  const navigate=useNavigate();
  const raw=params.get('conversation');
  const selected=raw && /^[1-9][0-9]*$/.test(raw) && Number.isSafeInteger(Number(raw))?Number(raw):null;
  const authScope=`${user?.id ?? ''}:${user?.organizationId ?? ''}`;
  const [history,setHistory]=useState<{scope:string;items:ConversationSummary[]}>({scope:'',items:[]});
  const conversations=history.scope===authScope?history.items:[];
  const [failure,setFailure]=useState(false);
  const [session,setSession]=useState(0);
  const adapter=useMemo(()=>createBaitlyChatCandidate(selected,4*1024*1024),[selected,user?.id,user?.organizationId,session]);
  const snapshot=useSyncExternalStore(adapter.subscribe,adapter.getSnapshot,adapter.getSnapshot);
  useEffect(()=>{
    if(selected===null && adapter.conversation!==null && !['running','restoring'].includes(snapshot.phase))
      setParams({conversation:String(adapter.conversation)},{replace:true});
  },[selected,adapter,snapshot.phase,setParams]);
  const allowed=hasAnyRole([...SUPERVISION_OPERATOR_ROLES]);
  const newConversation=()=>{setParams({});setSession(value=>value+1);};
  useEffect(()=>{
    let active=true;
    setHistory({scope:authScope,items:[]}); setFailure(false);
    if(allowed && user) void assistantApi.listConversations(0,100).then(page=>{
      if(active) setHistory({scope:authScope,items:page.content});
    }).catch(()=>{if(active) setFailure(true);});
    return ()=>{active=false;adapter.stop();};
  },[allowed,user?.id,user?.organizationId,adapter,authScope]);
  if(!allowed || !user) return <p role="alert">{t('baitlyChatCandidate.accessDenied')}</p>;
  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <h1 className="text-lg font-semibold">{t('baitlyChatCandidate.title')}</h1>
      <label className="flex flex-col gap-1 text-sm">
        <span>{t('baitlyChatCandidate.conversations')}</span>
        <select className="max-w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 focus-visible:outline-2" value={selected ?? ''}
          onChange={event=>event.target.value?setParams({conversation:event.target.value}):newConversation()}>
          <option value="">{t('baitlyChatCandidate.newConversation')}</option>
          {selected && !conversations.some(c=>c.id===selected) && <option value={selected}>{t('baitlyChatCandidate.conversation')} {selected}</option>}
          {conversations.map(c=><option key={c.id} value={c.id}>{c.title || `${t('baitlyChatCandidate.conversation')} ${c.id}`}</option>)}
        </select>
      </label>
      <Button variant="outline" onClick={newConversation}>{t('baitlyChatCandidate.newConversation')}</Button>
    </header>
    {failure && <p role="alert" className="text-sm text-muted-foreground">{t('baitlyChatCandidate.historyUnavailable')}</p>}
    <BaitlyChatCandidate key={`${user.id}:${user.organizationId}:${selected}:${session}`} adapter={adapter} onNavigate={navigate}/>
  </main>;
}

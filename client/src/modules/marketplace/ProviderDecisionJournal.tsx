import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import apiClient from '../../services/apiClient';
import PagePagination from '../../components/PagePagination';
import { Skeleton } from '../../components/ui';

interface Decision { id:number; at:string; actor:string|null; kind:string; before:string|null; after:string|null }
export default function ProviderDecisionJournal({providerId}:{providerId:number}) {
  const {user}=useAuth();
  const {t,currentLanguage}=useTranslation();
  const [page,setPage]=useState(0);
  const query=useQuery({
    queryKey:['marketplace-providers','decisions',providerId,user?.id,user?.organizationId,page],
    queryFn:()=>apiClient.get<{content:Decision[];totalPages:number}>(`/admin/marketplace/providers/${providerId}/decisions?page=${page}`),
    enabled:!!user,refetchInterval:30_000,
  });
  const describe=(value:string|null) => {
    if(value===null) return t('providerJournal.none');
    const [state,organization]=value.split(':');
    return t('providerJournal.values.'+state,state)+(organization ? ' · '+(organization==='null' ? t('providerJournal.global') : t('providerJournal.organization',{id:organization})) : '');
  };
  return <details className="border-t border-border pt-3">
    <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary">{t('providerJournal.title')}</summary>
    {query.isPending ? <Skeleton className="mt-3 h-20 w-full"/> : query.isError
      ? <p role="alert" className="text-sm text-destructive-ink">{t('marketplaceWorkflow.loadFailed')}</p>
      : <>
        <p className="mt-2 text-xs text-muted-foreground">{t('providerJournal.help')}</p>
        {!query.data.content.length && <p className="text-sm">{t('providerJournal.empty')}</p>}
        <ol className="mt-3 flex list-none flex-col gap-3 p-0">
          {query.data.content.map(entry=><li key={entry.id} className="text-sm">
            <p className="font-medium">{t('providerJournal.kinds.'+entry.kind,entry.kind)}</p>
            <p>{describe(entry.before)} → {describe(entry.after)}</p>
            <p className="text-xs text-muted-foreground"><time dateTime={entry.at} className="tabular-nums">{new Date(entry.at).toLocaleString(currentLanguage)}</time>
              {' · '}{t('providerJournal.actor',{actor:entry.actor ?? t('providerJournal.unknown')})}</p>
          </li>)}
        </ol>
        <PagePagination page={page} onPageChange={setPage} totalPages={query.data.totalPages}/>
      </>}
  </details>;
}


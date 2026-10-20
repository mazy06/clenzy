import {useEffect} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../../hooks/useAuth';
import {baitlyCrmEnrichmentRunsApi} from '../../services/api/baitlyCrmEnrichmentRunsApi';

/** The server owns execution and progress. Leaving the screen only stops observation. */
export function useBaitlyCrmEnrichment(ids?:readonly number[],organizationId?:number,locationOnly=false,enabled=true){
 const client=useQueryClient();const {user}=useAuth();const org=organizationId??user?.organizationId;
 const key=['prospects',org,user?.id,'enrichment-run'];
 const progress=useQuery({queryKey:key,queryFn:baitlyCrmEnrichmentRunsApi.latest,enabled:enabled&&!!org&&!!user?.id,
  refetchOnMount:'always',refetchInterval:query=>query.state.data?.run?.status==='RUNNING'?2000:false});
 const start=useMutation({retry:false,mutationFn:()=>baitlyCrmEnrichmentRunsApi.start(ids,locationOnly),
  onMutate:()=>client.cancelQueries({queryKey:key}),
  onSuccess:data=>client.setQueryData(key,data)});
 const stop=useMutation({retry:false,mutationFn:async()=>{const run=progress.data?.run;if(run)await baitlyCrmEnrichmentRunsApi.cancel(run.id);},
  onSuccess:()=>client.invalidateQueries({queryKey:key})});
 const run=enabled?progress.data?.run:undefined;
 useEffect(()=>{
  if(!run)return;
  void client.invalidateQueries({predicate:query=>query.queryKey[0]==='prospects'&&query.queryKey[1]===org&&(query.queryKey.includes('locations')||query.queryKey.includes('location-review'))});
  if(run.status!=='RUNNING')void client.invalidateQueries({predicate:query=>query.queryKey[0]==='prospects'&&query.queryKey[1]===org
   &&!query.queryKey.includes('enrichment-run')&&!query.queryKey.includes('osm-imported')&&!query.queryKey.includes('enqueue')});
 },[client,org,run?.id,run?.confirmed,run?.status]);
 const summary=run?{confirmed:run.confirmed,review:run.review,pending:run.pending+run.failed}:null;
 return {summary,isLoading:progress.isLoading,cancel:()=>stop.mutate(),enrich:{
  mutate:()=>start.mutate(),isPending:start.isPending||run?.status==='RUNNING',
  isSuccess:!!run&&run.status!=='RUNNING'&&!start.isPending,
  isError:enabled&&(start.isError||progress.isError||stop.isError),
  error:start.error??progress.error??stop.error??new Error('Enrichment unavailable'),
  submittedAt:run?Number.parseInt(run.id.replaceAll('-','').slice(0,8),16):start.submittedAt,
  data:run&&summary?{total:run.total,unavailable:run.unavailable,cancelled:run.status==='CANCELLED',summary}:undefined,
 }};
}

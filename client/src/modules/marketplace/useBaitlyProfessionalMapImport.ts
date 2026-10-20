import {useEffect,useRef,useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {crmProfessionalImportsApi} from '../../services/api/baitlyProfessionalDirectoryApi';

/** Selection survives viewport/filter changes but never a change of organization or access. */
export function useBaitlyProfessionalMapImport(org:number|undefined,enabled:boolean){
 const client=useQueryClient();const [selected,setSelected]=useState<Set<number>>(()=>new Set());const [mode,setMode]=useState(false);
 const scope=useRef(org);scope.current=org;
 const request=useMutation({mutationFn:(ids:readonly number[])=>crmProfessionalImportsApi.importReferences(ids),retry:false,
  onMutate:()=>org,
  onSuccess:(_result,ids,organization)=>{void client.invalidateQueries({queryKey:['prospects']});if(organization===scope.current)setSelected(previous=>new Set([...previous].filter(id=>!ids.includes(id))));}});
 useEffect(()=>{setSelected(new Set());setMode(false);request.reset();},[org,enabled,request.reset]);
 const canImport=enabled&&org!==undefined;
 return {selected,mode,setMode,request,canImport,
  toggle:(id:number)=>{if(!canImport||request.isPending)return;request.reset();setSelected(previous=>{const next=new Set(previous);if(next.has(id))next.delete(id);else if(next.size<100)next.add(id);return next;});},
  toggleLoaded:(ids:number[])=>{if(!canImport||request.isPending)return;request.reset();setSelected(previous=>{const next=new Set(previous),batch=[...new Set(ids)].slice(0,100);if(batch.every(id=>next.has(id)))batch.forEach(id=>next.delete(id));else for(const id of batch){if(next.size>=100)break;next.add(id);}return next;});},
  clear:()=>{if(!request.isPending){request.reset();setSelected(new Set());}},
  submit:()=>{if(canImport&&selected.size&&!request.isPending)request.mutate([...selected]);},
 };
}

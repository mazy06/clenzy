import {afterEach,expect,it,vi} from 'vitest';
import {baitlyCrmEnrichmentRunsApi as api} from '../../services/api/baitlyCrmEnrichmentRunsApi';
import {enrichImportedContacts} from './baitlyEnrichImportedContacts';
const results=[{siret:'1',name:'Atlas',id:1,status:'CREATED' as const},{siret:'2',name:'Other',id:2,status:'EXISTING' as const}];
const run={id:'job',status:'RUNNING' as const,locationOnly:false,total:2,confirmed:1,review:0,pending:1,unavailable:0,failed:0};
afterEach(()=>vi.restoreAllMocks());
it('starts one durable run for eligible imports without a browser processing loop',async()=>{
 const start=vi.spyOn(api,'start').mockResolvedValue({run});
 expect(await enrichImportedContacts([...results,{...results[0],status:'REVIEW'}],new AbortController().signal)).toEqual({confirmed:1,review:0,pending:1});
 expect(start).toHaveBeenCalledExactlyOnceWith([1,2],false);
});
it('closing the screen does not cancel a run already being created',async()=>{
 const controller=new AbortController(),progress=vi.fn(),cancel=vi.spyOn(api,'cancel');
 vi.spyOn(api,'start').mockImplementation(async()=>{controller.abort();return {run};});
 expect(await enrichImportedContacts(results,controller.signal,progress)).toEqual({confirmed:1,review:0,pending:1});expect(cancel).not.toHaveBeenCalled();expect(progress).not.toHaveBeenCalled();
});
it('preserves a successful import if the job service is temporarily unavailable',async()=>{
 vi.spyOn(api,'start').mockRejectedValue(new Error('unavailable'));
 expect(await enrichImportedContacts(results,new AbortController().signal)).toEqual({confirmed:0,review:0,pending:2});
});

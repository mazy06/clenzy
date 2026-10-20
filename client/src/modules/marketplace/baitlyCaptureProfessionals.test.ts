import {afterEach,expect,it,vi} from 'vitest';
import {crmProfessionalImportsApi} from '../../services/api/baitlyProfessionalDirectoryApi';
import {collectCrmProfessionals} from './baitlyCaptureProfessionals';
const input={query:'',communeCode:'44109',service:'CLEANING' as const};
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});
it('collects pages automatically and keeps each source ticket while deduplicating SIRET',async()=>{
 vi.useFakeTimers();const source=vi.spyOn(crmProfessionalImportsApi,'discover').mockResolvedValueOnce({ticket:'first',candidates:[{siret:'1'} as any],hasNext:true}).mockResolvedValueOnce({ticket:'next',candidates:[{siret:'1'} as any,{siret:'2'} as any],hasNext:false});
 const progress=vi.fn();const result=collectCrmProfessionals(input,new AbortController().signal,progress);await vi.runAllTimersAsync();
 expect(await result).toEqual({choices:[{ticket:'first',index:0},{ticket:'next',index:1}],hasMore:false});expect(source).toHaveBeenCalledTimes(2);expect(progress).toHaveBeenLastCalledWith(2);
});
it('bounds a click to 100 unique professionals even when the source has more pages',async()=>{
 vi.useFakeTimers();vi.spyOn(crmProfessionalImportsApi,'discover').mockImplementation(async ({page})=>({ticket:`page-${page}`,candidates:Array.from({length:30},(_,index)=>({siret:`${page}:${index}`} as any)),hasNext:true}));
 const result=collectCrmProfessionals(input,new AbortController().signal,vi.fn());await vi.runAllTimersAsync();const collected=await result;
 expect(collected.choices).toHaveLength(100);expect(collected.hasMore).toBe(true);expect(crmProfessionalImportsApi.discover).toHaveBeenCalledTimes(4);
});
it('stops before collecting another page when the screen is closed',async()=>{
 vi.useFakeTimers();const controller=new AbortController();const source=vi.spyOn(crmProfessionalImportsApi,'discover').mockResolvedValue({ticket:'first',candidates:[],hasNext:true});
 const result=collectCrmProfessionals(input,controller.signal,()=>controller.abort());const rejected=expect(result).rejects.toMatchObject({name:'AbortError'});await vi.runAllTimersAsync();await rejected;expect(source).toHaveBeenCalledTimes(1);
});
it('retries rate limiting finitely and never turns a source error into a partial import',async()=>{
 vi.useFakeTimers();const source=vi.spyOn(crmProfessionalImportsApi,'discover').mockRejectedValue({status:429});const importSpy=vi.spyOn(crmProfessionalImportsApi,'importBatch');
 const result=collectCrmProfessionals(input,new AbortController().signal,vi.fn());const rejected=expect(result).rejects.toMatchObject({status:429});await vi.runAllTimersAsync();await rejected;expect(source).toHaveBeenCalledTimes(3);expect(importSpy).not.toHaveBeenCalled();
});

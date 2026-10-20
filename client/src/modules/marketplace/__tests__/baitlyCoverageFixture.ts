import {vi} from 'vitest';
import {professionalDirectoryApi as api} from '../../../services/api/baitlyProfessionalDirectoryApi';
import {baitlyDirectoryActivity} from '../../../config/baitlyDirectoryActivities';
import {matchesDirectoryContacts} from '../../../config/baitlyDirectoryContacts';

/** Default coverage fixture; tests of complete coverage override this independently. */
export function mockDirectoryCoverage(){
 vi.spyOn(api,'rankedMap').mockImplementation(async input=>{
  await Promise.resolve();
  if(input.after)return api.map(input);
  const call=vi.mocked(api.map).mock.results.at(-1);
  return call?.type==='return'?await call.value:{items:[],nextCursor:null};
 });
 vi.spyOn(api,'clusters').mockImplementation(async input=>{
  await Promise.resolve();
  const call=vi.mocked(api.map).mock.results.at(-1);
  const page=call?.type==='return'?await call.value:undefined;
  const rows=(page?.items??[]).filter(row=>(!input.service||baitlyDirectoryActivity(row.activity)===input.service)&&matchesDirectoryContacts(row,input.contacts));
  return {total:rows.length,clusters:rows.map((row,index)=>({key:`${index%12}:${Math.floor(index/12)%8}`,count:1,latitude:row.latitude!,longitude:row.longitude!,west:row.longitude!,south:row.latitude!,east:row.longitude!,north:row.latitude!,representativeId:row.id}))};
 });
}

import {vi} from 'vitest';
import {professionalDirectoryApi as api} from '../../../services/api/baitlyProfessionalDirectoryApi';
import {baitlyDirectoryActivity} from '../../../config/baitlyDirectoryActivities';
import {matchesDirectoryContacts} from '../../../config/baitlyDirectoryContacts';

/** Default coverage fixture; tests of complete coverage override this independently. */
export function mockDirectoryCoverage(){
 vi.spyOn(api,'mapIndex').mockResolvedValue({revision:1,indexedRevision:0,spatial:false});
 vi.spyOn(api,'rankedMap').mockImplementation((input,signal)=>api.map(input,signal));
 vi.spyOn(api,'clusters').mockImplementation(async input=>{
  await Promise.resolve();
  const call=vi.mocked(api.map).mock.results.at(-1);
  const page=call?.type==='return'?await call.value:undefined;
  const rows=(page?.items??[]).filter(row=>(!input.service||input.service.split(',').includes(row.service??baitlyDirectoryActivity(row.activity)??''))&&matchesDirectoryContacts(row,input.contacts));
  return {total:rows.length,clusters:rows.map((row,index)=>({key:`${index%12}:${Math.floor(index/12)%8}`,count:1,latitude:row.latitude!,longitude:row.longitude!,west:row.longitude!,south:row.latitude!,east:row.longitude!,north:row.latitude!,representativeId:row.id}))};
 });
}

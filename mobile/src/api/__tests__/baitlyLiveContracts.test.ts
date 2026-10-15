import { baitlyMediaList, baitlyMediaUrl } from '../baitlyMedia';
import { normalizeIntervention,interventionsApi } from '../endpoints/interventionsApi';
import { apiClient } from '../apiClient';
import { normalizeMobileWork, type MobileWork } from '@/features/missions/api';
import { providerMapPoint, mapCityKey } from '@/features/marketplace/baitlyMapDomain';
import type { CatalogProvider } from '@/features/marketplace/api';
import { normalizeTeam } from '../endpoints/teamsApi';
import { normalizeServiceRequest } from '../endpoints/serviceRequestsApi';
import { guestReviewSummary } from '@/features/marketplace/baitlyDemoClients';

it('reads real JSON photo arrays and resolves media paths against the configured backend',()=>{
  expect(baitlyMediaList('["/api/image","data:image/jpeg;base64,YQ=="]')).toEqual(['http://localhost:8080/api/image','data:image/jpeg;base64,YQ==']);
  expect(baitlyMediaList('invalid')).toEqual([]);expect(baitlyMediaUrl('javascript:alert(1)')).toBeNull();
  const result=normalizeIntervention({id:1,beforePhotosUrls:'["/api/image"]'} as any);
  expect(result.beforePhotosUrls).toEqual(['http://localhost:8080/api/image']);
});
it('uses authoritative start and pause instants instead of treating the scheduled date as a running timer',()=>{
  const work={mission:{id:1,status:'PENDING',startTime:'2026-10-13T12:00:00'},startedAt:null,pausedAt:null,pauseSeconds:0} as MobileWork;
  expect(normalizeMobileWork(work).mission.startTime).toBeUndefined();
  expect(normalizeMobileWork({...work,startedAt:'2026-10-13T10:00:00Z',pausedAt:'2026-10-13T10:30:00Z',pauseSeconds:20}).mission)
    .toMatchObject({startTime:'2026-10-13T10:00:00Z',pausedAt:'2026-10-13T10:30:00Z',pauseSeconds:20});
});
it('does not position a provider in a same-named city in another country',()=>{
  const provider={id:1,baseCity:'Paris',baseCountryCode:'FR',coverageCities:[]} as unknown as CatalogProvider;
  const positions={[mapCityKey('Paris','US')]:{latitude:33.66,longitude:-95.55}};
  expect(providerMapPoint(provider,positions)).toBeNull();
  expect(providerMapPoint(provider,{...positions,[mapCityKey('Paris','FR')]:{latitude:48.85,longitude:2.35}})?.latitude).toBe(48.85);
});
it('maps the real team, assignment and property DTO fields instead of showing missing names',()=>{
  expect(normalizeTeam({id:1,name:'Centre',coverageZones:[{city:'Marrakech',country:'MA'}],members:[{userId:2,firstName:'Salma',lastName:'A.',role:'HOUSEKEEPER'}]} as any))
    .toMatchObject({coverageZone:'Marrakech · MA',members:[{userId:2,userName:'Salma A.'}]});
  expect(normalizeIntervention({id:1,assignedToName:'Centre',assignedToType:'TEAM',assignedToId:9} as any)).toMatchObject({assignedTechnicianName:'Centre',teamName:'Centre'});
  expect(normalizeServiceRequest({id:1,property:{id:3,name:'Villa'}} as any)).toMatchObject({propertyId:3,propertyName:'Villa'});
});
it('uses aggregate review totals rather than treating a loaded comment sample as the entire rating',()=>{
  expect(guestReviewSummary([{guestReviews:[{rating:1}],guestRatingCount:100,guestRatingAvg:4.9}])).toEqual({count:100,average:4.9});
});
it('uses existing lifecycle and assignment endpoints with their actual parameter contracts',async()=>{
  const put=jest.spyOn(apiClient,'put').mockResolvedValue({id:1});
  const post=jest.spyOn(apiClient,'post').mockResolvedValue({id:1});
  try{
    await interventionsApi.assign(1,9);expect(put).toHaveBeenLastCalledWith('/interventions/1/assign',undefined,{params:{teamId:9}});
    await interventionsApi.updateStatus(1,'CANCELLED');expect(put).toHaveBeenLastCalledWith('/interventions/1/status',undefined,{params:{status:'CANCELLED'}});
    await interventionsApi.start(1);expect(put).toHaveBeenLastCalledWith('/interventions/1/start');
    await interventionsApi.complete(1);expect(put).toHaveBeenLastCalledWith('/interventions/1/complete');
    await interventionsApi.updateCost(1,undefined,90);expect(put).toHaveBeenLastCalledWith('/interventions/1/amount',{mode:'SET',value:90});
    await interventionsApi.managerReview(1,{decision:'reject',feedback:'Reprendre la cuisine',version:3});
    expect(post).toHaveBeenLastCalledWith('/mobile/missions/1/manager-review',{decision:'reject',feedback:'Reprendre la cuisine',version:3});
  }finally{put.mockRestore();post.mockRestore();}
});

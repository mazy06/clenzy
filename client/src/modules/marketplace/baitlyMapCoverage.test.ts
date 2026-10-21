import {expect,it} from 'vitest';
import {mergeMapArea,nextMapArea,nextMapAreaBatch,loadMapAreaBatch} from './baitlyMapCoverage';
import type {ReferencedProfessional} from '../../services/api/baitlyProfessionalDirectoryApi';

const bounds={west:0,south:0,east:10,north:10};
it('plans all four missing bands as a single parallel batch',()=>{
 const batch=nextMapAreaBatch({west:-5,south:-5,east:15,north:15},[{bounds,after:0,nextCursor:null}])!;
 expect(batch.after).toBe(0);expect(batch.additionalBounds).toHaveLength(3);
});
it('loads a batch in parallel with at most four requests and keeps the response order',async()=>{
 let active=0,maximum=0;
 const batch={bounds,after:0,additionalBounds:Array.from({length:7},(_,index)=>({...bounds,west:index+1}))};
 const pages=await loadMapAreaBatch(batch,async request=>{
  active++;maximum=Math.max(maximum,active);await Promise.resolve();active--;return request.bounds.west;
 });
 expect(maximum).toBe(4);expect(pages.map(({page})=>page)).toEqual([0,1,2,3,4,5,6,7]);
});
it('requests only the uncovered band after panning and nothing when returning to a complete area',()=>{
 const areas=[{bounds,after:0,nextCursor:null}];
 expect(nextMapArea({west:5,south:0,east:15,north:10},areas)).toEqual({bounds:{west:10,south:0,east:15,north:10},after:0});
 expect(nextMapArea({west:2,south:2,east:8,north:8},areas)).toBeUndefined();
});
it('fills the four newly visible bands when zooming out without requesting the center again',()=>{
 const viewport={west:-5,south:-5,east:15,north:15};
 const areas=[{bounds,after:0,nextCursor:null as number|null}];
 const requested=[];
 for(let i=0;i<4;i++){
  const next=nextMapArea(viewport,areas)!;expect(next).toBeDefined();requested.push(next.bounds);
  areas.push({...next,nextCursor:null});
 }
 expect(nextMapArea(viewport,areas)).toBeUndefined();
 expect(requested).toHaveLength(4);
 expect(requested.reduce((sum,b)=>sum+(b.east-b.west)*(b.north-b.south),0)).toBe(300);
});
it('keeps partial coverage pageable and requests a closer viewport instead of assuming it complete',()=>{
 const areas=[{bounds,after:0,nextCursor:200}];
 expect(nextMapArea(bounds,areas)).toEqual({bounds,after:200});
 const closer={west:2,south:2,east:4,north:4};
 expect(nextMapArea(closer,areas)).toEqual({bounds:closer,after:0});
});
it('splits a viewport crossing the date line into valid requests',()=>{
 expect(nextMapArea({west:170,south:-10,east:-170,north:10},[])).toEqual({bounds:{west:170,south:-10,east:180,north:10},after:0});
});
it('deduplicates businesses without reordering them and does not regress a pagination checkpoint on refresh',()=>{
 const first={id:1,name:'Premier'} as ReferencedProfessional,second={id:2,name:'Second'} as ReferencedProfessional;
 let snapshot=mergeMapArea(undefined,{bounds,after:0},{items:[first],nextCursor:1});
 snapshot=mergeMapArea(snapshot,{bounds,after:1},{items:[second],nextCursor:null});
 snapshot=mergeMapArea(snapshot,{bounds,after:0},{items:[{...first,name:'Actualisé'}],nextCursor:1});
 expect(snapshot.rows.map(row=>row.name)).toEqual(['Actualisé','Second']);
 expect(snapshot.areas).toEqual([{bounds,after:1,nextCursor:null}]);
});

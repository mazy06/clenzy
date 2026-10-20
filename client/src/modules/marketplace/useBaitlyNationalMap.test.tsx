import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {ReactNode} from 'react';
import {professionalDirectoryApi as api,type ReferencedProfessional} from '../../services/api/baitlyProfessionalDirectoryApi';
import {useBaitlyNationalMap} from './useBaitlyNationalMap';

const first={id:1,name:'Entreprise déjà chargée',activity:'81.21Z',latitude:47,longitude:2,phone:'0102030405',email:null} as ReferencedProfessional;
const second={...first,id:2,name:'Nouvelle entreprise',longitude:12};
const initial={west:-5.5,south:41,east:10,north:51.5};
const expanded={west:5,south:45,east:15,north:48};
function setup(ranked=false){
 const cache=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const wrapper=({children}:{children:ReactNode})=><QueryClientProvider client={cache}>{children}</QueryClientProvider>;
 return {...renderHook(()=>useBaitlyNationalMap(true,'','FR',ranked),{wrapper}),cache};
}
beforeEach(()=>{
 vi.spyOn(api,'clusters').mockResolvedValue({clusters:[],total:0});
 vi.spyOn(api,'synchronization').mockResolvedValue({enabled:true,phase:'ESTABLISHMENTS',published:0});
 vi.spyOn(api,'map').mockResolvedValue({items:[first],nextCursor:null});
 vi.spyOn(api,'rankedMap').mockResolvedValue({items:[first],nextCursor:null});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers();});
it('requests server ranking before pagination and preserves cached rows and the list key on sort changes',async()=>{
 vi.mocked(api.rankedMap).mockImplementation(async input=>({items:input.after?[second]:[first],nextCursor:input.after?null:1}));
 const view=setup(true);await waitFor(()=>expect(view.result.current.listResult.hasNextPage).toBe(true));
 expect(api.rankedMap).toHaveBeenLastCalledWith(expect.objectContaining({sort:'PROXIMITY',after:0,bounds:initial}),expect.any(AbortSignal));
 const key=view.result.current.resetKey;
 await act(async()=>{await view.result.current.listResult.fetchNextPage();});
 expect(api.rankedMap).toHaveBeenLastCalledWith(expect.objectContaining({sort:'PROXIMITY',after:1}),expect.any(AbortSignal));
 act(()=>view.result.current.setSort('CONTACTS'));
 await waitFor(()=>expect(api.rankedMap).toHaveBeenLastCalledWith(expect.objectContaining({sort:'CONTACTS',after:0}),expect.any(AbortSignal)));
 expect(view.result.current.rows.map(row=>row.id)).toEqual([1,2]);
 expect(view.result.current.resetKey).toBe(key);
 const calls=vi.mocked(api.rankedMap).mock.calls.length;
 act(()=>view.result.current.onCoverageBoundsChange(expanded));
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,250));});
 expect(api.rankedMap).toHaveBeenCalledTimes(calls);
});
it('refreshes complete coverage for a selection recenter without reloading detail pages',async()=>{
 const view=setup();await waitFor(()=>expect(view.result.current.rows).toHaveLength(1));
 const calls=vi.mocked(api.map).mock.calls.length,key=view.result.current.resetKey;
 act(()=>view.result.current.onCoverageBoundsChange(expanded));
 await waitFor(()=>expect(api.clusters).toHaveBeenLastCalledWith(expect.objectContaining({bounds:expanded}),expect.any(AbortSignal)));
 expect(api.map).toHaveBeenCalledTimes(calls);expect(view.result.current.resetKey).toBe(key);
 expect(view.result.current.rows).toEqual([first]);
});
it('does not add businesses from periodic polling while the map is idle',async()=>{
 const view=setup();await waitFor(()=>expect(view.result.current.rows).toHaveLength(1));await waitFor(()=>expect(view.result.current.result.isFetching).toBe(false));
 const requests=vi.mocked(api.map).mock.calls.length;
 vi.mocked(api.map).mockResolvedValue({items:[second],nextCursor:null});
 vi.useFakeTimers();await act(async()=>{await vi.advanceTimersByTimeAsync(120_000);});
 expect(api.map).toHaveBeenCalledTimes(requests);expect(view.result.current.rows).toEqual([first]);
});
it('keeps rows and the list reset key while loading only the newly exposed band, then reuses it',async()=>{
 let complete!:(page:{items:ReferencedProfessional[];nextCursor:null})=>void;
 const view=setup();await waitFor(()=>expect(view.result.current.rows).toHaveLength(1));
 const resetKey=view.result.current.resetKey;
 vi.mocked(api.map).mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
 act(()=>view.result.current.onBoundsChange(expanded));
 await waitFor(()=>expect(api.map).toHaveBeenLastCalledWith(expect.objectContaining({bounds:{west:10,south:45,east:15,north:48},after:0}),expect.any(AbortSignal)));
 expect(view.result.current.rows).toEqual([first]);expect(view.result.current.resetKey).toBe(resetKey);
 await act(async()=>complete({items:[first,second],nextCursor:null}));
 await waitFor(()=>expect(view.result.current.rows).toEqual([first,second]));
 const calls=vi.mocked(api.map).mock.calls.length;
 act(()=>view.result.current.onBoundsChange(initial));
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,400));});
 expect(api.map).toHaveBeenCalledTimes(calls);expect(view.result.current.rows).toEqual([first,second]);
});
it('does not treat the first page as complete and resumes its saved cursor',async()=>{
 vi.mocked(api.map).mockResolvedValueOnce({items:[first],nextCursor:1}).mockResolvedValue({items:[second],nextCursor:null});
 const view=setup();await waitFor(()=>expect(view.result.current.rows).toHaveLength(1));
 expect(view.result.current.result.hasNextPage).toBe(true);
 await act(async()=>{await view.result.current.result.fetchNextPage();});
 expect(api.map).toHaveBeenLastCalledWith(expect.objectContaining({bounds:initial,after:1}),expect.any(AbortSignal));
 await waitFor(()=>expect(view.result.current.rows).toEqual([first,second]));
});
it('retains loaded rows after a failed area request and retries without duplicates',async()=>{
 const view=setup();await waitFor(()=>expect(view.result.current.rows).toHaveLength(1));
 vi.mocked(api.map).mockRejectedValueOnce(new Error('Indisponible'));
 act(()=>view.result.current.onBoundsChange(expanded));
 await waitFor(()=>expect(view.result.current.result.isError).toBe(true));
 expect(view.result.current.rows).toEqual([first]);
 vi.mocked(api.map).mockResolvedValue({items:[second],nextCursor:null});
 await act(async()=>{await view.result.current.result.fetchNextPage();});
 await waitFor(()=>expect(view.result.current.rows).toEqual([first,second]));
});
it('isolates cached rows and coverage when a business filter changes',async()=>{
 const view=setup();await waitFor(()=>expect(view.result.current.rows).toHaveLength(1));
 vi.mocked(api.map).mockResolvedValue({items:[{...second,activity:'96.01B'}],nextCursor:null});
 act(()=>view.result.current.setService('LAUNDRY'));
 await waitFor(()=>expect(view.result.current.rows.map(row=>row.id)).toEqual([2]));
 expect(api.map).toHaveBeenLastCalledWith(expect.objectContaining({service:'LAUNDRY',after:0}),expect.any(AbortSignal));
 act(()=>view.result.current.setService(''));
 await waitFor(()=>expect(view.result.current.rows).toEqual([first]));
});

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
 vi.spyOn(api,'mapIndex').mockResolvedValue({revision:1,indexedRevision:0,spatial:false});
 vi.spyOn(api,'clusters').mockResolvedValue({clusters:[],total:0});
 vi.spyOn(api,'synchronization').mockResolvedValue({enabled:true,phase:'ESTABLISHMENTS',published:0});
 vi.spyOn(api,'map').mockResolvedValue({items:[first],nextCursor:null});
 vi.spyOn(api,'rankedMap').mockResolvedValue({items:[first],nextCursor:null});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers();});
it('unions selected services consistently in requests, tiles and loaded markers',async()=>{
 const laundry={...first,id:3,activity:'96.01B'},maintenance={...first,id:4,activity:'43.21A'};
 vi.mocked(api.rankedMap).mockResolvedValue({items:[first,laundry,maintenance],nextCursor:null});
 vi.mocked(api.mapIndex).mockResolvedValue({revision:2,indexedRevision:2,spatial:true});
 const view=setup(true);await waitFor(()=>expect(view.result.current.rows).toHaveLength(3));
 act(()=>view.result.current.setServices(['CLEANING','LAUNDRY']));
 await waitFor(()=>expect(view.result.current.rows).toEqual([first,laundry]));
 expect(view.result.current.markers.map(row=>row.id)).toEqual([-1,-3]);
 expect(view.result.current.tilesUrl).toContain('service=CLEANING%2CLAUNDRY');
 expect(api.rankedMap).toHaveBeenLastCalledWith(expect.objectContaining({service:'CLEANING,LAUNDRY'}),expect.any(AbortSignal));
 act(()=>view.result.current.setServices([]));await waitFor(()=>expect(view.result.current.rows).toHaveLength(3));
});
it('loads a country union with shared ranking and tiles, then removes deselected countries',async()=>{
 const cache=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const wrapper=({children}:{children:ReactNode})=><QueryClientProvider client={cache}>{children}</QueryClientProvider>;
 const ma={...first,id:3,country_code:'MA',activity:'',service:'CLEANING',latitude:34,longitude:-7} as ReferencedProfessional;
 const sa={...ma,id:4,country_code:'SA'} as ReferencedProfessional;
 vi.mocked(api.rankedMap).mockResolvedValue({items:[first,ma,sa],nextCursor:null});
 vi.mocked(api.mapIndex).mockResolvedValue({revision:2,indexedRevision:2,spatial:true});
 const view=renderHook(({country})=>useBaitlyNationalMap(true,'',country,true),{initialProps:{country:'FR,MA'},wrapper});
 await waitFor(()=>expect(view.result.current.rows).toEqual([first,ma]));
 expect(view.result.current.tilesUrl).toContain('country=FR%2CMA');
 expect(api.rankedMap).toHaveBeenLastCalledWith(expect.objectContaining({country:'FR,MA',bounds:{west:-17.2,south:20.7,east:10,north:51.5}}),expect.any(AbortSignal));
 view.rerender({country:'MA'});
 await waitFor(()=>expect(view.result.current.rows).toEqual([ma]));
 expect(view.result.current.tilesUrl).toContain('country=MA');
});
it('isolates country rows, service mapping and tile URLs when switching between France and Morocco',async()=>{
 const cache=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const wrapper=({children}:{children:ReactNode})=><QueryClientProvider client={cache}>{children}</QueryClientProvider>;
 const ma={...first,id:3,siret:null,country_code:'MA',identifier_type:'ICE',identifier:'001234567890123',activity:'',service:'CLEANING',latitude:34.02,longitude:-6.84} as ReferencedProfessional;
 vi.mocked(api.rankedMap).mockImplementation(async input=>({items:input.country==='MA'?[ma]:[first],nextCursor:null}));
 vi.mocked(api.mapIndex).mockResolvedValue({revision:2,indexedRevision:2,spatial:true});
 const view=renderHook(({country}:{country:'FR'|'MA'})=>useBaitlyNationalMap(true,'',country,true),{initialProps:{country:'FR'},wrapper});
 await waitFor(()=>expect(view.result.current.rows).toEqual([first]));
 view.rerender({country:'MA'});
 await waitFor(()=>expect(view.result.current.rows).toEqual([ma]));
 expect(view.result.current.tilesUrl).toContain('country=MA');
 expect(api.rankedMap).toHaveBeenLastCalledWith(expect.objectContaining({country:'MA',bounds:{west:-17.2,south:20.7,east:-.9,north:36.1}}),expect.any(AbortSignal));
 act(()=>view.result.current.setService('CLEANING'));
 await waitFor(()=>expect(view.result.current.rows).toEqual([ma]));
 expect(view.result.current.tilesUrl).toContain('service=CLEANING');
 view.rerender({country:'FR'});await waitFor(()=>expect(view.result.current.rows).toEqual([first]));
});
it('waits for the index version before requesting the single detail page',async()=>{
 let complete!:(value:{revision:number;indexedRevision:number;spatial:boolean})=>void;
 vi.mocked(api.mapIndex).mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));
 const view=setup(true);
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,180));});
 expect(api.rankedMap).not.toHaveBeenCalled();expect(api.map).not.toHaveBeenCalled();
 await act(async()=>complete({revision:1,indexedRevision:0,spatial:false}));
 await waitFor(()=>expect(view.result.current.rows).toHaveLength(1));
 expect(api.rankedMap).toHaveBeenCalledTimes(1);expect(api.map).not.toHaveBeenCalled();
});
it('uses just one detail request and vector tiles when the published spatial index is ready',async()=>{
 vi.mocked(api.mapIndex).mockResolvedValue({revision:2,indexedRevision:2,spatial:true});
 const view=setup(true);
 await waitFor(()=>expect(view.result.current.tilesUrl).toContain('revision=2'));
 await waitFor(()=>expect(view.result.current.rows).toHaveLength(1));
 expect(api.rankedMap).toHaveBeenCalledTimes(1);expect(api.map).not.toHaveBeenCalled();expect(api.clusters).not.toHaveBeenCalled();
 act(()=>view.result.current.onTilesError());
 await waitFor(()=>expect(api.clusters).toHaveBeenCalledTimes(1));
 expect(view.result.current.tilesUrl).toBeUndefined();expect(view.result.current.rows).toEqual([first]);
});
it('uses zoom hysteresis and keeps the vector layer until the close-up coverage is ready',async()=>{
 vi.mocked(api.mapIndex).mockResolvedValue({revision:2,indexedRevision:2,spatial:true});
 const view=setup(true);await waitFor(()=>expect(view.result.current.tilesUrl).toBeDefined());
 act(()=>view.result.current.onCoverageBoundsChange(initial,9.2));
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,180));});expect(view.result.current.tilesUrl).toBeDefined();
 let complete!:(value:{clusters:[];total:number})=>void;
 vi.mocked(api.clusters).mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
 act(()=>view.result.current.onCoverageBoundsChange(initial,9.6));
 await waitFor(()=>expect(api.clusters).toHaveBeenCalled());expect(view.result.current.tilesUrl).toBeDefined();
 await act(async()=>complete({clusters:[],total:0}));await waitFor(()=>expect(view.result.current.tilesUrl).toBeUndefined());
 act(()=>view.result.current.onCoverageBoundsChange(initial,9.2));
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,180));});expect(view.result.current.tilesUrl).toBeUndefined();
 act(()=>view.result.current.onCoverageBoundsChange(initial,8.4));await waitFor(()=>expect(view.result.current.tilesUrl).toBeDefined());
});
it('requests server ranking before pagination and preserves cached rows and the list key on sort changes',async()=>{
 vi.mocked(api.rankedMap).mockImplementation(async input=>({items:input.after?[second]:[first],nextCursor:input.after?null:1}));
 const view=setup(true);await waitFor(()=>expect(view.result.current.listResult.hasNextPage).toBe(true));
 expect(api.rankedMap).toHaveBeenLastCalledWith(expect.objectContaining({sort:'PROXIMITY',after:0,bounds:initial}),expect.any(AbortSignal));
 const key=view.result.current.resetKey;
 await act(async()=>{await view.result.current.listResult.fetchNextPage();});
 expect(api.rankedMap).toHaveBeenLastCalledWith(expect.objectContaining({sort:'PROXIMITY',after:1}),expect.any(AbortSignal));
 act(()=>view.result.current.setSort('CONTACTS'));
 await waitFor(()=>expect(view.result.current.sort).toBe('CONTACTS'));
 expect(view.result.current.rows.map(row=>row.id).sort()).toEqual([1,2]);
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

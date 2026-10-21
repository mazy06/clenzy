import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {BAITLY_PROSPECTION_READY} from '../services/baitlyDeferredStartup';

const loaded=vi.hoisted(()=>({planning:vi.fn(),dashboard:vi.fn(),properties:vi.fn(),map:vi.fn(),workspace:vi.fn()}));
vi.mock('./planning/PlanningPage',()=>{loaded.planning();return {default:()=>null};});
vi.mock('./dashboard/Dashboard',()=>{loaded.dashboard();return {default:()=>null};});
vi.mock('./properties/PropertiesPage',()=>{loaded.properties();return {default:()=>null};});
vi.mock('./prospection/ProspectionPage',()=>({default:()=>null}));
vi.mock('./prospection/baitlyProspectionChunks',()=>({loadBaitlyContactMap:loaded.map,loadBaitlyCrmWorkspace:loaded.workspace}));

beforeEach(()=>{
 vi.resetModules();vi.clearAllMocks();vi.useFakeTimers();history.replaceState(null,'','/prospection?tab=map');
 vi.stubGlobal('requestIdleCallback',undefined);loaded.map.mockResolvedValue({default:()=>null});loaded.workspace.mockResolvedValue({default:()=>null});
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();history.replaceState(null,'','/');});
it('does not load other pages before prospection is usable and cancels abandoned warmups',async()=>{
 const {warmHotRoutes}=await import('./routePrefetch');const cancel=warmHotRoutes();
 await vi.advanceTimersByTimeAsync(9000);expect(loaded.planning).not.toHaveBeenCalled();expect(loaded.dashboard).not.toHaveBeenCalled();expect(loaded.properties).not.toHaveBeenCalled();
 cancel();window.dispatchEvent(new Event(BAITLY_PROSPECTION_READY));await vi.advanceTimersByTimeAsync(10000);
 expect(loaded.planning).not.toHaveBeenCalled();
});
it('releases hot routes only after the first useful surface and idle',async()=>{
 const {warmHotRoutes}=await import('./routePrefetch');const cancel=warmHotRoutes();
 window.dispatchEvent(new Event(BAITLY_PROSPECTION_READY));expect(loaded.planning).not.toHaveBeenCalled();
 await vi.advanceTimersByTimeAsync(1000);await vi.dynamicImportSettled();
 expect(loaded.planning).toHaveBeenCalledOnce();expect(loaded.dashboard).toHaveBeenCalledOnce();expect(loaded.properties).toHaveBeenCalledOnce();cancel();
});
it('preloads the map in parallel with its shell for an explicit map URL',async()=>{
 const {prefetchRoute}=await import('./routePrefetch');prefetchRoute('/prospection?tab=map');
 expect(loaded.map).toHaveBeenCalledOnce();expect(loaded.workspace).toHaveBeenCalledOnce();
 expect(loaded.planning).not.toHaveBeenCalled();await vi.dynamicImportSettled();
});

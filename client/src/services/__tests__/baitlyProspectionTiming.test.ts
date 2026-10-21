import {afterEach,expect,it,vi} from 'vitest';
import {markBaitlyProspection,releaseBaitlyProspectionStartup} from '../baitlyProspectionTiming';
import {signalBaitlyProspectionReady} from '../baitlyDeferredStartup';

vi.mock('../baitlyDeferredStartup',()=>({signalBaitlyProspectionReady:vi.fn()}));
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();vi.clearAllMocks();});
it('records each milestone once, with navigation and authenticated durations',()=>{
 const names=new Set(['baitly:boot:user-ready']);const mark=vi.fn((name:string)=>names.add(name));const measure=vi.fn();
 vi.stubGlobal('performance',{mark,measure,getEntriesByName:(name:string)=>names.has(name)?[{}]:[]});
 markBaitlyProspection('map-created');markBaitlyProspection('map-created');
 expect(mark).toHaveBeenCalledExactlyOnceWith('baitly:prospection:map-created');
 expect(measure).toHaveBeenCalledWith('baitly:prospection:until-map-created',{start:0,end:'baitly:prospection:map-created'});
 expect(measure).toHaveBeenCalledWith('baitly:prospection:authenticated-to-map-created',{start:'baitly:boot:user-ready',end:'baitly:prospection:map-created'});
});
it('continues rendering without performance APIs',()=>{
 vi.stubGlobal('performance',undefined);expect(()=>markBaitlyProspection('professionals-visible')).not.toThrow();
});
it('releases background tasks after paint and cancels a stale surface',()=>{
 vi.useFakeTimers();const cancel=releaseBaitlyProspectionStartup();cancel();vi.advanceTimersByTime(64);
 expect(signalBaitlyProspectionReady).not.toHaveBeenCalled();
 releaseBaitlyProspectionStartup();vi.advanceTimersByTime(16);expect(signalBaitlyProspectionReady).not.toHaveBeenCalled();
 vi.advanceTimersByTime(48);expect(signalBaitlyProspectionReady).toHaveBeenCalledOnce();
});

import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import type {ReactNode} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {useBaitlyProfessionalMapImport} from './useBaitlyProfessionalMapImport';
import {crmProfessionalImportsApi} from '../../services/api/baitlyProfessionalDirectoryApi';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function setup(){const client=new QueryClient();return renderHook(({org,enabled})=>useBaitlyProfessionalMapImport(org,enabled),{initialProps:{org:10,enabled:true},wrapper:({children}:{children:ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>});}
it('drops selection and mode when organization or management rights change',()=>{
 const hook=setup();act(()=>{hook.result.current.toggle(1);hook.result.current.setMode(true);});expect(hook.result.current.selected.size).toBe(1);
 hook.rerender({org:20,enabled:true});expect(hook.result.current.selected.size).toBe(0);expect(hook.result.current.mode).toBe(false);
 act(()=>hook.result.current.toggle(2));hook.rerender({org:20,enabled:false});expect(hook.result.current.selected.size).toBe(0);expect(hook.result.current.canImport).toBe(false);
});
it('does not clear a new organization selection when an older organization import finishes',async()=>{
 let finish!:()=>void;vi.spyOn(crmProfessionalImportsApi,'importReferences').mockImplementation(()=>new Promise(resolve=>{finish=()=>resolve([]);}));
 const hook=setup();act(()=>hook.result.current.toggle(1));act(()=>hook.result.current.submit());await waitFor(()=>expect(hook.result.current.request.isPending).toBe(true));
 hook.rerender({org:20,enabled:true});act(()=>hook.result.current.toggle(1));await act(async()=>finish());
 expect(hook.result.current.selected.has(1)).toBe(true);
});

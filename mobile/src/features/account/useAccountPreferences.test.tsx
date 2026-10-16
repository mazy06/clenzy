import React from 'react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { useBaitlyDataMode } from '@/config/baitlyDataMode';
import { useAccountPreferences } from './useAccountPreferences';
const renderer=require('react-test-renderer');const {act}=renderer;
const mockTheme=jest.fn(),mockLanguage=jest.fn();
jest.mock('@/api/apiClient',()=>({apiClient:{get:jest.fn(),put:jest.fn()}}));
jest.mock('@/store/authStore',()=>({useAuthStore:(select:any)=>select({isAuthenticated:true})}));
jest.mock('@/store/settingsStore',()=>({useSettingsStore:{getState:()=>({setThemeMode:mockTheme,setLanguage:mockLanguage})}}));
jest.mock('@/features/marketplace/queries',()=>({useBaitlyScope:()=>['baitly-mobile-v1','user',7,'real']}));
let state:ReturnType<typeof useAccountPreferences>,tree:any,cache:QueryClient;
function Probe(){state=useAccountPreferences();return null;}
async function open(){cache=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});await act(async()=>{tree=renderer.create(<QueryClientProvider client={cache}><Probe/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,30));});await act(async()=>{await new Promise(resolve=>setTimeout(resolve,30));});}
beforeEach(()=>{jest.clearAllMocks();useBaitlyDataMode.getState().setMode('real');});
afterEach(async()=>{await act(async()=>tree?.unmount());cache?.clear();});
it('loads the same persisted preferences used by the PMS and maps auto to system',async()=>{
  jest.mocked(apiClient.get).mockResolvedValue({themeMode:'auto',language:'en'});await open();
  expect(apiClient.get).toHaveBeenCalledWith('/user-preferences/me',expect.anything());expect(mockTheme).toHaveBeenCalledWith('system');expect(mockLanguage).toHaveBeenCalledWith('en');
  jest.mocked(apiClient.put).mockResolvedValue({themeMode:'auto',language:'en'});
  await act(async()=>{await state.save({themeMode:'system'});});expect(apiClient.put).toHaveBeenCalledWith('/user-preferences/me',{themeMode:'auto'});
});
it('preserves preferences when the backend rejects the save',async()=>{
  jest.mocked(apiClient.get).mockResolvedValue({themeMode:'light',language:'fr'});await open();jest.clearAllMocks();
  jest.mocked(apiClient.put).mockRejectedValue(new Error('offline'));
  await act(async()=>{await expect(state.save({language:'en'})).rejects.toThrow('offline');});expect(mockLanguage).not.toHaveBeenCalled();
});
it('changes demo appearance locally without touching real preferences',async()=>{
  useBaitlyDataMode.getState().setMode('demo');await open();await act(async()=>{await state.save({language:'en'});});
  expect(apiClient.get).not.toHaveBeenCalled();expect(apiClient.put).not.toHaveBeenCalled();expect(mockLanguage).toHaveBeenCalledWith('en');
});

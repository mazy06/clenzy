import {useEffect,useState} from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import ProspectionPage from './ProspectionPage';
import {prospectsApi} from '../../services/api/prospectsApi';
import {baitlyCrmDetailsApi} from '../../services/api/baitlyCrmDetailsApi';
import {baitlyCrmLocationsApi} from '../../services/api/baitlyCrmLocationsApi';

const boot=vi.hoisted(()=>({loading:false,view:'map',mount:vi.fn(),unmount:vi.fn(),tableLoaded:vi.fn()}));
vi.mock('../../hooks/useAuth',()=>({useAuth:()=>({user:{id:1,organizationId:10,roles:['HOST'],permissions:['baitly-crm:view']}})}));
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr',t:(key:string)=>key})}));
vi.mock('../../hooks/useThemeMode',()=>({useThemeMode:()=>({isDark:false})}));
vi.mock('../../hooks/useUserPreference',()=>({useUserPreference:(key:string,initial:unknown)=>[
 key==='baitly.crm.workspace'?{kind:'all',status:'all',view:boot.view,layout:'table'}:initial,
 vi.fn(),{isLoading:boot.loading,isLoaded:!boot.loading}
]}));
vi.mock('../../components/PageHeader',()=>({default:({actions,filters}:any)=><header>{actions}{filters}</header>}));
vi.mock('./BaitlyCrmMap',()=>({default:({org,canManage,publicOnly}:any)=>{
 const [selected,setSelected]=useState(false);
 useEffect(()=>{boot.mount();return ()=>boot.unmount();},[]);
 return <div data-testid="stable-map" data-org={org} data-can-import={String(canManage)} data-public={String(publicOnly)}>
  <button onClick={()=>setSelected(true)}>Sélectionner une entreprise</button><output>{selected?'Entreprise sélectionnée':'Aucune sélection'}</output>
 </div>;
}}));
vi.mock('./BaitlyCrmNationalTable',()=>{
 boot.tableLoaded();return {default:()=> <div data-testid="national-table"/>};
});

beforeEach(()=>{
 boot.loading=false;boot.view='map';boot.mount.mockClear();boot.unmount.mockClear();boot.tableLoaded.mockClear();
 vi.spyOn(prospectsApi,'getAll');vi.spyOn(baitlyCrmDetailsApi,'list');vi.spyOn(baitlyCrmLocationsApi,'list');
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function setup(path='/prospection?tab=map'){
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const tree=<MemoryRouter initialEntries={[path]}><QueryClientProvider client={client}><ProspectionPage/></QueryClientProvider></MemoryRouter>;
 return render(tree);
}

it('renders the map before CRM access and keeps its instance and selection when access arrives',async()=>{
 let resolve!:(value:Awaited<ReturnType<typeof prospectsApi.access>>)=>void;
 vi.spyOn(prospectsApi,'access').mockImplementation(()=>new Promise(done=>{resolve=done;}));
 setup();const map=await screen.findByTestId('stable-map');
 expect(map).not.toHaveAttribute('data-org');fireEvent.click(screen.getByRole('button',{name:'Sélectionner une entreprise'}));
 await waitFor(()=>expect(resolve).toBeTypeOf('function'));
 await act(async()=>resolve({organizationId:10,canManage:true,canAuthorize:false}));
 await waitFor(()=>expect(map).toHaveAttribute('data-org','10'));
 expect(screen.getByTestId('stable-map')).toBe(map);expect(map).toHaveTextContent('Entreprise sélectionnée');
 expect(map).toHaveAttribute('data-public','true');expect(boot.mount).toHaveBeenCalledOnce();expect(boot.unmount).not.toHaveBeenCalled();
 expect(boot.tableLoaded).not.toHaveBeenCalled();
 for(const request of [prospectsApi.getAll,baitlyCrmDetailsApi.list,baitlyCrmLocationsApi.list])expect(request).not.toHaveBeenCalled();
});

it('does not start the CRM default view while the saved initial tab is loading',async()=>{
 boot.loading=true;boot.view='crm';
 const access=vi.spyOn(prospectsApi,'access').mockResolvedValue({organizationId:10,canManage:true,canAuthorize:false});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const tree=()=> <MemoryRouter initialEntries={['/prospection']}><QueryClientProvider client={client}><ProspectionPage/></QueryClientProvider></MemoryRouter>;
 const view=render(tree());await act(async()=>{await Promise.resolve();});
 expect(access).not.toHaveBeenCalled();expect(boot.tableLoaded).not.toHaveBeenCalled();expect(boot.mount).not.toHaveBeenCalled();
 boot.loading=false;boot.view='map';view.rerender(tree());
 await screen.findByTestId('stable-map');expect(boot.tableLoaded).not.toHaveBeenCalled();expect(prospectsApi.getAll).not.toHaveBeenCalled();
});

it('honors an explicit map URL even while saved preferences are pending or point to the CRM',async()=>{
 boot.loading=true;boot.view='crm';vi.spyOn(prospectsApi,'access').mockRejectedValue(Object.assign(new Error('Forbidden'),{status:403}));
 setup();const map=await screen.findByTestId('stable-map');
 await waitFor(()=>expect(prospectsApi.access).toHaveBeenCalled());await act(async()=>{await Promise.resolve();});
 expect(screen.getByTestId('stable-map')).toBe(map);expect(boot.mount).toHaveBeenCalledOnce();expect(boot.unmount).not.toHaveBeenCalled();
});

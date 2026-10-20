import {mockDirectoryCoverage} from '../marketplace/__tests__/baitlyCoverageFixture';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {NationalProspectionMap as ProspectionPage} from './ProspectionPage';
import {professionalDirectoryApi as api,type ReferencedProfessional} from '../../services/api/baitlyProfessionalDirectoryApi';
import {prospectsApi} from '../../services/api/prospectsApi';
import {baitlyCrmLocationsApi} from '../../services/api/baitlyCrmLocationsApi';
import {baitlyCrmDetailsApi} from '../../services/api/baitlyCrmDetailsApi';
const auth=vi.hoisted(()=>({roles:['HOST'],permissions:['baitly-crm:view']}));
vi.mock('../../hooks/useAuth',()=>({useAuth:()=>({user:{id:1,organizationId:10,...auth}})}));
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr',t:(_key:string,fallback?:string)=>fallback??_key})}));
vi.mock('../../hooks/useThemeMode',()=>({useThemeMode:()=>({isDark:false})}));
vi.mock('../../components/PageHeader',()=>({default:({actions,filters}:any)=><header>{filters}{actions}</header>}));
vi.mock('../../components/BaitlyMapCanvas',()=>({BaitlyMapCanvas:({properties,renderPopup,onMarkerClick,selectedPropertyId,mapTools}:any)=><div data-testid="map">{mapTools}{properties.map((p:any)=><button key={p.id} onClick={()=>onMarkerClick(p)}>{p.name}</button>)}{properties.filter((p:any)=>p.id===selectedPropertyId).map((p:any)=><div key={p.id} data-testid="popup">{renderPopup(p)}</div>)}</div>}));
const row:ReferencedProfessional={id:80,name:'Nettoyage national',siret:'12345678900011',address:'1 rue de Nantes 44000 NANTES',city:'NANTES',postal_code:'44000',activity:'81.21Z',latitude:47.2,longitude:-1.5,phone:'02 40 00 00 00',email:'contact@example.com',website:'https://example.com',sirene_retrieved_at:'2026-10-20',osm_key:'node/123',osm_name:'Nettoyage national',osm_confirmed_at:'2026-10-20',location_source:'OSM'};
beforeEach(()=>{
 mockDirectoryCoverage();
 auth.roles=['HOST'];auth.permissions=['baitly-crm:view'];
 vi.spyOn(api,'map').mockResolvedValue({items:[row],nextCursor:null});
 vi.spyOn(api,'synchronization').mockResolvedValue({enabled:true,phase:'COMPLETED',published:1});
 vi.spyOn(prospectsApi,'access');vi.spyOn(prospectsApi,'getAll');vi.spyOn(baitlyCrmLocationsApi,'list');vi.spyOn(baitlyCrmDetailsApi,'list');
 window.matchMedia=vi.fn().mockReturnValue({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function setup(){const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});render(<MemoryRouter><QueryClientProvider client={client}><ProspectionPage/></QueryClientProvider></MemoryRouter>);return client;}
it('offers three sorts in the page header and preserves the selected firm when the sort changes',async()=>{
 setup();const map=await screen.findByTestId('map');fireEvent.click(await within(map).findByRole('button',{name:row.name}));
 const sort=within(screen.getByRole('banner')).getByRole('combobox',{name:'Trier les professionnels'});
 expect(sort).toHaveValue('PROXIMITY');expect(within(sort).getAllByRole('option')).toHaveLength(3);
 fireEvent.change(sort,{target:{value:'CONTACTS'}});
 await waitFor(()=>expect(api.rankedMap).toHaveBeenLastCalledWith(expect.objectContaining({sort:'CONTACTS',after:0}),expect.any(AbortSignal)));
 expect(within(screen.getByTestId('popup')).getByText(row.siret)).toBeInTheDocument();
});
it.each(['HOST','SUPER_ADMIN','SUPER_MANAGER','TECHNICIAN'])('uses the same read-only national map for %s without requesting private CRM data',async role=>{
 auth.roles=[role];if(role==='TECHNICIAN')auth.permissions=[];
 setup();await within(await screen.findByTestId('map')).findByRole('button',{name:row.name});
 for(const request of [prospectsApi.access,prospectsApi.getAll,baitlyCrmDetailsApi.list,baitlyCrmLocationsApi.list])expect(request).not.toHaveBeenCalled();
 for(const label of ['Ajouter un contact','Importer un CSV','Enrichir et localiser','À localiser','Sélection multiple sur la carte'])expect(screen.queryByRole('button',{name:label})).not.toBeInTheDocument();
 expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
 const header=screen.getByRole('banner');expect(within(header).getByRole('textbox',{name:'Ville'})).toBeInTheDocument();expect(within(header).getByRole('combobox',{name:'Type de service'})).toBeInTheDocument();
});
it('shows source-backed activity and contact links directly on the professional card',async()=>{
 setup();const map=await screen.findByTestId('map');fireEvent.click(await within(map).findByRole('button',{name:row.name}));
 const popup=await screen.findByTestId('popup');
 expect(within(popup).getByText('Ménage et nettoyage').closest('[data-service]')).toHaveAttribute('data-service','CLEANING');
 expect(within(popup).getByRole('link',{name:/Téléphone/})).toHaveAttribute('href','tel:0240000000');
 expect(within(popup).getByRole('link',{name:/Email/})).toHaveAttribute('href','mailto:contact%40example.com');
 expect(within(popup).getByRole('link',{name:'Site web'})).toHaveAttribute('href','https://example.com/');
 expect(within(popup).getByText(row.siret)).toBeInTheDocument();expect(within(popup).queryByText('Sources')).not.toBeInTheDocument();
});
it('keeps the open map stable after background publication until an explicit refresh',async()=>{
 vi.mocked(api.map).mockResolvedValue({items:[],nextCursor:null});vi.mocked(api.synchronization).mockResolvedValue({enabled:true,phase:'ESTABLISHMENTS',scanned:1000,published:0});
 const client=setup();await waitFor(()=>expect(api.map).toHaveBeenCalled());expect(screen.queryByText(/Lecture des établissements Sirene/)).not.toBeInTheDocument();
 const requests=vi.mocked(api.map).mock.calls.length;
 vi.mocked(api.map).mockResolvedValue({items:[row],nextCursor:null});client.setQueryData(['professional-directory-sync'],{enabled:true,phase:'COMPLETED',published:1,completed_at:'2026-10-20T12:00:00Z'});
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});expect(api.map).toHaveBeenCalledTimes(requests);
 await act(async()=>{await client.refetchQueries({queryKey:['professional-directory-map']});await client.refetchQueries({queryKey:['professional-directory-coverage']});});
 await within(screen.getByTestId('map')).findByRole('button',{name:row.name});
 expect(prospectsApi.getAll).not.toHaveBeenCalled();
});

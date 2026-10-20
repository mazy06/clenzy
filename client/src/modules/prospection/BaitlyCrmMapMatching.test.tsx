vi.mock('../../hooks/useAuth',()=>({useAuth:()=>({user:{id:7,organizationId:10}})}));
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import BaitlyCrmMap from './BaitlyCrmMap';
import {baitlyCrmLocationsApi,type BaitlyCrmLocation} from '../../services/api/baitlyCrmLocationsApi';
import {geocoderApi} from '../../services/geocoderApi';
import {baitlyCrmEnrichmentRunsApi,type BaitlyEnrichmentRun} from '../../services/api/baitlyCrmEnrichmentRunsApi';
import type {BaitlyCrmContact} from './baitlyCrmWorkspace';
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr',t:(key:string,fallback?:string)=>fallback||key})}));
vi.mock('../../hooks/useThemeMode',()=>({useThemeMode:()=>({isDark:false})}));
vi.mock('../../components/BaitlyMapCanvas',()=>({BaitlyMapCanvas:({properties,mapTools,mapInfo}:any)=><div><div data-testid="map" data-markers={JSON.stringify(properties)}/><div data-testid="map-tools">{mapTools}</div><details data-testid="map-info"><summary>Informations carte</summary>{mapInfo}</details></div>}));
vi.mock('../../components/baitly/MapWithSheet',()=>({default:({map,listTitle,listIndicators,children}:any)=><div>{map}<h2>{listTitle}</h2>{listIndicators}<div data-map-list-scroll>{children}</div></div>}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
beforeEach(()=>{vi.spyOn(baitlyCrmEnrichmentRunsApi,'latest').mockResolvedValue({run:null});});
const run:BaitlyEnrichmentRun={id:'12345678-1234-1234-1234-123456789abc',status:'RUNNING',locationOnly:true,total:1,confirmed:0,pending:1,review:0,unavailable:0,failed:0};
const contacts=[{id:7,name:'Atlas Services',city:'Rabat',contactType:'PROVIDER',contactNature:'PROFESSIONAL',category:'PROVIDERS'},
 {id:8,name:'Maison Salé',city:'Salé',contactType:'PROVIDER',contactNature:'PROFESSIONAL',category:'CONCIERGERIES'},
 {id:9,name:'Propriétaire privé',city:'Rabat',contactType:'OWNER',contactNature:'PRIVATE',category:'OWNERS'}] as BaitlyCrmContact[];
function setup(canManage=true,selection=contacts,review=true){
 let locations:BaitlyCrmLocation[]=[];
 vi.spyOn(baitlyCrmLocationsApi,'list').mockImplementation(async()=>[...locations]);
 const search=vi.spyOn(baitlyCrmLocationsApi,'searchOsm').mockImplementation(async id=>({ticket:'ticket',candidates:[{osmType:'node',osmId:42,name:selection.find(c=>c.id===id)!.name,label:'Établissement, Rabat, Maroc',latitude:34,longitude:-6.8,signals:['NAME','CITY']}]}));
 const confirm=vi.spyOn(baitlyCrmLocationsApi,'confirmOsm').mockImplementation(async id=>{locations.push({prospect_id:id,label:'Établissement, Rabat, Maroc',latitude:34,longitude:-6.8,precision:'ADDRESS'});});
 const save=vi.spyOn(baitlyCrmLocationsApi,'save').mockImplementation(async(id,point)=>{locations.push({...point,prospect_id:id});});
 const onOpen=vi.fn();
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 render(<QueryClientProvider client={client}><BaitlyCrmMap contacts={selection} org={10} canManage={canManage} initialMatching={review} onOpen={onOpen}/></QueryClientProvider>);
 return {search,confirm,save,onOpen,client,locate:(id:number)=>locations.push({prospect_id:id,label:"Paris",latitude:48.8,longitude:2.3,precision:"ADDRESS"})};
}
async function start(_count=3){await screen.findByRole('button',{name:'Passer ce contact'});}
async function propose(){
 fireEvent.change(screen.getByLabelText('Pays'),{target:{value:'MA'}});fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button',{name:'Rechercher dans OpenStreetMap'}));
 fireEvent.click(await screen.findByRole('button',{name:/Établissement, Rabat, Maroc/}));
}
it('previews then confirms one contact at a time on the same map and advances without opening a record',async()=>{
 const api=setup();await start();expect(api.search).not.toHaveBeenCalled();await propose();expect(api.confirm).not.toHaveBeenCalled();
 await waitFor(()=>expect(JSON.parse(screen.getByTestId('map').getAttribute('data-markers')!)).toHaveLength(1));
 fireEvent.click(screen.getByRole('button',{name:'Confirmer cet établissement'}));
 await screen.findByRole('heading',{name:'Maison Salé'});expect(api.confirm).toHaveBeenCalledWith(7,{ticket:'ticket',index:0,replace:false});expect(api.search).toHaveBeenCalledTimes(1);expect(api.onOpen).not.toHaveBeenCalled();
 expect(JSON.parse(screen.getByTestId('map').getAttribute('data-markers')!)[0]).toMatchObject({id:7});
});
it('skips without saving and uses address or city entry for a private owner',async()=>{
 const api=setup();await start();fireEvent.click(screen.getByRole('button',{name:'Passer ce contact'}));await screen.findByRole('heading',{name:'Maison Salé'});
 fireEvent.click(screen.getByRole('button',{name:'Passer ce contact'}));await screen.findByRole('heading',{name:'Propriétaire privé'});
 expect(screen.queryByRole('button',{name:'Rechercher dans OpenStreetMap'})).not.toBeInTheDocument();
 vi.spyOn(geocoderApi,'searchCities').mockResolvedValue([{label:'Rabat, Maroc',latitude:34,longitude:-6.8}] as never);
 fireEvent.change(screen.getByLabelText('Rechercher un lieu'),{target:{value:'Rabat'}});fireEvent.click(screen.getByRole('button',{name:'Rechercher le lieu'}));fireEvent.click(await screen.findByRole('button',{name:'Rabat, Maroc'}));
 expect(api.save).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Confirmer la localisation'}));
 await screen.findByText('Tous les contacts de cette file ont été localisés ou passés.');expect(api.save).toHaveBeenCalledWith(9,expect.objectContaining({precision:'CITY'}));expect(api.confirm).not.toHaveBeenCalled();expect(api.search).not.toHaveBeenCalled();
});
it('preserves the current contact on failed confirmation and prevents moving on during the request',async()=>{
 const api=setup();let reject!:(reason:Error)=>void;api.confirm.mockImplementation(()=>new Promise((_,fail)=>{reject=fail;}));await start();await propose();
 fireEvent.click(screen.getByRole('button',{name:'Confirmer cet établissement'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Passer ce contact'})).toBeDisabled());
 reject(new Error('expired'));await screen.findByRole('alert');expect(screen.getByRole('heading',{name:'Atlas Services'})).toBeInTheDocument();
 await waitFor(()=>expect(screen.getByRole('button',{name:'Passer ce contact'})).toBeEnabled());
});
it('does not offer enrichment to read-only users',async()=>{
 setup(false);await screen.findByText('0 localisés · 3 sans localisation');expect(screen.queryByRole('button',{name:/Localiser les contacts/})).not.toBeInTheDocument();
});
it('keeps only the location icon and count in the toolbar, with the colored legend in map information',async()=>{
 setup(true,contacts,false);const action=await screen.findByRole('button',{name:'Localiser les contacts (3)'});
 expect(action.textContent).toBe('3');expect(action.querySelector('svg')).not.toBeNull();
 expect(screen.getByTestId('map-tools')).not.toHaveTextContent('Conciergeries');
 expect(screen.getByTestId('map-info')).toHaveTextContent('Conciergeries');
 expect(screen.getByTestId('map-info')).toHaveTextContent('Prestataires');
});
it('runs localization from the icon without opening a form and refreshes successful points directly on the map',async()=>{
 const api=setup(true,[contacts[0]],false);
 const begin=vi.spyOn(baitlyCrmEnrichmentRunsApi,'start').mockResolvedValue({run});
 fireEvent.click(await screen.findByRole('button',{name:'Localiser les contacts (1)'}));
 await waitFor(()=>expect(begin).toHaveBeenCalledWith([7],true));
 expect(screen.getByRole('progressbar')).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Localiser les contacts (1)'})).toBeDisabled();
 expect(screen.queryByLabelText('Nom commercial public')).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Passer ce contact'})).not.toBeInTheDocument();
 api.locate(7);vi.mocked(baitlyCrmEnrichmentRunsApi.latest).mockResolvedValue({run:{...run,status:'COMPLETED',confirmed:1,pending:0}});
 await api.client.invalidateQueries({queryKey:['prospects',10,7,'enrichment-run']});
 await waitFor(()=>expect(JSON.parse(screen.getByTestId('map').getAttribute('data-markers')!)).toHaveLength(1));
 await screen.findByText(/1 localisés automatiquement/);
 expect(begin).toHaveBeenCalledOnce();expect(api.search).not.toHaveBeenCalled();
});
it('leaves ambiguous results for optional review without opening that review automatically',async()=>{
 setup(true,[contacts[0]],false);
 vi.spyOn(baitlyCrmEnrichmentRunsApi,'start').mockResolvedValue({run:{...run,status:'COMPLETED',pending:0,review:1}});
 fireEvent.click(await screen.findByRole('button',{name:'Localiser les contacts (1)'}));
 await screen.findByText(/1 à vérifier/);
 expect(screen.queryByLabelText('Nom commercial public')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Valider les correspondances OSM'}));
 await screen.findByLabelText('Nom commercial public');
});
it('immediately shows restored Sirene coordinates without spending time on optional contact enrichment',async()=>{
 const api=setup(true,[contacts[0]],false);
 vi.spyOn(baitlyCrmEnrichmentRunsApi,'start').mockImplementation(async()=>{api.locate(7);return {run:{...run,status:'COMPLETED',confirmed:1,pending:0}};});
 fireEvent.click(await screen.findByRole('button',{name:'Localiser les contacts (1)'}));
 await screen.findByText(/1 localisés automatiquement/);
 await waitFor(()=>expect(JSON.parse(screen.getByTestId('map').getAttribute('data-markers')!)).toHaveLength(1));
 expect(api.search).not.toHaveBeenCalled();
});
it('creates its queue from the contacts in the current selection and clears skipped previews',async()=>{
 const api=setup(true,[contacts[1]]);await start(1);await propose();fireEvent.click(screen.getByRole('button',{name:'Passer ce contact'}));
 await screen.findByText('Tous les contacts de cette file ont été localisés ou passés.');expect(screen.getByTestId('map')).toHaveAttribute('data-markers','[]');expect(api.confirm).not.toHaveBeenCalled();expect(api.search).toHaveBeenCalledWith(8,expect.anything());
});

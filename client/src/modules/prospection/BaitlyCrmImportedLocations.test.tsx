import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import ImportedLocations from './BaitlyCrmImportedLocations';
import {importedCrmContactIds} from './baitlyCrmImportedContacts';
import {prospectsApi,type ProspectDto} from '../../services/api/prospectsApi';
import {baitlyCrmLocationsApi,type BaitlyCrmLocation} from '../../services/api/baitlyCrmLocationsApi';
import {baitlyCrmLocationReviewApi,type BaitlyLocationProgress} from "../../services/api/baitlyCrmLocationReviewApi";
import {baitlyCrmEnrichmentRunsApi} from '../../services/api/baitlyCrmEnrichmentRunsApi';
import type {DirectoryImportResult} from '../../services/api/baitlyProfessionalDirectoryApi';

vi.mock('../../hooks/useAuth',()=>({useAuth:()=>({user:{id:7,organizationId:10}})}));
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr',t:(key:string,fallback?:string)=>fallback||key})}));
vi.mock('../../hooks/useThemeMode',()=>({useThemeMode:()=>({isDark:false})}));
vi.mock('../../components/BaitlyMapCanvas',()=>({BaitlyMapCanvas:({properties,mapTools}:any)=><div><div data-testid="map" data-markers={JSON.stringify(properties)}/>{mapTools}</div>}));
vi.mock('../../components/baitly/MapWithSheet',()=>({default:({map,listTitle,listIndicators,children}:any)=><div>{map}<h2>{listTitle}</h2>{listIndicators}<div data-map-list-scroll>{children}</div></div>}));
beforeEach(()=>{HTMLElement.prototype.scrollIntoView=vi.fn();vi.spyOn(baitlyCrmEnrichmentRunsApi,'latest').mockResolvedValue({run:null});});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const base={city:'Nantes',contactType:'PROVIDER',contactNature:'PROFESSIONAL',category:'PROVIDERS',sourceType:'OPEN_DATA',sourceUrl:'https://annuaire-entreprises.data.gouv.fr/etablissement/12345678900011',archived:false,status:'TO_CONTACT'} as const;
const contacts:ProspectDto[]=[{...base,id:1,name:'Atlas Services'},{...base,id:2,name:'Maison du Port'},{...base,id:3,name:'Contact hors import'},{...base,id:4,name:'Déjà localisé'}];
const results:DirectoryImportResult[]=[{siret:'1',name:'Atlas Services',status:'CREATED',id:1},{siret:'2',name:'Maison du Port',status:'CREATED',id:2},{siret:'4',name:'Déjà localisé',status:'EXISTING',id:4},{siret:'3',name:'Contact hors import',status:'REVIEW',id:3},{siret:'5',name:'Retiré',status:'REMOVED',id:null}];
function setup(){
 const enrich=vi.spyOn(baitlyCrmLocationReviewApi,'enrich').mockResolvedValue({status:'REVIEW',copiedFields:[]});
 const load=vi.spyOn(prospectsApi,'getAll').mockResolvedValue(contacts);
 let locations:BaitlyCrmLocation[]=[{prospect_id:4,label:'Nantes',latitude:47.2,longitude:-1.5,precision:'ADDRESS',osm_confirmed_at:'2026-10-19T12:00:00Z'}];
 vi.spyOn(baitlyCrmLocationsApi,'list').mockImplementation(async()=>[...locations]);
 const statuses=new Map<number,string>([[1,'PENDING'],[2,'PENDING'],[4,'CONFIRMED']]);
 const progress=()=>{locations.forEach(item=>statuses.set(item.prospect_id,'CONFIRMED'));return {items:[...statuses].map(([id,status])=>({id,status})),remaining:[...statuses.values()].filter(s=>s==='PENDING').length,confirmed:[...statuses.values()].filter(s=>s==='CONFIRMED').length,skipped:[...statuses.values()].filter(s=>s==='SKIPPED').length,notFound:[...statuses.values()].filter(s=>s==='NOT_FOUND').length} as BaitlyLocationProgress;};
 vi.spyOn(baitlyCrmLocationReviewApi,'enqueue').mockImplementation(async()=>progress());
 vi.spyOn(baitlyCrmLocationReviewApi,'progress').mockImplementation(async()=>progress());
 const skip=vi.spyOn(baitlyCrmLocationReviewApi,'skip').mockImplementation(async id=>{if(statuses.get(id)==='PENDING')statuses.set(id,'SKIPPED');return progress();});
 const manual=vi.spyOn(baitlyCrmLocationsApi,'searchOsm');
 const search=vi.spyOn(baitlyCrmLocationReviewApi,'search').mockResolvedValue({ticket:'ticket-osm',candidates:[{osmType:'node',osmId:42,name:'Atlas Services',label:'Atlas Services, Nantes, France',latitude:47.21,longitude:-1.51,signals:['NAME','SIRET']}]});
 const confirm=vi.spyOn(baitlyCrmLocationsApi,'confirmOsm').mockImplementation(async id=>{locations.push({prospect_id:id,label:'Atlas Services, Nantes, France',latitude:47.21,longitude:-1.51,precision:'ADDRESS',osm_type:'node',osm_id:42,osm_confirmed_at:'2026-10-19T12:05:00Z'});});
 const close=vi.fn(),onContact=vi.fn();
 const mount=(selected=results)=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><ImportedLocations results={selected} org={10} onClose={close} onContact={onContact}/></QueryClientProvider>);
 const view=mount();return {enrich,search,confirm,close,onContact,load,manual,skip,statuses,view,mount};
}
function markerIds(){return (JSON.parse(screen.getByTestId('map').getAttribute('data-markers')!) as {id:number;subtitle:string}[]).filter(marker=>!marker.subtitle.startsWith('Aperçu')).map(marker=>marker.id).sort();}
async function propose(){
 await screen.findByRole('heading',{name:'Atlas Services'});
 await screen.findByRole('button',{name:'Confirmer cet établissement'});
}
it('starts with imported missing contacts, confirms sequentially and keeps validated positions on the map',async()=>{
 const api=setup();await screen.findByRole('heading',{name:'Atlas Services'});
 expect(markerIds()).toEqual([4]);expect(screen.queryByText('Contact hors import')).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Rechercher dans OpenStreetMap'})).not.toBeInTheDocument();
 await propose();expect(api.confirm).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Confirmer cet établissement'}));
 await screen.findByRole('heading',{name:'Maison du Port'});expect(api.confirm).toHaveBeenCalledWith(1,{ticket:'ticket-osm',index:0,replace:false});
 expect(markerIds()).toEqual([1,4]);expect(api.onContact).not.toHaveBeenCalled();await waitFor(()=>expect(api.search).toHaveBeenCalledTimes(2));
 expect(api.search.mock.calls.map(call=>call[0])).toEqual([1,2]);expect(api.manual).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Passer ce contact'}));await screen.findByText('Tous les contacts de cette file ont été localisés ou passés.');
 expect(markerIds()).toEqual([1,4]);fireEvent.click(screen.getByRole('button',{name:'Retour à l’import'}));expect(api.close).toHaveBeenCalled();
});
it('keeps the current item and blocks exit or skipping while confirmation is pending',async()=>{
 const api=setup();let reject!:(reason:Error)=>void;api.confirm.mockImplementation(()=>new Promise((_,fail)=>{reject=fail;}));
 await propose();fireEvent.click(screen.getByRole('button',{name:'Confirmer cet établissement'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Passer ce contact'})).toBeDisabled());expect(screen.getByRole('button',{name:'Retour à l’import'})).toBeDisabled();
 reject(new Error('expired'));await screen.findByRole('alert');expect(screen.getByRole('heading',{name:'Atlas Services'})).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Passer ce contact'}));await screen.findByRole('heading',{name:'Maison du Port'});expect(markerIds()).toEqual([4]);
});
it('deduplicates valid import ids and excludes ambiguous, rejected and malformed identities',()=>{
 expect(importedCrmContactIds([...results,results[0],{...results[0],id:0},{...results[0],id:1.5}])).toEqual([1,2,4]);
});
it('allows skipping a pending lookup and ignores its late result',async()=>{
 const api=setup();let finish!:(value:any)=>void;api.search.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 await screen.findByRole('heading',{name:'Atlas Services'});fireEvent.click(screen.getByRole('button',{name:'Passer ce contact'}));
 await screen.findByRole('heading',{name:'Maison du Port'});
 finish({ticket:'stale',candidates:[{osmType:'node',osmId:999,name:'Ancien résultat',label:'Ancien résultat',latitude:47,longitude:-1,signals:[]}]});
 await screen.findByRole('button',{name:'Confirmer cet établissement'});expect(screen.queryByText('Ancien résultat')).not.toBeInTheDocument();expect(api.confirm).not.toHaveBeenCalled();
});
it('keeps the current contact after lookup failure and retries only when requested',async()=>{
 const api=setup();api.search.mockRejectedValueOnce({status:503,message:'Source indisponible'});
 await screen.findByRole('alert');expect(screen.getByRole('heading',{name:'Atlas Services'})).toBeInTheDocument();expect(api.search).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Réessayer la localisation'}));await screen.findByRole('button',{name:'Confirmer cet établissement'});expect(api.search).toHaveBeenCalledTimes(2);expect(api.confirm).not.toHaveBeenCalled();
});
it('leaves a contact without matches unlocated and searches the next one after skipping',async()=>{
 const api=setup();api.search.mockResolvedValueOnce({ticket:'empty',candidates:[]});
 await screen.findByText(/Aucune localisation trouvée/);expect(api.confirm).not.toHaveBeenCalled();expect(api.search).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Passer ce contact'}));await screen.findByRole('heading',{name:'Maison du Port'});
 await screen.findByRole('button',{name:'Confirmer cet établissement'});expect(api.search.mock.calls.map(call=>call[0])).toEqual([1,2]);expect(markerIds()).toEqual([4]);
});

it('resumes only pending contacts after unmount, retaining confirmed, skipped and no-match totals',async()=>{
 const api=setup();await propose();fireEvent.click(screen.getByRole('button',{name:'Confirmer cet établissement'}));await screen.findByRole('heading',{name:'Maison du Port'});
 api.statuses.set(2,'NOT_FOUND');api.view.unmount();api.search.mockClear();api.mount([]);
 await screen.findByText(/Progression sauvegardée.*0 à traiter.*2 validés.*0 passés.*1 sans correspondance/);
 expect(api.search).not.toHaveBeenCalled();expect(screen.queryByRole('heading',{name:'Maison du Port'})).not.toBeInTheDocument();
});
it('does not advance when persisting a skip fails and resumes the pending contact after closing',async()=>{
 const api=setup();await propose();api.skip.mockRejectedValueOnce(new Error('offline'));fireEvent.click(screen.getByRole('button',{name:'Passer ce contact'}));
 await screen.findByText(/Progression non enregistrée/);expect(screen.getByRole('heading',{name:'Atlas Services'})).toBeInTheDocument();
 api.view.unmount();api.mount([]);await propose();expect(screen.getByRole('heading',{name:'Atlas Services'})).toBeInTheDocument();
});
it('persists a skipped contact and resumes the next pending contact without re-searching it',async()=>{
 const api=setup();await propose();fireEvent.click(screen.getByRole('button',{name:'Passer ce contact'}));await screen.findByRole('heading',{name:'Maison du Port'});
 api.view.unmount();api.search.mockClear();api.mount([]);await screen.findByRole('heading',{name:'Maison du Port'});
 await waitFor(()=>expect(api.search).toHaveBeenCalledTimes(1));expect(api.search.mock.calls[0][0]).toBe(2);expect(screen.getAllByText(/1 passés/).length).toBeGreaterThan(0);
});

it('advances exact SIRET confirmations automatically without showing manual confirmation',async()=>{
 const api=setup();api.enrich.mockImplementationOnce(async()=>{api.statuses.set(1,'CONFIRMED');return {status:'CONFIRMED',copiedFields:['EMAIL']};});
 await screen.findByRole('heading',{name:'Maison du Port'});expect(api.confirm).not.toHaveBeenCalled();expect(api.search.mock.calls.every(call=>call[0]!==1)).toBe(true);
});

it('reviews ambiguous BAN addresses in the existing queue without asserting an OSM business match',async()=>{
 const api=setup();api.enrich.mockResolvedValueOnce({status:'REVIEW',copiedFields:[],proposal:{ticket:'ban-ticket',candidates:[
  {osmType:null,osmId:0,name:'Atlas Services',label:'12 Rue du Port 44000 Nantes',latitude:47.2,longitude:-1.5,signals:['ADDRESS'],precision:'ADDRESS',source:'BAN',reference:'44109_port_12',score:.9},
  {osmType:null,osmId:0,name:'Atlas Services',label:'Autre adresse 44000 Nantes',latitude:47.21,longitude:-1.51,signals:['ADDRESS'],precision:'ADDRESS',source:'BAN',reference:'44109_port_other',score:.89},
 ]}});
 await screen.findByRole('button',{name:'Confirmer cette adresse'});
 expect(screen.getByText('Autre adresse 44000 Nantes')).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Confirmer cet établissement'})).not.toBeInTheDocument();
 expect(screen.getByRole('link',{name:/Base Adresse Nationale/})).toBeInTheDocument();
 expect(screen.queryAllByRole('link',{name:/OpenStreetMap/})).toHaveLength(0);expect(api.search).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:/Autre adresse 44000 Nantes/}));
 fireEvent.click(screen.getByRole('button',{name:'Confirmer cette adresse'}));
 await waitFor(()=>expect(api.confirm).toHaveBeenCalledWith(1,{ticket:'ban-ticket',index:1,replace:false}));
});

import { cleanup,fireEvent,render,screen,waitFor,within } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import PageHeaderActions from '../../components/PageHeaderActions';
import { useState } from 'react';
import fr from '../../../public/locales/fr.json';
import {BaitlyCrmWorkspace as ProspectionPage} from './BaitlyCrmLegacyWorkspace';
import { prospectsApi,type ProspectDto } from '../../services/api/prospectsApi';
import { baitlyCrmLocationsApi } from '../../services/api/baitlyCrmLocationsApi';
import {baitlyCrmDetailsApi} from '../../services/api/baitlyCrmDetailsApi';
import {baitlyInquiriesApi} from '../../services/api/baitlyInquiriesApi';
import { filterCrmContacts,contactKind } from './baitlyCrmWorkspace';
import {baitlyCampaignsApi} from '../../services/api/baitlyCampaignsApi';
import {baitlyRecruitmentApi} from '../../services/api/baitlyRecruitmentApi';
import {baitlyCrmLocationBatchesApi} from '../../services/api/baitlyCrmLocationBatchesApi';
import RestoredProspectionPage from './ProspectionPage';
import {professionalDirectoryApi,crmProfessionalImportsApi,type ReferencedProfessional} from '../../services/api/baitlyProfessionalDirectoryApi';
import {baitlyCrmEnrichmentRunsApi} from '../../services/api/baitlyCrmEnrichmentRunsApi';
const roleState=vi.hoisted(()=>({roles:[] as string[],crm:true}));
const headerState=vi.hoisted(()=>({popover:false}));
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr',t:(key:string,fallback?:unknown)=>key.split('.').reduce((node:any,part)=>node?.[part],fr)??(typeof fallback==='string'?fallback:key)})}));
vi.mock('../../hooks/useAuth',()=>({useAuth:()=>({user:{id:1,organizationId:10,roles:roleState.roles,permissions:roleState.crm?['baitly-crm:view']:[]}})}));
vi.mock('../../hooks/useThemeMode',()=>({useThemeMode:()=>({isDark:false})}));
vi.mock('../../hooks/useUserPreference',()=>({useUserPreference:(_key:string,initial:unknown)=>useState(initial)}));
vi.mock('../../components/PageHeader',()=>({default:({title,actions,filters,filtersActive}:{title:string;actions:React.ReactNode;filters:React.ReactNode;filtersActive?:boolean})=><header><h1>{title}</h1>{headerState.popover?<PageHeaderActions filters={filters} filtersActive={filtersActive} actions={actions} narrow={false}/>:<>{filters}{actions}</>}</header>}));
vi.mock('../../components/BaitlyMapCanvas',()=>({BaitlyMapCanvas:({properties,onMarkerClick,renderPopup,selectedPropertyId}:{properties:any[];onMarkerClick:(marker:any)=>void;renderPopup:(marker:any)=>React.ReactNode;selectedPropertyId?:number})=><div data-testid="contact-map">{properties.map(marker=><button key={marker.id} data-kind={marker.type} onClick={()=>onMarkerClick(marker)}>{marker.name}</button>)}{properties.filter(marker=>marker.id===selectedPropertyId).map(marker=><div key={marker.id}>{renderPopup(marker)}</div>)}</div>}));
const base={contactType:'PROVIDER',contactNature:'PROFESSIONAL',category:'PROVIDERS',status:'TO_CONTACT',sourceType:'MANUAL',archived:false,city:'Rabat'} as const;
const contacts:ProspectDto[]=[{...base,id:1,name:'Samira Alaoui',email:'samira@example.com',contactType:'OWNER',category:'OWNERS'},{...base,id:2,name:'Atlas Conciergerie',category:'CONCIERGERIES',status:'IN_DISCUSSION'},{...base,id:3,name:'Youssef Entretien',status:'PARTNER'}];
beforeEach(()=>{
  headerState.popover=false;roleState.roles=[];vi.spyOn(professionalDirectoryApi,'synchronization').mockResolvedValue({enabled:true,phase:'COMPLETED'});
  roleState.crm=true;vi.spyOn(professionalDirectoryApi,'map').mockResolvedValue({items:[],nextCursor:null});vi.spyOn(baitlyCrmEnrichmentRunsApi,'latest').mockResolvedValue({run:null});
  vi.spyOn(baitlyCrmDetailsApi,'list').mockResolvedValue([]);vi.spyOn(baitlyCrmDetailsApi,'assignees').mockResolvedValue([]);vi.spyOn(baitlyInquiriesApi,'list').mockResolvedValue({content:[],totalElements:0});
  vi.spyOn(prospectsApi,'access').mockResolvedValue({organizationId:10,canManage:true,canAuthorize:false});vi.spyOn(prospectsApi,'getAll').mockResolvedValue(contacts);
  vi.spyOn(prospectsApi,'detail').mockImplementation(async id=>contacts.find(contact=>contact.id===id)!);vi.spyOn(prospectsApi,'duplicates').mockResolvedValue([]);
  vi.spyOn(baitlyCrmLocationsApi,'list').mockResolvedValue([{prospect_id:1,label:'Rabat',latitude:34.0,longitude:-6.8,precision:'CITY'},{prospect_id:2,label:'Rabat',latitude:34.0,longitude:-6.8,precision:'CITY'}]);
  HTMLElement.prototype.scrollIntoView=vi.fn();window.matchMedia=vi.fn().mockReturnValue({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function setup(tab?:string,restored=false){render(<MemoryRouter initialEntries={[tab?`/?tab=${tab}`:'/']}><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}>{restored?<RestoredProspectionPage/>:<ProspectionPage />}</QueryClientProvider></MemoryRouter>);}
it('opens the shared professional discovery inside the organization CRM',async()=>{
  setup();fireEvent.click(await screen.findByRole('button',{name:'Rechercher des professionnels'}));
  const search=await screen.findByRole('region',{name:'Rechercher des professionnels'});
  expect(within(search).getByLabelText('Ville')).toBeInTheDocument();expect(within(search).getByLabelText('Type de service')).toBeInTheDocument();
  expect(within(search).getByRole('button',{name:'Rechercher et importer'})).toBeInTheDocument();expect(within(search).queryByText('Trouver la ville')).not.toBeInTheDocument();
});
it('places the enrichment action in the CRM page header',async()=>{
  setup();const action=await screen.findByRole('button',{name:'Enrichir et localiser'});expect(action.closest('header')).not.toBeNull();
});
it('opens the organization-wide batch action from the CRM even when the table has active filters',async()=>{
  vi.spyOn(baitlyCrmLocationBatchesApi,'config').mockResolvedValue({enabled:false});vi.spyOn(baitlyCrmLocationBatchesApi,'latest').mockResolvedValue({});
  setup();await screen.findByRole('button',{name:'Atlas Conciergerie'});fireEvent.change(screen.getByRole('combobox',{name:'Type de contact'}),{target:{value:'owner'}});
  fireEvent.click(screen.getByRole('button',{name:'Localiser tous les leads'}));await screen.findByRole('heading',{name:'Localiser tous les leads'});
  expect(screen.getByText(/au-delà des filtres et des pages du tableau/)).toBeInTheDocument();expect(await screen.findByRole('button',{name:'Lancer la recherche groupée'})).toBeDisabled();
});
it('keeps the same contacts and role filter between the grouped CRM table and map',async()=>{
  setup();expect(await screen.findByRole('button',{name:'Atlas Conciergerie'})).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox',{name:'Type de contact'}),{target:{value:'concierge'}});expect(screen.queryByRole('button',{name:'Samira Alaoui'})).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole('tab',{name:'Carte'}),{button:0,ctrlKey:false});const map=await screen.findByTestId('contact-map');
  expect(await within(map).findByRole('button',{name:'Conciergerie : Atlas Conciergerie'})).toHaveAttribute('data-kind','crm_concierge');expect(within(map).queryByRole('button',{name:'Propriétaire : Samira Alaoui'})).not.toBeInTheDocument();
  fireEvent.click(within(map).getByRole('button',{name:'Conciergerie : Atlas Conciergerie'}));expect(await screen.findByRole('heading',{name:'Atlas Conciergerie'})).toBeInTheDocument();expect(screen.queryByRole('complementary',{name:'Fiche contact'})).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Ouvrir la fiche'}));expect(await within(screen.getByRole('complementary',{name:'Fiche contact'})).findByRole('heading',{name:'Atlas Conciergerie'})).toBeInTheDocument();
});
it('shows contacts without positions in the map list and never invents coordinates',async()=>{
  setup();await screen.findByRole('button',{name:'Samira Alaoui'});fireEvent.mouseDown(screen.getByRole('tab',{name:'Carte'}),{button:0,ctrlKey:false});
  const map=await screen.findByTestId('contact-map');expect(within(map).queryByRole('button',{name:'Prestataire : Youssef Entretien'})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:/Youssef Entretien/})).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'À localiser'}));
  expect(screen.getByRole('button',{name:/Youssef Entretien/})).toBeInTheDocument();
});
it('writes a changed relationship stage through the existing CRM API',async()=>{
  const update=vi.spyOn(prospectsApi,'update').mockResolvedValue(contacts[0]);setup();await screen.findByRole('button',{name:'Samira Alaoui'});
  fireEvent.change(screen.getByRole('combobox',{name:'Étape de la relation : Samira Alaoui'}),{target:{value:'IN_DISCUSSION'}});
  expect(update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:/Enregistrer : Samira Alaoui/}));
  await waitFor(()=>expect(update).toHaveBeenCalledWith(1,{status:'IN_DISCUSSION'}));
});
it('respects read-only access in both the table and contact record',async()=>{
  vi.mocked(prospectsApi.access).mockResolvedValue({organizationId:10,canManage:false,canAuthorize:false});setup();
  const contact=await screen.findByRole('button',{name:'Fiche contact : Samira Alaoui'});expect(screen.queryByRole('combobox',{name:/Étape de la relation :/})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Rechercher des professionnels'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Enrichir et localiser'})).not.toBeInTheDocument();
  fireEvent.click(contact);const record=await screen.findByRole('complementary',{name:'Fiche contact'});
  await within(record).findByRole('heading',{name:'Samira Alaoui'});expect(within(record).getByRole('button',{name:/1.*qualifier/i})).toBeDisabled();
});
it('classifies concierge categories without converting owners or losing provider searches',()=>{
  expect(contactKind(contacts[1])).toBe('concierge');expect(contactKind({...contacts[1],contactType:'OWNER'})).toBe('owner');
  expect(filterCrmContacts(contacts,'atlas','concierge','all').map(contact=>contact.id)).toEqual([2]);
  expect(filterCrmContacts(contacts,'youssef','provider','PARTNER').map(contact=>contact.id)).toEqual([3]);
});
it('limits a CRM group to ten contacts and keeps the remaining contact on the next page',async()=>{
  vi.mocked(prospectsApi.getAll).mockResolvedValue(Array.from({length:11},(_,index)=>({...contacts[0],id:index+20,name:`Contact ${String(index+1).padStart(2,'0')}`})));
  setup();await screen.findByRole('button',{name:'Contact 01'});
  expect(screen.getAllByRole('row')).toHaveLength(11);
  expect(screen.queryByRole('button',{name:'Contact 11'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('2',{selector:'a'}));
  expect(await screen.findByRole('button',{name:'Contact 11'})).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Contact 01'})).not.toBeInTheDocument();
});
it.each(['SUPER_ADMIN','SUPER_MANAGER'])('opens campaign and form actions for %s without the HOST role',async(role)=>{
  roleState.roles=[role];vi.mocked(prospectsApi.access).mockResolvedValue({organizationId:10,canManage:false,canAuthorize:false,canSendCampaigns:false});
  vi.spyOn(baitlyCampaignsApi,'list').mockResolvedValue({content:[],totalElements:0});
  setup('campaigns');expect(await screen.findByRole('button',{name:'Préparer une campagne'})).toBeEnabled();
  cleanup();vi.spyOn(baitlyRecruitmentApi,'own').mockResolvedValue({available:true,page:{}});
  setup('acquisition');expect(await screen.findByRole('button',{name:'Enregistrer'})).toBeEnabled();
});

it("keeps CRM view controls and filters in the header with icon-only actions",async()=>{
 setup();await screen.findByRole("button",{name:"Atlas Conciergerie"});
 const header=screen.getByRole("banner");
 for(const name of ["Tableau","Pipeline","Ajouter un contact","Rechercher des professionnels","Enrichir et localiser"]){const button=within(header).getByRole("button",{name});expect(button.textContent).toBe("");}
 expect(within(header).getByRole("combobox",{name:"Type de contact"})).toBeInTheDocument();
 expect(within(header).getByRole("combobox",{name:"Responsable"})).toBeInTheDocument();
 fireEvent.click(within(header).getByRole("button",{name:"Pipeline"}));expect(within(header).getByRole("button",{name:"Pipeline"})).toHaveAttribute("aria-pressed","true");
});

const nationalRows:ReferencedProfessional[]=Array.from({length:30},(_,i)=>({id:80+i,siret:String(12345678900011+i),name:`National ${String(i+1).padStart(2,'0')}`,address:'1 rue du Port Nantes',city:'NANTES',postal_code:'44000',activity:'81.21Z',latitude:47.2,longitude:-1.5,sirene_retrieved_at:'2026-10-20',osm_key:null,osm_name:null,osm_confirmed_at:null,phone:null,email:null,website:null}));
it('filters contact availability from the CRM header and restarts pagination before importing',async()=>{
 vi.spyOn(professionalDirectoryApi,'list').mockImplementation(async(_query,page,_service,contacts)=>({items:contacts?[{...nationalRows[0],name:'Joignable par email',email:'contact@example.com'}]:nationalRows,total:contacts?1:31,page}));
 setup(undefined,true);await screen.findByRole('button',{name:'National 01'});
 fireEvent.click(screen.getByText('4',{selector:'a'}));await waitFor(()=>expect(professionalDirectoryApi.list).toHaveBeenLastCalledWith('',1,'',''));
 fireEvent.change(within(screen.getByRole('banner')).getByRole('combobox',{name:'Coordonnées disponibles'}),{target:{value:'EMAIL'}});
 await screen.findByRole('button',{name:'Joignable par email'});expect(professionalDirectoryApi.list).toHaveBeenLastCalledWith('',0,'','EMAIL');
 expect(screen.getAllByRole('row')).toHaveLength(2);
 fireEvent.click(screen.getByRole('button',{name:'Réinitialiser les filtres'}));await screen.findByRole('button',{name:'National 01'});
 expect(screen.getByRole('combobox',{name:'Coordonnées disponibles'})).toHaveValue('');
 expect(professionalDirectoryApi.list).toHaveBeenCalledWith('',0,'',''); // The unfiltered first page may be reused from cache.
});
it('restores the national CRM table, ten-row pagination and header filters without fetching the old private list',async()=>{
 vi.spyOn(professionalDirectoryApi,'list').mockResolvedValue({items:nationalRows,total:31,page:0});setup(undefined,true);
 await screen.findByRole('button',{name:'National 01'});expect(screen.getAllByRole('row')).toHaveLength(11);expect(prospectsApi.getAll).not.toHaveBeenCalled();
 for(const name of ['CRM','Carte','Campagnes'])expect(screen.getByRole('tab',{name})).toBeInTheDocument();
 const header=screen.getByRole('banner');expect(within(header).getByRole('combobox',{name:'Type de service'})).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Ajouter un contact'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByText('2',{selector:'a'}));await screen.findByRole('button',{name:'National 11'});expect(professionalDirectoryApi.list).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByText('4',{selector:'a'}));await waitFor(()=>expect(professionalDirectoryApi.list).toHaveBeenLastCalledWith('',1,'',''));
});
it('imports directory selection through the deduplicating organization API and retains the pipeline',async()=>{
 vi.spyOn(professionalDirectoryApi,'list').mockResolvedValue({items:nationalRows,total:30,page:0});const imported=vi.spyOn(crmProfessionalImportsApi,'importReferences').mockResolvedValue([{siret:nationalRows[0].siret,name:nationalRows[0].name,status:'EXISTING',id:1}]);setup(undefined,true);
 fireEvent.click(await screen.findByRole('checkbox',{name:'Sélectionner ce prestataire : National 01'}));fireEvent.click(screen.getByRole('button',{name:'Importer la sélection'}));
 await waitFor(()=>expect(imported).toHaveBeenCalledExactlyOnceWith([80]));fireEvent.click(await screen.findByRole('button',{name:'Contacts de mon CRM'}));
 await screen.findByRole('button',{name:'Fiche contact : Samira Alaoui'});expect(screen.getByRole('combobox',{name:'Étape de la relation : Samira Alaoui'})).toBeEnabled();expect(screen.queryByRole('button',{name:'Samira Alaoui'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Pipeline'}));expect(screen.getByRole('button',{name:'Pipeline'})).toHaveAttribute('aria-pressed','true');
});
it('does not mix private contacts into the restored national map',async()=>{
 vi.mocked(professionalDirectoryApi.map).mockResolvedValue({items:[nationalRows[0]],nextCursor:null});setup('map',true);
 await screen.findAllByRole('button',{name:'National 01'});expect(prospectsApi.getAll).not.toHaveBeenCalled();expect(baitlyCrmLocationsApi.list).not.toHaveBeenCalled();expect(screen.queryByText(/Samira Alaoui/)).not.toBeInTheDocument();
 expect(screen.getByRole('combobox',{name:'Pays'})).toHaveValue('FR');fireEvent.change(screen.getByRole('combobox',{name:'Pays'}),{target:{value:'MA'}});await waitFor(()=>expect(screen.queryByRole('button',{name:'National 01'})).not.toBeInTheDocument());expect(screen.getByRole('combobox',{name:'Pays'})).toHaveValue('MA');
});
it('keeps directory browsing available when CRM access is denied',async()=>{
 vi.spyOn(professionalDirectoryApi,'list').mockResolvedValue({items:nationalRows,total:30,page:0});vi.mocked(prospectsApi.access).mockRejectedValue(Object.assign(new Error('Forbidden'),{status:403}));setup(undefined,true);
 await screen.findByRole('button',{name:'National 01'});expect(screen.queryByRole('button',{name:'Importer la sélection'})).not.toBeInTheDocument();
});

it('keeps the national CRM read-only for users without private CRM permission',async()=>{
 roleState.crm=false;vi.spyOn(professionalDirectoryApi,'list').mockResolvedValue({items:nationalRows,total:30,page:0});setup(undefined,true);
 await screen.findByRole('button',{name:'National 01'});expect(prospectsApi.access).not.toHaveBeenCalled();expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();expect(screen.queryByRole('tab',{name:'Campagnes'})).not.toBeInTheDocument();
});

it('filters the national list from the single header icon, keeps its active state and resets it',async()=>{
 headerState.popover=true;vi.spyOn(professionalDirectoryApi,'list').mockImplementation(async(_query,page,service)=>({items:service==='LAUNDRY'?[{...nationalRows[0],name:'Blanchisserie ciblée',activity:'96.01A'}]:nationalRows,total:service?1:30,page}));setup(undefined,true);
 await screen.findByRole('button',{name:'National 01'});const header=screen.getByRole('banner');const filterButton=within(header).getByRole('button',{name:'Filtres'});
 expect(screen.queryByRole('combobox',{name:'Type de service'})).not.toBeInTheDocument();fireEvent.click(filterButton);
 fireEvent.change(await screen.findByRole('combobox',{name:'Type de service'}),{target:{value:'LAUNDRY'}});
 await screen.findByRole('button',{name:'Blanchisserie ciblée'});expect(filterButton).toHaveAttribute('data-filters-active','true');expect(professionalDirectoryApi.list).toHaveBeenLastCalledWith('',0,'LAUNDRY','');
 fireEvent.click(filterButton);expect(screen.queryByRole('combobox',{name:'Type de service'})).not.toBeInTheDocument();expect(filterButton).toHaveAttribute('data-filters-active','true');
 fireEvent.click(filterButton);fireEvent.click(await screen.findByRole('button',{name:'Réinitialiser les filtres'}));await screen.findByRole('button',{name:'National 01'});expect(filterButton).toHaveAttribute('data-filters-active','false');
});
it('mounts the map filter portal in the page header and applies its service selection',async()=>{
 headerState.popover=true;vi.mocked(professionalDirectoryApi.map).mockResolvedValue({items:[nationalRows[0]],nextCursor:null});setup('map',true);
 await screen.findAllByRole('button',{name:'National 01'});const header=screen.getByRole('banner');const filterButton=within(header).getByRole('button',{name:'Filtres'});fireEvent.click(filterButton);
 expect(await screen.findByRole('textbox',{name:'Ville'})).toBeInTheDocument();fireEvent.change(screen.getByRole('combobox',{name:'Type de service'}),{target:{value:'CLEANING'}});
 await waitFor(()=>expect(professionalDirectoryApi.map).toHaveBeenLastCalledWith(expect.objectContaining({service:'CLEANING'}),expect.any(AbortSignal)));expect(filterButton).toHaveAttribute('data-filters-active','true');
 fireEvent.click(screen.getByRole('button',{name:'Réinitialiser les filtres'}));await waitFor(()=>expect(screen.getByRole('combobox',{name:'Type de service'})).toHaveValue(''));expect(filterButton).toHaveAttribute('data-filters-active','false');
});

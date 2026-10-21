import {baitlyCrmLocationReviewApi} from '../../services/api/baitlyCrmLocationReviewApi';
import {baitlyCrmEnrichmentRunsApi} from '../../services/api/baitlyCrmEnrichmentRunsApi';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { beforeEach,describe,it,expect,vi } from 'vitest';
import Directory from './BaitlyProfessionalDirectory';
const mocks=vi.hoisted(()=>({admin:true,user:undefined as any,list:vi.fn(),synchronization:vi.fn(),cities:vi.fn(),discover:vi.fn(),importBatch:vi.fn(),importReference:vi.fn(),import:vi.fn(),match:vi.fn(),confirm:vi.fn(),remove:vi.fn(),access:vi.fn()}));
vi.mock('../../hooks/useAuth',()=>({useAuth:()=>({hasAnyRole:()=>mocks.admin,user:mocks.user})}));
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr',t:(key:string)=>key})}));
vi.mock('../../hooks/useThemeMode',()=>({useThemeMode:()=>({isDark:false})}));
vi.mock('../../components/ScreenChrome',()=>({useScreenSearch:()=>{}}));
vi.mock('../../components/PageHeaderActionsContext',async importOriginal=>({...await importOriginal<typeof import('../../components/PageHeaderActionsContext')>(),usePageHeaderActions:(node:unknown)=>node}));
vi.mock('../../services/api/baitlyProfessionalDirectoryApi',()=>({professionalDirectoryApi:mocks,crmProfessionalImportsApi:mocks}));
vi.mock('../../services/api/prospectsApi',()=>({prospectsApi:{access:mocks.access}}));
vi.mock('../../components/BaitlyMapCanvas',()=>({BaitlyMapCanvas:({properties}:any)=><div data-testid="map" data-count={properties.length}/>}));
vi.mock('../../components/baitly/MapWithSheet',()=>({default:({map,children}:any)=><div>{map}{children}</div>}));
vi.mock('../../components/map/MapCardCoordinator',()=>({MapCardCoordinator:({children}:any)=>children}));
vi.mock('../prospection/BaitlyCrmImportedLocations',()=>({default:({org,results}:any)=><div data-testid="imported-queue" data-org={org} data-ids={JSON.stringify(results.map((item:any)=>item.id))}/>}));
const row={id:1,siret:'12345678900011',name:'Atlas',address:'Nantes',city:'Nantes',postal_code:'44000',activity:'81.21Z',latitude:null,longitude:null,osm_confirmed_at:null,sirene_retrieved_at:'2026-10-19T12:00:00Z'};
function setup(){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><Directory/></QueryClientProvider>);}
describe('Baitly professional references',()=>{
 beforeEach(()=>{vi.resetAllMocks();vi.spyOn(baitlyCrmEnrichmentRunsApi,'start').mockResolvedValue({run:null});mocks.synchronization.mockResolvedValue({enabled:true,phase:'COMPLETED',scanned:2000});vi.spyOn(baitlyCrmLocationReviewApi,'enrich').mockResolvedValue({status:'REVIEW',copiedFields:[]});mocks.admin=true;mocks.user=undefined;mocks.list.mockResolvedValue({items:[row],total:1,page:0});mocks.import.mockResolvedValue({});mocks.confirm.mockResolvedValue({});});
 it('does not map an unconfirmed location or expose management to readers',async()=>{
  mocks.admin=false;setup();await screen.findByText('Atlas');
  expect(screen.queryByText('Ajouter depuis Sirene')).not.toBeInTheDocument();expect(screen.queryByText('Rechercher sur OSM')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Carte'}));expect(screen.getByTestId('map')).toHaveAttribute('data-count','0');
 });
 it('requires explicit confirmation of an OSM candidate',async()=>{
  mocks.match.mockResolvedValue({ticket:'ticket-osm',candidates:[{key:'node/42',name:'Atlas OSM',address:'Nantes',latitude:47.2,longitude:-1.5,signals:['NAME']}]});
  setup();fireEvent.click(await screen.findByText('Rechercher sur OSM'));await screen.findByText('Atlas OSM');expect(mocks.confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Valider la correspondance'));await waitFor(()=>expect(mocks.confirm).toHaveBeenCalledWith(1,'ticket-osm',0));
 });
 it('requires explicit selection and bulk import after a city and service search',async()=>{
  mocks.cities.mockResolvedValue([{nom:'Nantes',code:'44109',codesPostaux:['44000']}]);
  mocks.discover.mockResolvedValue({ticket:'ticket-sirene',candidates:[{siret:row.siret,name:'Sirene Atlas',address:'Nantes',activity:'81.21Z'}]});
  mocks.importBatch.mockResolvedValue([{siret:row.siret,name:'Sirene Atlas',status:'CREATED',id:1}]);
  setup();fireEvent.click(screen.getByText('Ajouter depuis Sirene'));
  fireEvent.change(screen.getByLabelText('Ville'),{target:{value:'Nantes'}});fireEvent.click(screen.getByText('Trouver la ville'));
  fireEvent.change(await screen.findByLabelText('Choisir une ville'),{target:{value:'44109'}});
  fireEvent.change(screen.getAllByLabelText('Type de service')[0],{target:{value:'CLEANING'}});
  fireEvent.click(screen.getByText('Rechercher dans Sirene'));await screen.findByText('Sirene Atlas');expect(mocks.importBatch).not.toHaveBeenCalled();
  expect(mocks.discover).toHaveBeenCalledWith({query:'',communeCode:'44109',service:'CLEANING',page:1});
  fireEvent.click(screen.getByLabelText(/Sirene Atlas/));fireEvent.click(screen.getByText('Importer la sélection (1)'));
  await waitFor(()=>expect(mocks.importBatch.mock.calls[0][0]).toEqual([{ticket:'ticket-sirene',index:0}]));
  await screen.findByText(/Importé/);expect(mocks.match).not.toHaveBeenCalled();expect(mocks.confirm).not.toHaveBeenCalled();
 });
 it('maps Sirene coordinates without claiming an OSM match and filters the shared base',async()=>{
  mocks.admin=false;mocks.list.mockResolvedValue({items:[{...row,latitude:47.2,longitude:-1.5,location_source:'SIRENE'}],total:1,page:0});
  setup();await screen.findByText('Atlas');expect(screen.getByText('Adresse localisée par Sirene')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Carte'}));expect(screen.getByTestId('map')).toHaveAttribute('data-count','1');
  fireEvent.change(screen.getByLabelText('Type de service'),{target:{value:'SECURITY'}});
  await waitFor(()=>expect(mocks.list).toHaveBeenCalledWith('',0,'SECURITY',''));
  expect(mocks.confirm).not.toHaveBeenCalled();expect(screen.getByText(/Annuaire national partagé/)).toBeInTheDocument();
 });
 it('lets an organization manager import a reference without global mutation rights',async()=>{
  mocks.admin=false;mocks.user={id:7,organizationId:10,permissions:['baitly-crm:view']};mocks.access.mockResolvedValue({organizationId:10,canManage:true});
  mocks.importReference.mockResolvedValue({siret:row.siret,name:'Atlas',status:'CREATED',id:42});setup();
  fireEvent.click(await screen.findByText('Importer dans mon CRM'));await screen.findByText(/Importé · Fiche propre à votre organisation/);
  expect(mocks.importReference.mock.calls[0][0]).toBe(1);expect(screen.getByText('Rechercher des professionnels')).toBeInTheDocument();
  expect(screen.queryByText('Ajouter depuis Sirene')).not.toBeInTheDocument();expect(screen.queryByText('Retirer de l’annuaire')).not.toBeInTheDocument();expect(mocks.confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Valider les correspondances OSM'}));
  const queue=await screen.findByTestId('imported-queue');expect(queue).toHaveAttribute('data-org','10');expect(queue).toHaveAttribute('data-ids','[42]');
 });
});

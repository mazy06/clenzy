import {baitlyCrmLocationReviewApi} from '../../services/api/baitlyCrmLocationReviewApi';
import {baitlyCrmEnrichmentRunsApi} from '../../services/api/baitlyCrmEnrichmentRunsApi';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { beforeEach,describe,it,expect,vi } from 'vitest';
import Discovery from './BaitlyProfessionalDiscovery';
const api=vi.hoisted(()=>({cities:vi.fn(),discover:vi.fn(),importBatch:vi.fn()}));
const crm=vi.hoisted(()=>({cities:vi.fn(),discover:vi.fn(),importBatch:vi.fn()}));
vi.mock('../../services/api/baitlyProfessionalDirectoryApi',()=>({professionalDirectoryApi:api,crmProfessionalImportsApi:crm}));
vi.mock('../prospection/BaitlyCrmImportedLocations',()=>({default:({org,results,onClose}:any)=><div data-testid="imported-queue" data-org={org} data-ids={JSON.stringify(results.map((item:any)=>item.id))}><button onClick={onClose}>Retour à l’import</button></div>}));
const first={siret:'12345678900011',name:'Premier',address:'Nantes',activity:'81.21Z'};
const second={...first,siret:'12345678900022',name:'Second'};
async function search(target:'crm'|'directory'='directory',onContact?:(id:number)=>void){
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{mutations:{retry:false}}})}><Discovery language="fr" target={target} organizationId={target==='crm'?10:undefined} onContact={onContact}/></QueryClientProvider>);
 fireEvent.change(screen.getByLabelText('Ville'),{target:{value:'Nantes'}});
 if(target==='crm'){fireEvent.change(screen.getByLabelText('Type de service'),{target:{value:'CLEANING'}});await waitFor(()=>expect(screen.getByRole('button',{name:'Rechercher et importer'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Rechercher et importer'}));await screen.findByText('Résultat de l’import');return;}
 fireEvent.click(screen.getByText('Trouver la ville'));
 fireEvent.change(await screen.findByLabelText('Choisir une ville'),{target:{value:'44109'}});
 fireEvent.click(screen.getByText('Rechercher dans Sirene'));await screen.findByText('Premier');
}
describe('professional discovery selection',()=>{
 beforeEach(()=>{
  vi.resetAllMocks();vi.spyOn(baitlyCrmLocationReviewApi,'enrich').mockResolvedValue({status:'REVIEW',copiedFields:[]});api.cities.mockResolvedValue([{nom:'Nantes',code:'44109',codesPostaux:['44000']}]);
  vi.spyOn(baitlyCrmEnrichmentRunsApi,'start').mockResolvedValue({run:{id:'job',status:'COMPLETED',locationOnly:false,total:1,confirmed:0,review:1,pending:0,unavailable:0,failed:0}});
  api.discover.mockImplementation(({page})=>Promise.resolve(page===1?{ticket:'page-one',candidates:[first],hasNext:true}:{ticket:'page-two',candidates:[second],hasNext:false}));
  api.importBatch.mockResolvedValue([]);
  crm.cities.mockImplementation(api.cities);crm.discover.mockResolvedValue({ticket:'page-one',candidates:[first],hasNext:false});crm.importBatch.mockResolvedValue([{...first,status:'CREATED',id:42}]);
 });
 it('keeps selections and original tickets across pages without selecting unseen results',async()=>{
  await search();fireEvent.click(screen.getByLabelText('Sélectionner cette page'));
  fireEvent.click(screen.getByText('Suivant'));await screen.findByText('Second');
  expect(screen.getByLabelText('Sélectionner cette page')).not.toBeChecked();
  fireEvent.click(screen.getByLabelText(/Second/));fireEvent.click(screen.getByText('Importer la sélection (2)'));
  await waitFor(()=>expect(api.importBatch.mock.calls[0][0]).toEqual([{ticket:'page-one',index:0},{ticket:'page-two',index:0}]));
 });
 it('clears stale selection and results when city or service changes',async()=>{
  await search();fireEvent.click(screen.getByLabelText(/Premier/));
  fireEvent.change(screen.getByLabelText('Type de service'),{target:{value:'LAUNDRY'}});
  expect(screen.queryByText('Premier')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Rechercher dans Sirene'));await screen.findByText('Premier');
  expect(screen.getByText('Importer la sélection (0)')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Ville'),{target:{value:'Paris'}});
  expect(screen.getByText('Rechercher dans Sirene')).toBeDisabled();
 });
 it('keeps selection after a failed import and allows retry',async()=>{
  api.importBatch.mockRejectedValueOnce(new Error('expired'));
  await search();fireEvent.click(screen.getByLabelText(/Premier/));fireEvent.click(screen.getByText('Importer la sélection (1)'));
  await screen.findByRole('alert');expect(screen.getByLabelText(/Premier/)).toBeChecked();
  fireEvent.click(screen.getByText('Importer la sélection (1)'));await screen.findByText('Résultat de l’import');
  expect(api.importBatch).toHaveBeenCalledTimes(2);
 });
 it('uses scoped CRM endpoints for tenant imports and opens the imported contact',async()=>{
  const onContact=vi.fn();await search('crm',onContact);
  expect(screen.queryByLabelText('Sélectionner cette page')).not.toBeInTheDocument();
  await waitFor(()=>expect(crm.importBatch.mock.calls[0][0]).toEqual([{ticket:'page-one',index:0}]));
  expect(api.importBatch).not.toHaveBeenCalled();fireEvent.click(await screen.findByText('Ouvrir le contact'));expect(onContact).toHaveBeenCalledWith(42);
 });
 it('offers the imported contact queue immediately after a CRM import and preserves the report on return',async()=>{
  await search('crm');
  fireEvent.click(await screen.findByRole('button',{name:'Valider les correspondances OSM (1)'}));
  const queue=await screen.findByTestId('imported-queue');expect(queue).toHaveAttribute('data-org','10');expect(queue).toHaveAttribute('data-ids','[42]');
  expect(screen.queryByText('Rechercher dans Sirene')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Retour à l’import'));expect(await screen.findByText('Résultat de l’import')).toBeInTheDocument();
  expect(crm.importBatch).toHaveBeenCalledTimes(1);
 });
 it('automatically enriches an imported exact match and offers the map without another validation step',async()=>{
  vi.spyOn(baitlyCrmEnrichmentRunsApi,'start').mockResolvedValue({run:{id:'job',status:'COMPLETED',locationOnly:false,total:1,confirmed:1,review:0,pending:0,unavailable:0,failed:0}});
  await search('crm');await screen.findByText(/1 localisés automatiquement/);
  expect(baitlyCrmEnrichmentRunsApi.start).toHaveBeenCalledWith([42],false);expect(baitlyCrmLocationReviewApi.enrich).not.toHaveBeenCalled();
  expect(screen.queryByRole('button',{name:/Valider les correspondances OSM/})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Voir les contacts sur la carte'})).toBeEnabled();
 });
 it('does not offer location validation for rejected imports or uncertain identities',async()=>{
  crm.importBatch.mockResolvedValue([{...first,status:'REVIEW',id:42},{...second,status:'REMOVED',id:null}]);
  await search('crm');
  await screen.findByText('Résultat de l’import');expect(screen.queryByRole('button',{name:/Valider les correspondances OSM/})).not.toBeInTheDocument();
 });
});

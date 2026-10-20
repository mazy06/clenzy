import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,expect,it,vi} from 'vitest';
import BaitlyCrmEnrichImported from './BaitlyCrmEnrichImported';
import {baitlyCrmEnrichmentRunsApi,type BaitlyEnrichmentRun} from '../../services/api/baitlyCrmEnrichmentRunsApi';
vi.mock('../../hooks/useAuth',()=>({useAuth:()=>({user:{id:7,organizationId:10}})}));
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr'})}));
vi.mock('../../components/PageHeaderActionsContext',()=>({usePageHeaderActions:(actions:unknown)=>actions}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const base:BaitlyEnrichmentRun={id:'12345678-1234-1234-1234-123456789abc',status:'RUNNING',locationOnly:false,total:2,confirmed:0,review:0,pending:2,unavailable:0,failed:0};
function setup(initial:BaitlyEnrichmentRun|null=null){
 let run=initial;const latest=vi.spyOn(baitlyCrmEnrichmentRunsApi,'latest').mockImplementation(async()=>({run}));
 const start=vi.spyOn(baitlyCrmEnrichmentRunsApi,'start').mockImplementation(async()=>{run={...base};return {run};});
 const cancel=vi.spyOn(baitlyCrmEnrichmentRunsApi,'cancel').mockImplementation(async()=>{run={...run!,status:'CANCELLED',pending:0};});
 const review=vi.fn();let client:QueryClient;
 const mount=()=>{client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});return render(<QueryClientProvider client={client}><BaitlyCrmEnrichImported onReview={review}/></QueryClientProvider>);};
 const view=mount();return {start,cancel,latest,review,view,mount,setRun:(next:BaitlyEnrichmentRun)=>{run=next;},refresh:()=>client.invalidateQueries({queryKey:['prospects',10,7,'enrichment-run']})};
}
it('starts the server pipeline once, without a browser-owned per-contact loop',async()=>{
 const api=setup();fireEvent.click(screen.getByRole('button',{name:'Enrichir et localiser'}));
 await waitFor(()=>expect(api.start).toHaveBeenCalledWith(undefined,false));
 await screen.findByText(/2 restant à localiser/);expect(screen.getByRole('button',{name:'Localisation en cours…'})).toBeDisabled();
});
it('restores progress after leaving and remounting with a fresh query cache without starting or cancelling a job',async()=>{
 const api=setup();fireEvent.click(screen.getByRole('button',{name:'Enrichir et localiser'}));await screen.findByText(/2 restant à localiser/);
 api.view.unmount();api.setRun({...base,confirmed:1,pending:1});api.mount();
 await screen.findByText(/1 localisés automatiquement.*1 restant à localiser/);
 expect(api.start).toHaveBeenCalledOnce();expect(api.cancel).not.toHaveBeenCalled();
});
it('updates completion from saved server progress and offers manual review only when necessary',async()=>{
 const api=setup(base);await screen.findByText(/2 restant à localiser/);
 api.setRun({...base,status:'COMPLETED',confirmed:1,review:1,pending:0});await api.refresh();
 fireEvent.click(await screen.findByRole('button',{name:'Valider les correspondances OSM (1)'}));expect(api.review).toHaveBeenCalledOnce();expect(api.start).not.toHaveBeenCalled();
});
it('only cancels after an explicit user action',async()=>{
 const api=setup(base);fireEvent.click(await screen.findByRole('button',{name:'Interrompre'}));
 await waitFor(()=>expect(api.cancel).toHaveBeenCalledWith(base.id));await screen.findByText('Traitement interrompu.');
});
it('restores an already completed run without relaunching localized contacts',async()=>{
 const api=setup({...base,status:'COMPLETED',confirmed:2,pending:0});await screen.findByText(/2 localisés automatiquement/);expect(api.start).not.toHaveBeenCalled();
});
it('reports a failed start without inventing a running job',async()=>{
 const api=setup();api.start.mockRejectedValue(new Error('forbidden'));fireEvent.click(screen.getByRole('button',{name:'Enrichir et localiser'}));
 await screen.findByRole('alert');expect(screen.getByRole('button',{name:'Enrichir et localiser'})).toBeEnabled();
});

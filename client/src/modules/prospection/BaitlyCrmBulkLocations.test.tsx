import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,expect,it,vi} from 'vitest';
import BaitlyCrmBulkLocations from './BaitlyCrmBulkLocations';
import {baitlyCrmLocationBatchesApi as api,type BaitlyLocationBatch} from '../../services/api/baitlyCrmLocationBatchesApi';
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr',t:(key:string,fallback?:string)=>fallback||key})}));
vi.mock('../../components/BaitlyPropertyMap',()=>({BaitlyPropertyMap:({properties}:any)=><div data-testid="batch-preview" data-markers={JSON.stringify(properties)}/>}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const proposal:BaitlyLocationBatch={job:{id:'job',country:'MA',status:'COMPLETED',created_at:'2026-10-19'},counts:[{status:'PROPOSED',count:1}],totalElements:1,content:[{prospect_id:7,name:'Atlas Services',city:'Rabat',status:'PROPOSED',candidates:[{osmType:'node',osmId:42,name:'Atlas Services',label:'Atlas Services, Rabat, Maroc',latitude:34,longitude:-6.8,signals:['NAME','CITY'],precision:'ADDRESS'}]}]};
function setup(enabled=true,data:BaitlyLocationBatch={}){
 const latest=vi.spyOn(api,'latest').mockResolvedValue(data);vi.spyOn(api,'config').mockResolvedValue({enabled});
 const start=vi.spyOn(api,'start').mockResolvedValue({id:'job'}),confirm=vi.spyOn(api,'confirm').mockResolvedValue(undefined),skip=vi.spyOn(api,'skip').mockResolvedValue(undefined);
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><BaitlyCrmBulkLocations org={10}/></QueryClientProvider>);return {latest,start,confirm,skip};
}
it('starts exactly one organization-wide job after country and public-business confirmation',async()=>{
 const api=setup();await screen.findByLabelText('Pays du lot');
 expect(screen.getByRole('button',{name:'Lancer la recherche groupée'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Pays du lot'),{target:{value:'MA'}});fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Lancer la recherche groupée'}));
 await waitFor(()=>expect(api.start).toHaveBeenCalledWith('MA',true));expect(api.start).toHaveBeenCalledTimes(1);expect(api.confirm).not.toHaveBeenCalled();
});
it('keeps mass search disabled when the server configuration disallows it',async()=>{
 const api=setup(false);await screen.findByText(/La recherche groupée doit être activée/);expect(screen.getByRole('button',{name:'Lancer la recherche groupée'})).toBeDisabled();expect(api.start).not.toHaveBeenCalled();
});
it('restores stored proposals without searching again and requires preview then explicit confirmation',async()=>{
 const api=setup(true,proposal);await screen.findByText('Atlas Services');expect(api.start).not.toHaveBeenCalled();
 expect(screen.getByRole('button',{name:'Valider le repère'})).toBeDisabled();fireEvent.change(screen.getByLabelText('Choisir une correspondance : Atlas Services'),{target:{value:'0'}});
 expect(screen.getByTestId('batch-preview')).toBeInTheDocument();expect(JSON.parse(screen.getByTestId('batch-preview').getAttribute('data-markers')!)[0]).toMatchObject({type:'crm_provider'});expect(api.confirm).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Valider le repère'}));
 await waitFor(()=>expect(api.confirm).toHaveBeenCalledWith('job',7,0));
});
it('keeps a failed confirmation visible and allows skipping without writing a location',async()=>{
 const api=setup(true,proposal);api.confirm.mockRejectedValue(new Error('stale'));
 await screen.findByText('Atlas Services');fireEvent.change(screen.getByLabelText('Choisir une correspondance : Atlas Services'),{target:{value:'0'}});fireEvent.click(screen.getByRole('button',{name:'Valider le repère'}));
 await screen.findByRole('alert');expect(screen.getByTestId('batch-preview')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Passer'}));await waitFor(()=>expect(api.skip).toHaveBeenCalledWith('job',7));
});

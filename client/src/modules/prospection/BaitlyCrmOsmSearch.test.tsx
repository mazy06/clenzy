vi.mock('../../hooks/useAuth',()=>({useAuth:()=>({user:{id:7,organizationId:10}})}));
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,expect,it,vi} from 'vitest';
import BaitlyCrmOsmSearch from './BaitlyCrmOsmSearch';
import {baitlyCrmLocationsApi} from '../../services/api/baitlyCrmLocationsApi';
import type {ProspectDto} from '../../services/api/prospectsApi';
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr'})}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const candidate={osmType:'node' as const,osmId:42,name:'Atlas Services',label:'Atlas Services, Rabat, Maroc',latitude:34,longitude:-6.8,signals:['NAME','CITY'] as ('NAME'|'CITY')[]};
function setup(hasLocation=false){
  const preview=vi.fn(),saved=vi.fn().mockResolvedValue(undefined);
  const search=vi.spyOn(baitlyCrmLocationsApi,'searchOsm').mockResolvedValue({ticket:'ticket',candidates:[candidate]});
  const confirm=vi.spyOn(baitlyCrmLocationsApi,'confirmOsm').mockResolvedValue(undefined);
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{mutations:{retry:false}}})}><BaitlyCrmOsmSearch contact={{id:7,name:'Atlas Services',city:'Rabat'} as ProspectDto} hasLocation={hasLocation} onPreview={preview} onSaved={saved} /></QueryClientProvider>);
  return {preview,saved,search,confirm};
}
async function find(){fireEvent.click(screen.getByRole('button',{name:'Rechercher cet établissement'}));fireEvent.change(screen.getByLabelText('Pays'),{target:{value:'MA'}});fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Rechercher dans OpenStreetMap'}));return screen.findByRole('button',{name:/Atlas Services, Rabat, Maroc/});}
it('only searches explicitly and requires selection then confirmation to persist the server candidate',async()=>{
  const api=setup();expect(api.search).not.toHaveBeenCalled();
  fireEvent.click(await find());expect(api.preview).toHaveBeenCalledWith(candidate);expect(api.confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Confirmer cet établissement'}));
  await waitFor(()=>expect(api.confirm).toHaveBeenCalledWith(7,{ticket:'ticket',index:0,replace:false}));await waitFor(()=>expect(api.saved).toHaveBeenCalled());
});
it('requires explicit replacement of an existing location',async()=>{
  const api=setup(true);fireEvent.click(await find());expect(screen.getByRole('button',{name:'Confirmer cet établissement'})).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox',{name:'Remplacer la localisation déjà enregistrée'}));fireEvent.click(screen.getByRole('button',{name:'Confirmer cet établissement'}));
  await waitFor(()=>expect(api.confirm).toHaveBeenCalledWith(7,{ticket:'ticket',index:0,replace:true}));
});
it('clears the preview and prevents confirming results from an edited search',async()=>{
  const api=setup();fireEvent.click(await find());fireEvent.change(screen.getByLabelText('Ville'),{target:{value:'Casablanca'}});
  expect(api.preview).toHaveBeenLastCalledWith(null);expect(screen.queryByRole('button',{name:'Confirmer cet établissement'})).not.toBeInTheDocument();expect(api.search).toHaveBeenCalledTimes(1);
});
it('keeps failures visible and does not claim a successful confirmation',async()=>{
  const api=setup();api.confirm.mockRejectedValue(new Error('expired'));fireEvent.click(await find());fireEvent.click(screen.getByRole('button',{name:'Confirmer cet établissement'}));
  await screen.findByRole('alert');expect(api.saved).not.toHaveBeenCalled();
});

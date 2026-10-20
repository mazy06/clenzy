import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import BaitlyCrmLocationEditor from './BaitlyCrmLocationEditor';
import {baitlyCrmLocationsApi} from '../../services/api/baitlyCrmLocationsApi';
import {geocoderApi} from '../../services/geocoderApi';
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr'})}));
vi.mock('../../components/BaitlyPropertyMap',()=>({BaitlyPropertyMap:({properties,camera}:any)=><div data-testid="location-map" data-markers={JSON.stringify(properties)} data-camera={JSON.stringify(camera)}/> }));
beforeEach(()=>{vi.spyOn(baitlyCrmLocationsApi,'list').mockResolvedValue([]);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function setup(canManage=true){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><BaitlyCrmLocationEditor id={7} org={10} canManage={canManage} /></QueryClientProvider>);}
it('requires an explicit place search, selection and confirmation before saving coordinates',async()=>{
  const search=vi.spyOn(geocoderApi,'searchCities').mockResolvedValue([{label:'Rabat, Maroc',latitude:34.0209,longitude:-6.8416}] as never);
  const save=vi.spyOn(baitlyCrmLocationsApi,'save').mockResolvedValue(undefined);setup();
  fireEvent.click(await screen.findByRole('button',{name:'Localiser ce contact'}));fireEvent.change(screen.getByLabelText('Rechercher un lieu'),{target:{value:'Rabat'}});
  expect(search).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Confirmer la localisation'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Rechercher le lieu'}));fireEvent.click(await screen.findByRole('button',{name:'Rabat, Maroc'}));
  expect(JSON.parse(screen.getByTestId('location-map').getAttribute('data-markers')!)[0]).toMatchObject({lat:34.0209,lng:-6.8416});
  expect(save).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Confirmer la localisation'}));
  await waitFor(()=>expect(save).toHaveBeenCalledWith(7,{label:'Rabat, Maroc',latitude:34.0209,longitude:-6.8416,precision:'CITY'}));
});
it('clears a selected location when its country changes without another automatic search',async()=>{
  const search=vi.spyOn(geocoderApi,'searchCities').mockResolvedValue([{label:'Rabat, Maroc',latitude:34.0,longitude:-6.8}] as never);setup();
  fireEvent.click(await screen.findByRole('button',{name:'Localiser ce contact'}));fireEvent.change(screen.getByLabelText('Rechercher un lieu'),{target:{value:'Rabat'}});fireEvent.click(screen.getByRole('button',{name:'Rechercher le lieu'}));fireEvent.click(await screen.findByRole('button',{name:'Rabat, Maroc'}));
  fireEvent.change(screen.getByLabelText('Pays'),{target:{value:'FR'}});expect(screen.getByRole('button',{name:'Confirmer la localisation'})).toBeDisabled();expect(search).toHaveBeenCalledTimes(1);
});
it('keeps location editing unavailable to a read-only CRM user',async()=>{
  setup(false);await screen.findByText('Localisation non confirmée');expect(screen.queryByRole('button',{name:'Localiser ce contact'})).not.toBeInTheDocument();
  expect(screen.getByTestId('location-map')).toHaveAttribute('data-markers','[]');
});
it('shows the saved location on the map for a read-only user',async()=>{
  vi.mocked(baitlyCrmLocationsApi.list).mockResolvedValue([{prospect_id:7,label:'Rabat',latitude:34,longitude:-6.8,precision:'CITY'}]);
  setup(false);await screen.findByText('Rabat · Centre de ville');
  expect(JSON.parse(screen.getByTestId('location-map').getAttribute('data-markers')!)[0]).toMatchObject({id:7,lat:34,lng:-6.8});
});

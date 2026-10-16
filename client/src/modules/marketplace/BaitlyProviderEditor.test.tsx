import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BaitlyProviderEditor from './BaitlyProviderEditor';
import type { ProviderDetailDto } from '../../services/api/marketplaceProvidersApi';
const api=vi.hoisted(() => ({updateProfile:vi.fn(),getCategories:vi.fn()}));
vi.mock('../../services/api/marketplaceProvidersApi',()=>({marketplaceProvidersApi:api}));
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({t:(key:string)=>key})}));
vi.mock('../../components/AddressAutocomplete',()=>({AddressAutocomplete:({value,label,onChange,onSelect}:any)=><div>
  <label>{label}<input value={value} onChange={e=>onChange(e.target.value)}/></label>
  <button type="button" onClick={()=>onSelect({label:'10 rue de Paris',city:'Paris',postcode:'75011',countryCode:'FR',latitude:48.86,longitude:2.38})}>Choisir cette adresse</button>
</div>}));
vi.mock('./BaitlyProviderProfile',()=>({BaitlyProfileSection:({title,children}:{title:string;children:React.ReactNode})=><section><h3>{title}</h3>{children}</section>}));
vi.mock('../../components/ServiceItemSelect',()=>({default:({onChange}:{onChange:(item:{code:string})=>void})=><button type="button" onClick={()=>onChange({code:'cleaning-turnover'})}>Ménage entre deux séjours</button>}));
const provider={id:27,displayName:'Salma',baseCountryCode:'MA',baseCity:'Marrakech',languages:['fr'],acceptsUrgent:false,
  offers:[{id:32,label:'Prestation à l’heure',categoryLabelFr:'Ménage',active:true,serviceItemCode:'cleaning-turnover'}]} as ProviderDetailDto;
const setup=(data=provider)=>{
  const onCancel=vi.fn(),onSaved=vi.fn();
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{mutations:{retry:false},queries:{retry:false}}})}>
    <BaitlyProviderEditor provider={data} onCancel={onCancel} onSaved={onSaved}/>
  </QueryClientProvider>);return {onCancel,onSaved};
};
describe('provider editing',()=>{
  beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>['Paris','Courbevoie','Neuilly-sur-Seine']}));api.getCategories.mockResolvedValue([{code:'CLEANING',labelFr:'Ménage',items:[{code:'cleaning-turnover',labelFr:'Ménage existant'}]},{code:'CULINARY',labelFr:'Cuisine',items:[{code:'culinary-breakfast',labelFr:'Petit-déjeuner'}]}]);});
  it('saves multi-trade choices with the profile only on submit',async()=>{
    api.updateProfile.mockResolvedValue(provider);const {onSaved}=setup();
    fireEvent.click(await screen.findByLabelText('Petit-déjeuner'));
    expect(api.updateProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'providerEdit.save'}));
    await waitFor(()=>expect(onSaved).toHaveBeenCalled());
    expect(api.updateProfile).toHaveBeenCalledWith(27,expect.objectContaining({selectedServiceCodes:['cleaning-turnover','culinary-breakfast']}));
  });
  it('saves the profile and selected canonical reference only on submit',async()=>{
    api.updateProfile.mockResolvedValue({...provider,displayName:'Salma Chraibi'});const {onSaved}=setup();
    fireEvent.change(screen.getByLabelText('providerEdit.displayName'),{target:{value:'Salma Chraibi'}});
    fireEvent.click(screen.getByText('Ménage entre deux séjours'));
    expect(api.updateProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'providerEdit.save'}));
    await waitFor(()=>expect(onSaved).toHaveBeenCalled());
    expect(api.updateProfile).toHaveBeenCalledWith(27,expect.objectContaining({displayName:'Salma Chraibi',references:[{offerId:32,serviceItemCode:'cleaning-turnover'}]}));
  });
  it('cancels without writing',()=>{
    const {onCancel}=setup();fireEvent.click(screen.getByRole('button',{name:'providerEdit.cancel'}));
    expect(onCancel).toHaveBeenCalled();expect(api.updateProfile).not.toHaveBeenCalled();
  });
  it('keeps the form open and shows an error after a failed save',async()=>{
    api.updateProfile.mockRejectedValue(new Error('Tarif déjà existant'));const {onSaved}=setup();
    fireEvent.click(screen.getByRole('button',{name:'providerEdit.save'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tarif déjà existant');expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByLabelText('providerEdit.displayName')).toHaveValue('Salma');
  });
  it('adds a department and an arrondissement while retaining the geolocated radius',async()=>{
    api.updateProfile.mockResolvedValue(provider);const {onSaved}=setup();
    fireEvent.click(screen.getByRole('button',{name:'Choisir cette adresse'}));
    fireEvent.change(screen.getByLabelText('providerEdit.radius'),{target:{value:'15'}});
    fireEvent.click(screen.getByRole('button',{name:'coverageZone.add'}));
    fireEvent.change(screen.getByLabelText('coverageZone.department'),{target:{value:'75'}});
    fireEvent.change(screen.getByLabelText('coverageZone.arrondissement'),{target:{value:'75111'}});
    expect(api.updateProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'providerEdit.save'}));
    await waitFor(()=>expect(onSaved).toHaveBeenCalled());
    expect(api.updateProfile).toHaveBeenCalledWith(27,expect.objectContaining({travelRadiusKm:15,latitude:48.86,longitude:2.38,
      zones:[expect.objectContaining({countryCode:'FR',department:'75',arrondissement:'75111'})]}));
  });
  it('preserves sectors on profile edits and can remove them without removing the radius',async()=>{
    api.updateProfile.mockResolvedValue(provider);
    const data={...provider,latitude:48.86,longitude:2.38,travelRadiusKm:10,zones:[{id:1,countryCode:'FR',department:'75',arrondissement:'75111',primary:true}]};
    setup(data);
    expect(screen.getByLabelText('coverageZone.department')).toHaveValue('75');
    expect(screen.getByLabelText('coverageZone.arrondissement')).toHaveValue('75111');
    fireEvent.click(screen.getByRole('button',{name:'coverageZone.remove'}));
    fireEvent.click(screen.getByRole('button',{name:'providerEdit.save'}));
    await waitFor(()=>expect(api.updateProfile).toHaveBeenCalledWith(27,expect.objectContaining({zones:[],travelRadiusKm:10})));
  });
  it('clears stale coordinates when the base location changes',async()=>{
    api.updateProfile.mockResolvedValue(provider);setup({...provider,latitude:48.86,longitude:2.38});
    fireEvent.change(screen.getByLabelText('providerEdit.baseCity'),{target:{value:'Lyon'}});
    fireEvent.click(screen.getByRole('button',{name:'providerEdit.save'}));
    await waitFor(()=>expect(api.updateProfile).toHaveBeenCalledWith(27,expect.objectContaining({latitude:null,longitude:null})));
  });
  it('saves one city within a department and clears it when switching departments',async()=>{
    api.updateProfile.mockResolvedValue(provider);setup({...provider,baseCountryCode:'FR',zones:[{id:1,countryCode:'FR',department:'92',primary:true}]});
    const city=screen.getByLabelText('providerCoverage.cityOptional');
    await screen.findByRole('option',{name:'Courbevoie'});
    fireEvent.change(city,{target:{value:'Courbevoie'}});
    fireEvent.click(screen.getByRole('button',{name:'providerEdit.save'}));
    await waitFor(()=>expect(api.updateProfile).toHaveBeenCalledWith(27,expect.objectContaining({zones:[expect.objectContaining({department:'92',city:'Courbevoie'})]})));
    fireEvent.change(screen.getByLabelText('coverageZone.department'),{target:{value:'93'}});
    expect(city).toHaveValue('');
    fireEvent.click(screen.getByRole('button',{name:'providerEdit.save'}));
    await waitFor(()=>expect(api.updateProfile).toHaveBeenLastCalledWith(27,expect.objectContaining({zones:[expect.objectContaining({department:'93',city:undefined,arrondissement:undefined})]})));
  });
});

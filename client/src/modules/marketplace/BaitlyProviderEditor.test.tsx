import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BaitlyProviderEditor from './BaitlyProviderEditor';
import type { ProviderDetailDto } from '../../services/api/marketplaceProvidersApi';
const api=vi.hoisted(() => ({updateProfile:vi.fn(),getCategories:vi.fn()}));
vi.mock('../../services/api/marketplaceProvidersApi',()=>({marketplaceProvidersApi:api}));
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({t:(key:string)=>key})}));
vi.mock('./BaitlyProviderProfile',()=>({BaitlyProfileSection:({title,children}:{title:string;children:React.ReactNode})=><section><h3>{title}</h3>{children}</section>}));
vi.mock('../../components/ServiceItemSelect',()=>({default:({onChange}:{onChange:(item:{code:string})=>void})=><button type="button" onClick={()=>onChange({code:'cleaning-turnover'})}>Ménage entre deux séjours</button>}));
const provider={id:27,displayName:'Salma',baseCountryCode:'MA',baseCity:'Marrakech',languages:['fr'],acceptsUrgent:false,
  offers:[{id:32,label:'Prestation à l’heure',categoryLabelFr:'Ménage',active:true,serviceItemCode:'cleaning-turnover'}]} as ProviderDetailDto;
const setup=()=>{
  const onCancel=vi.fn(),onSaved=vi.fn();
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{mutations:{retry:false},queries:{retry:false}}})}>
    <BaitlyProviderEditor provider={provider} onCancel={onCancel} onSaved={onSaved}/>
  </QueryClientProvider>);return {onCancel,onSaved};
};
describe('provider editing',()=>{
  beforeEach(()=>{vi.clearAllMocks();api.getCategories.mockResolvedValue([{code:'CLEANING',labelFr:'Ménage',items:[{code:'cleaning-turnover',labelFr:'Ménage existant'}]},{code:'CULINARY',labelFr:'Cuisine',items:[{code:'culinary-breakfast',labelFr:'Petit-déjeuner'}]}]);});
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
});

import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyProviderServices from './MyProviderServices';
const api=vi.hoisted(()=>({get:vi.fn(),put:vi.fn()}));
vi.mock('../../services/apiClient',()=>({default:api}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({user:{id:7,organizationId:1}})}));
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({t:(key:string)=>key,currentLanguage:'fr'})}));
vi.mock('../../components/PageHeaderActionsContext',()=>({usePageHeaderActions:(action:React.ReactNode)=>action}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it.each(['HOURLY','FLAT'])('saves a per-service %s rate through the same canonical endpoint',async(model)=>{
  api.get.mockImplementation((path:string)=>Promise.resolve(path==='/my-provider-services'?{services:[],options:[{key:'plumbing',labelFr:'Plomberie',labelEn:'Plumbing'}]}:[]));
  api.put.mockResolvedValue({});show();await screen.findByRole('option',{name:'Plomberie'});
  fireEvent.change(screen.getByRole('combobox',{name:'providerServices.choose'}),{target:{value:'plumbing'}});
  fireEvent.change(screen.getByRole('combobox',{name:'providerTariff.model'}),{target:{value:model}});
  fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'45'}});
  fireEvent.click(screen.getByRole('button',{name:'providerServices.save'}));
  await waitFor(()=>expect(api.put).toHaveBeenCalledWith('/my-provider-services?key=plumbing',expect.objectContaining({pricingModel:model,amount:45})));
});
function show() {
  const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  render(<QueryClientProvider client={client}><MyProviderServices/></QueryClientProvider>);
}
it('edits a free service containing a slash through the canonical endpoint',async()=>{
  const service={key:'custom:2:lit/pièce',label:'Lit ou pièce',pricingModel:'PER_UNIT',amount:25,currency:'MAD',unitLabel:'lit',enabled:true,needsReview:false};
  api.get.mockImplementation((path:string) => Promise.resolve(path === '/my-provider-services' ? {services:[service],options:[]} : []));api.put.mockResolvedValue({...service,amount:30});
  show();await screen.findByRole('option',{name:'Lit ou pièce'});
  fireEvent.change(screen.getByRole('combobox',{name:'providerServices.choose'}),{target:{value:service.key}});
  fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'30'}});
  fireEvent.click(screen.getByRole('button',{name:'providerServices.save'}));
  await waitFor(()=>expect(api.put).toHaveBeenCalledWith('/my-provider-services?key='+encodeURIComponent(service.key),
    {pricingModel:'PER_UNIT',amount:30,currency:'MAD',unitLabel:'lit',enabled:true}));
});
it('requires the billing unit before saving a per-unit price',async()=>{
  api.get.mockImplementation((path:string) => Promise.resolve(path === '/my-provider-services' ? {services:[],options:[{key:'cleaning',labelFr:'Ménage',labelEn:'Cleaning'}]} : []));
  show();await screen.findByRole('option',{name:'Ménage'});
  fireEvent.change(screen.getByRole('combobox',{name:'providerServices.choose'}),{target:{value:'cleaning'}});
  fireEvent.change(screen.getByRole('combobox',{name:'providerTariff.model'}),{target:{value:'PER_UNIT'}});
  fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'30'}});
  expect(screen.getByRole('button',{name:'providerServices.save'})).toBeDisabled();
  expect(api.put).not.toHaveBeenCalled();
});

import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { afterEach,expect,it,vi } from 'vitest';
import BaitlyCrmInquiries from './BaitlyCrmInquiries';
import { baitlyInquiriesApi } from '../../services/api/baitlyInquiriesApi';
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr',t:(key:string)=>key})}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('guides managers to forms from an empty inbox and hides that action in read-only mode',async()=>{
  vi.spyOn(baitlyInquiriesApi,'list').mockResolvedValue({totalElements:0,content:[]});const onPrepareForms=vi.fn();
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  const {rerender}=render(<QueryClientProvider client={client}><BaitlyCrmInquiries org={30} canManage onPrepareForms={onPrepareForms}/></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button',{name:'Préparer mes formulaires'}));expect(onPrepareForms).toHaveBeenCalledOnce();
  rerender(<QueryClientProvider client={client}><BaitlyCrmInquiries org={30} canManage={false} onPrepareForms={onPrepareForms}/></QueryClientProvider>);
  expect(screen.queryByRole('button',{name:'Préparer mes formulaires'})).not.toBeInTheDocument();
});
it('renders candidate trade, availability and original recruitment in the existing CRM inbox',async()=>{
  vi.spyOn(baitlyInquiriesApi,'list').mockResolvedValue({totalElements:1,content:[{id:1,prospect_id:22,profile_id:'public',purpose:'APPLICATION',name:'Samira',email:'samira@example.com',city:'Rabat',property_type:'OTHER',reply_channel:'EMAIL',needs_review:true,status:'NEW',created_at:'2026-10-19T12:00:00Z',recruitment_title:'Ménage à Rabat',application_services:['CLEANING'],application_availability:'Weekends'}]});
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><BaitlyCrmInquiries org={30} canManage={false} /></QueryClientProvider>);
  expect(await screen.findByRole('heading',{name:'Samira'})).toBeInTheDocument();
  fireEvent.click(screen.getByText('Samira').closest('summary')!);fireEvent.click(screen.getByText('Provenance'));
  expect(screen.getByText('Métiers proposés : Ménage')).toBeInTheDocument();expect(screen.getByText('Disponibilités et zone : Weekends')).toBeInTheDocument();
  expect(screen.getByText('Page de recrutement /recrutement/public')).toBeInTheDocument();expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

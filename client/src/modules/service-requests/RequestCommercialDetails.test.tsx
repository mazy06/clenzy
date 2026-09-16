import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import RequestCommercialDetails, { RequestCommercialBatch } from './RequestCommercialDetails';

const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}));
vi.mock('../../services/apiClient',()=>({default:api}));
vi.mock('../../hooks/useAuth',()=>({useAuth:()=>({hasAnyRole:(roles:string[])=>roles.includes('HOUSEKEEPER')})}));
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr',t:(key:string,options?:{count:number})=>key+(options?.count!=null?' '+options.count:'')})}));
const proposal={id:3,requestId:1,status:'PENDING',expiresAt:new Date(Date.now()+40*60_000).toISOString()};
function show(data:unknown,status='PENDING',interventionId?:number) {
  api.get.mockResolvedValue(data);
  const cache=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  render(<MemoryRouter><QueryClientProvider client={cache}><RequestCommercialBatch ids={[1]}>
    <RequestCommercialDetails id={1} status={status} estimate={100} interventionId={interventionId}/>
  </RequestCommercialBatch></QueryClientProvider></MemoryRouter>);
}
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('shows a signed difference between the proposed amount and my rate',async()=>{
  show([{requestId:1,proposal:null,price:{amount:150,currency:'EUR'},quote:false,estimate:105,estimateCurrency:'EUR'}]);
  expect(await screen.findByText(/\+45,00/)).toHaveClass('text-warning-ink');
});
it('shows the numeric difference without inventing a missing historical currency',async()=>{
  show([{requestId:1,proposal:null,price:{amount:150,currency:'EUR'},quote:false,estimate:105}]);
  expect(await screen.findByText('+45')).toHaveClass('text-warning-ink');
});
it('does not subtract prices in different currencies',async()=>{
  show([{requestId:1,proposal:null,price:{amount:150,currency:'EUR'},quote:false,estimate:105,estimateCurrency:'MAD'}]);
  await screen.findByText('requestCommercial.price');
  expect(screen.queryByText(/\+45/)).not.toBeInTheDocument();
});
it.each([[80, '-25,00', 'text-success-ink'], [105, '0,00', 'text-muted-foreground']] as const)
('shows the lower or equal rate difference (%s)',async(amount,text,tone)=>{
  show([{requestId:1,proposal:null,price:{amount,currency:'EUR'},quote:false,estimate:105,estimateCurrency:'EUR'}]);
  expect(await screen.findByText(content=>content.startsWith(text))).toHaveClass(tone);
});
it('opens the existing intervention instead of asking for a second acceptance',async()=>{
  show([{requestId:1,proposal:null,price:null,quote:false}], 'PENDING',51);
  expect(screen.getByRole('link',{name:'marketplaceQuotes.openMission'})).toHaveAttribute('href','/interventions/51');
  expect(screen.queryByText('requestCommercial.noActiveProposal')).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'requestCommercial.accept'})).not.toBeInTheDocument();
});
it('keeps the estimate visible when no provider rate is published',async()=>{
  show([{requestId:1,proposal:null,price:null,quote:false,estimate:75,estimateCurrency:'MAD'}]);
  expect(await screen.findByText('requestCommercial.priceUnconfirmed')).toBeInTheDocument();
  expect(screen.getByText('field.proposals.asked')).toBeInTheDocument();
  expect(screen.getByText(/75.*MAD/)).toBeInTheDocument();
});
it('loads a bounded batch and accepts the actual proposal at its own price',async()=>{
  show([{requestId:1,proposal,price:{amount:80,currency:'MAD'},quote:false,estimate:100}]);
  expect(await screen.findByText('requestCommercial.expires 40')).toBeInTheDocument();
  expect(screen.getByLabelText('requestCommercial.myProposal')).toHaveValue(80);
  expect(screen.getByText('requestCommercial.suggestedPrice')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/service-assignments/cards',{params:{ids:'1'}});
  api.post.mockResolvedValue({status:'ACCEPTED',interventionId:44});
  fireEvent.click(screen.getByRole('button',{name:'requestCommercial.confirmPrice'}));
  await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/service-assignments/requests/1/proposals/3/response',{accept:true,reason:undefined}));
});
it('shows only my quote, without an estimate or self-acceptance',async()=>{
  show([{requestId:1,proposal:null,price:{amount:120,currency:'EUR'},quote:true,estimate:100}]);
  expect(await screen.findByText('requestCommercial.quote')).toBeInTheDocument();
  expect(screen.queryByText('requestCommercial.estimate')).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'requestCommercial.confirmPrice'})).not.toBeInTheDocument();
});
it('disables acceptance at expiration',async()=>{
  show([{requestId:1,proposal:{...proposal,expiresAt:'2020-01-01T00:00:00Z'},price:{amount:80,currency:'EUR'},quote:false}]);
  expect(await screen.findByRole('button',{name:'requestCommercial.confirmPrice'})).toBeDisabled();
  expect(screen.getByText('requestCommercial.expired')).toBeInTheDocument();
});
it('does not invent an acceptance or countdown for historical requests',async()=>{
  show([{requestId:1,proposal:null,price:{amount:80,currency:'EUR'},quote:false}]);
  await screen.findByText('requestCommercial.price');
  expect(screen.getByRole('button',{name:'requestCommercial.accept'})).toBeDisabled();
  expect(screen.getByText('requestCommercial.noActiveProposal')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'requestCommercial.openRequest'})).toHaveAttribute('href','/service-requests/1');
  expect(screen.queryByText(/requestCommercial.expires/)).not.toBeInTheDocument();
});
it('does not label a missing historical tariff as a required quote',async()=>{
  show([{requestId:1,proposal:null,price:null,quote:false}]);
  expect(await screen.findByText('requestCommercial.priceUnconfirmed')).toBeInTheDocument();
  expect(screen.queryByText('requestCommercial.toQuote')).not.toBeInTheDocument();
});
it('does not ask to resend a proposal for a cancelled request',async()=>{
  show([{requestId:1,proposal:null,price:null,quote:false}],'CANCELLED');
  await screen.findByText('requestCommercial.priceUnconfirmed');
  expect(screen.queryByText('requestCommercial.noActiveProposal')).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'requestCommercial.confirmPrice'})).not.toBeInTheDocument();
});
it('allows accepting the offered estimate even without a published provider rate',async()=>{
  show([{requestId:1,proposal,price:null,offeredPrice:{amount:65,currency:'EUR',tariffId:null},quote:false}]);
  expect(await screen.findByRole('button',{name:'requestCommercial.confirmPrice'})).toBeEnabled();
  expect(screen.getByLabelText('requestCommercial.myProposal')).toHaveValue(65);
});
it('submits a counteroffer through the existing quote command and preserves the provider currency',async()=>{
  show([{requestId:1,proposal,price:{amount:80,currency:'MAD'},offeredPrice:{amount:65,currency:'EUR',tariffId:null},quote:false}]);
  await screen.findByRole('slider',{name:'requestCommercial.adjustPrice'});
  expect(screen.getByLabelText('requestCommercial.myProposal')).toHaveValue(80);
  expect(screen.getByLabelText('assignmentFlow.currency')).toHaveValue('MAD');
  expect(screen.queryByRole('button',{name:'requestCommercial.confirmPrice'})).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('requestCommercial.myProposal'),{target:{value:'90'}});
  fireEvent.change(screen.getByLabelText('assignmentFlow.validUntil'),{target:{value:'2026-12-01'}});
  api.post.mockResolvedValue(5);
  fireEvent.click(screen.getByRole('button',{name:'assignmentFlow.sendQuote'}));
  await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/service-assignments/requests/1/proposals/3/quote',{
    amount:90,currency:'MAD',validUntil:'2026-12-01',description:''
  }));
});

it('adjusts the amount with the keyboard slider and restores direct acceptance at the suggested price',async()=>{
  show([{requestId:1,proposal,price:{amount:80,currency:'EUR'},offeredPrice:{amount:80,currency:'EUR'},quote:false}]);
  const slider=await screen.findByRole('slider',{name:'requestCommercial.adjustPrice'});
  fireEvent.keyDown(slider,{key:'ArrowRight'});
  expect(screen.getByLabelText('requestCommercial.myProposal')).toHaveValue(81);
  expect(screen.queryByRole('button',{name:'requestCommercial.confirmPrice'})).not.toBeInTheDocument();
  fireEvent.keyDown(slider,{key:'ArrowLeft'});
  expect(screen.getByLabelText('requestCommercial.myProposal')).toHaveValue(80);
  expect(screen.getByRole('button',{name:'requestCommercial.confirmPrice'})).toBeEnabled();
  expect(api.post).not.toHaveBeenCalled();
});

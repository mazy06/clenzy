import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BaitlyAffiliateReceipts from './BaitlyAffiliateReceipts';
import { activitiesApi } from '../../../services/api/activitiesApi';
import { propertiesApi } from '../../../services/api/propertiesApi';
import { useAuth } from '../../../hooks/useAuth';
vi.mock('../../../hooks/useTranslation', () => ({useTranslation: () => ({t:(key:string)=>key,currentLanguage:'fr'})}));
vi.mock('../../../hooks/useAuth', () => ({useAuth:vi.fn()}));
vi.mock('../../../services/api/activitiesApi', () => ({activitiesApi:{listCommissions:vi.fn(),receiveCommission:vi.fn(),cancelCommission:vi.fn(),commissionAdjustments:vi.fn()}}));
vi.mock('../../../services/api/propertiesApi', () => ({propertiesApi:{getAll:vi.fn()}}));
const row={id:7,provider:'VIATOR',externalBookingId:'VT-7',grossCommission:100,hostShare:80,platformShare:20,currency:'EUR',propertyId:3,status:'PENDING' as const,receiptReference:null,receivedAt:null};
beforeEach(() => {
  vi.mocked(activitiesApi.commissionAdjustments).mockResolvedValue([]);
  vi.mocked(useAuth).mockReturnValue({hasAnyRole:()=>true} as any);
  vi.mocked(activitiesApi.listCommissions).mockResolvedValue([row]);
  vi.mocked(propertiesApi.getAll).mockResolvedValue([{id:3,name:'Riad test'}] as any);
});
afterEach(()=>{cleanup();vi.clearAllMocks();});
async function open() {
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><BaitlyAffiliateReceipts /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button',{name:/VIATOR/}));
}
it('requires the evidence, exact amount and receipt date before enabling reconciliation',async()=>{
  await open();
  const save=screen.getByRole('button',{name:'affiliateReceipts.receive'});
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText('affiliateReceipts.reference'),{target:{value:'BANK-7'}});
  fireEvent.change(screen.getByLabelText('affiliateReceipts.date'),{target:{value:'2026-01-02T10:30'}});
  fireEvent.change(screen.getByLabelText('affiliateReceipts.amount (EUR)'),{target:{value:'99'}});
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText('affiliateReceipts.amount (EUR)'),{target:{value:'100'}});
  expect(save).not.toBeDisabled();
  let resolve!: (value:any)=>void;
  vi.mocked(activitiesApi.receiveCommission).mockReturnValue(new Promise(r=>{resolve=r;}));
  fireEvent.click(save);fireEvent.click(save);
  await waitFor(()=>expect(activitiesApi.receiveCommission).toHaveBeenCalledTimes(1));
  expect(activitiesApi.receiveCommission).toHaveBeenCalledWith(7,expect.objectContaining({propertyId:3,amount:100,currency:'EUR',reference:'BANK-7'}));
  resolve({...row,status:'RECEIVED'});
  await waitFor(()=>expect(save).not.toBeDisabled());
});
it('never lets an owner declare a programme receipt',async()=>{
  vi.mocked(useAuth).mockReturnValue({hasAnyRole:()=>false} as any);
  await open();
  expect(screen.queryByRole('button',{name:'affiliateReceipts.receive'})).toBeNull();
  expect(propertiesApi.getAll).not.toHaveBeenCalled();
});
it('does not allow a historical paid row to be credited again',async()=>{
  vi.mocked(activitiesApi.listCommissions).mockResolvedValue([{...row,status:'PAID'}]);
  await open();
  expect(screen.getByText('affiliateReceipts.legacy')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'affiliateReceipts.receive'})).toBeNull();
});

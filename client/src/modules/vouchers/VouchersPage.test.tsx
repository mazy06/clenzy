import { act, render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import VouchersPage from './VouchersPage';
import type { BookingVoucher } from '../../services/api/bookingVouchersApi';

const mocks = vi.hoisted(() => ({ mobile:false, pause:vi.fn(), resume:vi.fn(), remove:vi.fn(), success:vi.fn(), error:vi.fn(), copy:vi.fn(), search:undefined as undefined | ((value:string)=>void) }));
const offers = Array.from({length:11},(_,i)=>({id:i+1,organizationId:1,name:['Bienvenue au Studio Jemmapes','Une semaine à la Villa Caudéran','Une nuit offerte à la Maison Plumereau'][i%3],description:'Pour votre prochain séjour.',code:'SEJOUR-'+(i+1),type:'MANUAL_CODE',discountType:i%3===2?'FREE_NIGHTS':'PERCENTAGE',discountValue:i%3===2?'1':'10',currency:'EUR',status:i===10?'PAUSED':'ACTIVE',validFrom:'2026-10-01',validUntil:'2027-03-31',usageCount:i===0?2:0,maxUsesTotal:80,maxUsesPerGuest:1,minStayNights:3,maxStayNights:null,minTotalAmount:null,channelScope:'ALL',propertyIds:[i+1],createdAt:'2026-10-01',updatedAt:'2026-10-01'} as BookingVoucher));
vi.mock('../../hooks/useBookingVouchers',()=>({
 useBookingVouchersList:()=>({data:offers,isLoading:false,isFetching:false,error:null,refetch:vi.fn()}),
 usePauseBookingVoucher:()=>({mutateAsync:mocks.pause,isPending:false}),
 useResumeBookingVoucher:()=>({mutateAsync:mocks.resume,isPending:false}),
 useDeleteBookingVoucher:()=>({mutateAsync:mocks.remove,isPending:false}),
 useVoucherAnalytics:()=>({data:{from:'2026-09-09',to:'2026-10-09',totalUsages:0,activeVouchersCount:10,topVouchers:[]},isLoading:false,error:null}),
}));
vi.mock('../../hooks/useNotification',()=>({useNotification:()=>({notify:{success:mocks.success,error:mocks.error}})}));
vi.mock('../../components/ScreenChrome',()=>({useScreenSearch:(_value:string,change:(value:string)=>void)=>{mocks.search=change;}}));
vi.mock('../../hooks/use-mobile',()=>({useIsMobile:()=>mocks.mobile}));
vi.mock('./VoucherEditorDialog',()=>({default:()=>null}));
beforeEach(()=>{vi.clearAllMocks();mocks.mobile=false;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:mocks.copy.mockResolvedValue(undefined)}});});
afterEach(cleanup);

it('filters locally and paginates offers',()=>{
 render(<VouchersPage embedded />);
 expect(document.querySelectorAll('.baitly-voucher-offer')).toHaveLength(8);
 fireEvent.click(screen.getByRole('link',{name:'Go to next page'}));
 expect(document.querySelectorAll('.baitly-voucher-offer')).toHaveLength(3);
 fireEvent.click(screen.getByRole('button',{name:/En pause/}));
 expect(document.querySelectorAll('.baitly-voucher-offer')).toHaveLength(1);
 expect(screen.getByText('SEJOUR-11')).toBeInTheDocument();
});
it('confirms copying only after clipboard success and keeps used offers undeletable',async()=>{
 render(<VouchersPage embedded />);
 fireEvent.click(screen.getByRole('button',{name:'Copier le code SEJOUR-1'}));
 await waitFor(()=>expect(mocks.success).toHaveBeenCalledWith('Code copié'));
 expect(mocks.copy).toHaveBeenCalledWith('SEJOUR-1');
 fireEvent.click(screen.getAllByRole('button',{name:'Conditions'})[0]);
 expect(screen.getByRole('button',{name:'Supprimer'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Mettre en pause'}));
 await waitFor(()=>expect(mocks.pause).toHaveBeenCalledWith(1));
});
it('reduces the mobile page size and searches by code',()=>{
 mocks.mobile=true;
 render(<VouchersPage embedded />);
 expect(document.querySelectorAll('.baitly-voucher-offer')).toHaveLength(4);
 act(()=>mocks.search?.('SEJOUR-11'));
 expect(document.querySelectorAll('.baitly-voucher-offer')).toHaveLength(1);
 expect(screen.getByText('SEJOUR-11')).toBeInTheDocument();
});
it('dismisses conditions outside the offer and restores keyboard focus on Escape',()=>{
 render(<VouchersPage embedded />);
 const trigger=screen.getAllByRole('button',{name:'Conditions'})[0];
 fireEvent.click(trigger);
 expect(trigger).toHaveAttribute('aria-expanded','true');
 fireEvent.keyDown(document,{key:'Escape'});
 expect(trigger).toHaveAttribute('aria-expanded','false');
 expect(trigger).toHaveFocus();
 fireEvent.click(trigger);
 fireEvent.pointerDown(document.body);
 expect(trigger).toHaveAttribute('aria-expanded','false');
});

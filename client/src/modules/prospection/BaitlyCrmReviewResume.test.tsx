import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,expect,it,vi} from 'vitest';
import BaitlyCrmReviewResume,{locationReviewKey} from './BaitlyCrmReviewResume';
import {baitlyCrmLocationReviewApi,type BaitlyLocationProgress} from '../../services/api/baitlyCrmLocationReviewApi';
vi.mock('../../hooks/useAuth',()=>({useAuth:()=>({user:{id:7}})}));
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr'})}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function setup(remaining:number){
 vi.spyOn(baitlyCrmLocationReviewApi,'progress').mockResolvedValue({items:[{id:1,status:remaining?'PENDING':'CONFIRMED'}],remaining,confirmed:remaining?0:1,skipped:0,notFound:0} as BaitlyLocationProgress);
 const open=vi.fn();render(<QueryClientProvider client={new QueryClient()}><BaitlyCrmReviewResume org={10} onOpen={open}/></QueryClientProvider>);return open;
}
it('offers a resume entry independent from the in-memory import report',async()=>{
 const open=setup(1);fireEvent.click(await screen.findByRole('button',{name:'Reprendre la localisation (1)'}));expect(open).toHaveBeenCalledOnce();
 expect(locationReviewKey(10,7)).not.toEqual(locationReviewKey(20,7));expect(locationReviewKey(10,7)).not.toEqual(locationReviewKey(10,8));
});
it('keeps the summary accessible after all contacts have been processed',async()=>{
 const open=setup(0);fireEvent.click(await screen.findByRole('button',{name:'Bilan de localisation'}));expect(open).toHaveBeenCalledOnce();
});

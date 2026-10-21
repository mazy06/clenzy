import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,expect,it,vi} from 'vitest';
import {baitlyCrmDetailsApi} from '../../services/api/baitlyCrmDetailsApi';
import BaitlyCrmDetailsEditor from './BaitlyCrmDetailsEditor';
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr'})}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function setup(canManage:boolean){vi.spyOn(baitlyCrmDetailsApi,'list').mockResolvedValue([{prospect_id:1,assigned_user_id:301,assigned_user_name:'Nadia',company_name:'Atlas',job_title:'Gérante',specific_role:'Gestion locale',region:'Rabat',qualification:'QUALIFIED',score:4}]);vi.spyOn(baitlyCrmDetailsApi,'assignees').mockResolvedValue([{id:301,name:'Nadia'}]);render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><BaitlyCrmDetailsEditor id={1} org={10} canManage={canManage}/></QueryClientProvider>);}
it('persists edited CRM fields and preserves the actual assignee and qualification',async()=>{
  const save=vi.spyOn(baitlyCrmDetailsApi,'save').mockResolvedValue();setup(true);await screen.findByText('Atlas');fireEvent.click(screen.getByRole('button',{name:'Compléter les informations CRM'}));
  const company=await screen.findByLabelText('Société');await waitFor(()=>expect(company).toBeEnabled());fireEvent.change(company,{target:{value:'Atlas Gestion'}});fireEvent.click(screen.getByRole('button',{name:'Enregistrer les informations'}));
  await waitFor(()=>expect(save).toHaveBeenCalledWith(1,{assignedUserId:301,companyName:'Atlas Gestion',jobTitle:'Gérante',specificRole:'Gestion locale',region:'Rabat',qualification:'QUALIFIED'}));
});
it('shows actual CRM fields without offering editing to read-only users',async()=>{setup(false);expect(await screen.findByText('Atlas')).toBeInTheDocument();expect(screen.getByText('4/5')).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Compléter les informations CRM'})).not.toBeInTheDocument();});

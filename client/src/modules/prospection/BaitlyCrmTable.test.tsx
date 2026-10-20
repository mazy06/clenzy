import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { useState } from 'react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { afterEach,expect,it,vi } from 'vitest';
import BaitlyCrmTable from './BaitlyCrmTable';
import { baitlyCrmDetailsApi } from '../../services/api/baitlyCrmDetailsApi';
import { prospectsApi } from '../../services/api/prospectsApi';
import type { BaitlyCrmContact } from './baitlyCrmWorkspace';
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr',t:(key:string)=>key})}));
vi.mock('../../hooks/useUserPreference',()=>({useUserPreference:(_key:string,initial:unknown)=>useState(initial)}));
const contact:BaitlyCrmContact={id:1,name:'Samira',contactType:'OWNER',contactNature:'PRIVATE',category:'OWNERS',status:'TO_CONTACT',sourceType:'MANUAL',archived:false,email:'samira@example.com',crm:{prospect_id:1,assigned_user_id:301,assigned_user_name:'Nadia',company_name:'Ancienne société',job_title:'Gérante',region:'Rabat',qualification:'QUALIFIED',score:3}};
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function setup(canManage=true){vi.spyOn(baitlyCrmDetailsApi,'assignees').mockResolvedValue([{id:301,name:'Nadia'}]);const onOpen=vi.fn();render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><BaitlyCrmTable contacts={[contact]} org={10} status="all" canManage={canManage} onOpen={onOpen}/></QueryClientProvider>);return onOpen;}
it('edits a detail in place and writes only after validating with the replacement action',async()=>{
 const save=vi.spyOn(baitlyCrmDetailsApi,'save').mockResolvedValue();const onOpen=setup();
 fireEvent.click(screen.getByRole('button',{name:'Ancienne société'}));fireEvent.change(screen.getByRole('textbox',{name:'Société : Samira'}),{target:{value:'Nouvelle société'}});
 expect(save).not.toHaveBeenCalled();expect(onOpen).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Supprimer : Samira'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'common.save : Samira'}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith(1,expect.objectContaining({companyName:'Nouvelle société',jobTitle:'Gérante',assignedUserId:301,region:'Rabat',qualification:'QUALIFIED'})));
 await waitFor(()=>expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
});
it('cancels a draft without writing and retains it after a failed save',async()=>{
 const save=vi.spyOn(baitlyCrmDetailsApi,'save').mockRejectedValue(new Error('Failed'));setup();
 fireEvent.click(screen.getByRole('button',{name:'Ancienne société'}));fireEvent.keyDown(screen.getByRole('textbox'),{key:'Escape'});expect(save).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Ancienne société'}));fireEvent.change(screen.getByRole('textbox'),{target:{value:'À conserver'}});fireEvent.click(screen.getByRole('button',{name:'common.save : Samira'}));
 await screen.findByRole('alert');expect(screen.getByRole('textbox')).toHaveValue('À conserver');
});
it('validates email and uses a partial contact update',async()=>{
 const update=vi.spyOn(prospectsApi,'update').mockResolvedValue(contact);setup();fireEvent.click(screen.getByRole('button',{name:'samira@example.com'}));
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'invalide'}});fireEvent.click(screen.getByRole('button',{name:'common.save : Samira'}));expect(update).not.toHaveBeenCalled();
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'nouveau@example.com'}});fireEvent.click(screen.getByRole('button',{name:'common.save : Samira'}));await waitFor(()=>expect(update).toHaveBeenCalledWith(1,{email:'nouveau@example.com'}));
});
it('stages dropdown changes and keeps read-only cells unavailable for editing',async()=>{
 const update=vi.spyOn(prospectsApi,'update').mockResolvedValue(contact);setup();fireEvent.change(screen.getByRole('combobox',{name:'Étape de la relation : Samira'}),{target:{value:'IN_DISCUSSION'}});expect(update).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'common.save : Samira'}));await waitFor(()=>expect(update).toHaveBeenCalledWith(1,{status:'IN_DISCUSSION'}));
 cleanup();setup(false);expect(screen.queryByRole('button',{name:'Ancienne société'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'common.save : Samira'})).not.toBeInTheDocument();
});

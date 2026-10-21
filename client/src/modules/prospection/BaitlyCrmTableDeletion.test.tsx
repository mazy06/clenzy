import {useState} from 'react';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import fr from '../../../public/locales/fr.json';
import {prospectsApi} from '../../services/api/prospectsApi';
import {baitlyCrmDetailsApi} from '../../services/api/baitlyCrmDetailsApi';
import BaitlyCrmTable from './BaitlyCrmTable';
import type {BaitlyCrmContact} from './baitlyCrmWorkspace';
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr',t:(key:string,fallback?:unknown)=>key.split('.').reduce((node:any,part)=>node?.[part],fr)??(typeof fallback==='string'?fallback:key)})}));
vi.mock('../../hooks/useUserPreference',()=>({useUserPreference:(_key:string,initial:unknown)=>useState(initial)}));
const contacts:BaitlyCrmContact[]=Array.from({length:11},(_,i)=>({id:i+1,name:`Contact ${String(i+1).padStart(2,'0')}`,contactType:'OWNER',contactNature:'PRIVATE',category:'OWNERS',status:'TO_CONTACT',sourceType:'MANUAL',archived:false}));
beforeEach(()=>{vi.spyOn(baitlyCrmDetailsApi,'assignees').mockResolvedValue([]);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function setup(canManage=true){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><BaitlyCrmTable contacts={contacts} org={10} status="all" canManage={canManage} onOpen={vi.fn()}/></QueryClientProvider>);}
it('requires confirmation for a single removal and cancellation never sends a request',async()=>{
  const remove=vi.spyOn(prospectsApi,'deleteMany').mockResolvedValue();setup();
  fireEvent.click(screen.getByRole('button',{name:'Supprimer : Contact 01'}));expect(remove).not.toHaveBeenCalled();
  let dialog=screen.getByRole('alertdialog');expect(within(dialog).getByRole('heading')).toHaveTextContent('Supprimer 1 contact du CRM ?');
  fireEvent.click(within(dialog).getByRole('button',{name:'Annuler'}));expect(remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Supprimer : Contact 02'}));dialog=screen.getByRole('alertdialog');fireEvent.click(within(dialog).getByRole('button',{name:'Supprimer',exact:true}));
  await waitFor(()=>expect(remove).toHaveBeenCalledWith([2]));await waitFor(()=>expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
});
it('selects all filtered results across pages and sends exactly that complete selection',async()=>{
  const remove=vi.spyOn(prospectsApi,'deleteMany').mockResolvedValue();setup();
  expect(screen.queryByRole('button',{name:'Supprimer : Contact 11'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Tout sélectionner (11)'}));fireEvent.click(screen.getByRole('button',{name:'Supprimer la sélection'}));
  const dialog=screen.getByRole('alertdialog');expect(within(dialog).getByRole('heading')).toHaveTextContent('Supprimer 11 contacts du CRM ?');
  fireEvent.click(within(dialog).getByRole('button',{name:'Supprimer',exact:true}));await waitFor(()=>expect(remove).toHaveBeenCalledWith(contacts.map(contact=>contact.id)));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Supprimer la sélection'})).not.toBeInTheDocument());
});
it('retains the selection and confirmation on a rejected batch instead of claiming success',async()=>{
  const remove=vi.spyOn(prospectsApi,'deleteMany').mockRejectedValue(new Error('Forbidden'));setup();
  fireEvent.click(screen.getByRole('checkbox',{name:'Sélectionner Contact 01'}));fireEvent.click(screen.getByRole('button',{name:'Supprimer la sélection'}));
  const dialog=screen.getByRole('alertdialog');fireEvent.click(within(dialog).getByRole('button',{name:'Supprimer',exact:true}));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Impossible de confirmer la suppression.');expect(remove).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Sélectionner Contact 01')).toBeChecked();
});
it('does not expose individual or grouped removal to read-only members',()=>{
  setup(false);expect(screen.queryByRole('button',{name:/Supprimer :/})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Tout sélectionner (11)'}));expect(screen.queryByRole('button',{name:'Supprimer la sélection'})).not.toBeInTheDocument();
});

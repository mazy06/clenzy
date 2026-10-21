import { cleanup,fireEvent,render,screen,waitFor,within } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { afterEach,expect,it,vi } from 'vitest';
import BaitlyCrmRecruitment from './BaitlyCrmRecruitment';
import { baitlyRecruitmentApi } from '../../services/api/baitlyRecruitmentApi';
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr'})}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function setup(canManage:boolean){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><BaitlyCrmRecruitment org={30} canManage={canManage} /></QueryClientProvider>);}
it('allows an owner organization to publish a specific recruitment need and exposes its public link',async()=>{
  vi.spyOn(baitlyRecruitmentApi,'own').mockResolvedValueOnce({available:true,page:{}}).mockResolvedValue({available:true,page:{id:'public',published:true,recipientName:'Maison Rabat',title:'Ménage',city:'Rabat',services:['CLEANING']}});
  const save=vi.spyOn(baitlyRecruitmentApi,'save').mockResolvedValue({id:'public',published:true,recipientName:'Maison Rabat',title:'Ménage',city:'Rabat',services:['CLEANING']});setup(true);
  fireEvent.change(await screen.findByLabelText('Nom du destinataire affiché publiquement'),{target:{value:'Maison Rabat'}});
  fireEvent.change(screen.getByLabelText('Titre du recrutement'),{target:{value:'Ménage'}});fireEvent.change(screen.getByLabelText('Ville d’intervention'),{target:{value:'Rabat'}});
  fireEvent.click(screen.getByRole('checkbox',{name:'Ménage'}));fireEvent.click(screen.getByRole('checkbox',{name:'Accepter les candidatures sur la page publique'}));
  fireEvent.click(within(screen.getByLabelText('Titre du recrutement').closest('form')!).getByRole('button',{name:'Enregistrer le formulaire'}));
  await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({recipientName:'Maison Rabat',title:'Ménage',city:'Rabat',published:true,services:['CLEANING']}),expect.anything()));
  expect(save.mock.calls[0][0]).not.toHaveProperty('organizationId');
  expect(await screen.findByRole('link',{name:'Ouvrir la page de candidature'})).toHaveAttribute('href','https://baitly.fr/recrutement/public?lang=fr');
  expect(screen.getByRole('status')).toHaveTextContent('Page de recrutement enregistrée.');
});
it('shows the published link but disables edits for read-only CRM members',async()=>{
  vi.spyOn(baitlyRecruitmentApi,'own').mockResolvedValue({available:true,page:{id:'public',published:true,recipientName:'Maison',title:'Ménage',city:'Rabat',services:['CLEANING']}});
  const save=vi.spyOn(baitlyRecruitmentApi,'save');setup(false);
  expect(await screen.findByRole('link',{name:'Ouvrir la page de candidature'})).toHaveAttribute('href','https://baitly.fr/recrutement/public?lang=fr');
  expect(screen.getByLabelText('Titre du recrutement')).toBeDisabled();expect(screen.queryByRole('button',{name:'Enregistrer'})).not.toBeInTheDocument();expect(save).not.toHaveBeenCalled();
});

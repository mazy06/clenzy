import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,expect,it,vi } from 'vitest';
import BaitlyProviderApplicationForm from './BaitlyProviderApplicationForm';
import { baitlyRecruitmentPublicApi } from '../lib/baitlyRecruitmentApi';
vi.mock('../lib/siteLanguage',()=>({useSiteLanguage:()=>({language:'fr'})}));
vi.mock('../../src/config/runtimeConfig',()=>({runtimeEnvOr:(_:string,fallback:string)=>fallback}));
const page={id:'12345678-1234-1234-1234-123456789012',published:true,recipientName:'Maison Rabat',title:'Ménage à Rabat',city:'Rabat',services:['CLEANING','LAUNDRY']};
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function setup(){
  render(<MemoryRouter initialEntries={['/recrutement/'+page.id+'?utm_campaign=partners&organizationId=999&token=secret']}><BaitlyProviderApplicationForm page={page} /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Votre nom ou nom d’activité'),{target:{value:'Samira'}});
  fireEvent.change(screen.getByLabelText('Adresse email'),{target:{value:'samira@example.com'}});
  fireEvent.change(screen.getByLabelText('Ville d’intervention'),{target:{value:'Rabat'}});
}
it('requires named contact request and a trade, then sends a targeted application without private routing',async()=>{
  const apply=vi.spyOn(baitlyRecruitmentPublicApi,'apply').mockResolvedValue();setup();
  const consent=screen.getByRole('checkbox',{name:'Je demande à Maison Rabat de me contacter au sujet de cette candidature.'});
  expect(consent).not.toBeChecked();expect(consent).toBeRequired();fireEvent.click(consent);
  fireEvent.click(screen.getByRole('button',{name:'Envoyer ma candidature'}));
  expect(apply).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('Sélectionnez au moins un métier.');
  fireEvent.click(screen.getByRole('checkbox',{name:'Ménage'}));
  fireEvent.change(screen.getByLabelText('Disponibilités et zone d’intervention'),{target:{value:'Weekends, Rabat'}});
  fireEvent.click(screen.getByRole('button',{name:'Envoyer ma candidature'}));
  await waitFor(()=>expect(apply).toHaveBeenCalledOnce());
  expect(apply.mock.calls[0][0]).toBe(page.id);const payload=apply.mock.calls[0][1];
  expect(payload).toMatchObject({name:'Samira',email:'samira@example.com',city:'Rabat',services:['CLEANING'],availability:'Weekends, Rabat',requestContact:true,utmCampaign:'partners'});
  expect(payload).not.toHaveProperty('organizationId');expect(payload).not.toHaveProperty('token');expect(payload).not.toHaveProperty('marketingConsent');
  expect(await screen.findByRole('status')).toHaveTextContent('Votre candidature a été reçue.');
});
it('retains entered fields on failure and uses the same retry key until the application changes',async()=>{
  const apply=vi.spyOn(baitlyRecruitmentPublicApi,'apply').mockRejectedValue(new Error('offline'));setup();
  fireEvent.click(screen.getByRole('checkbox',{name:'Ménage'}));fireEvent.click(screen.getByRole('checkbox',{name:/Je demande à/}));
  const button=screen.getByRole('button',{name:'Envoyer ma candidature'});fireEvent.click(button);
  await screen.findByRole('alert');expect(screen.getByLabelText('Votre nom ou nom d’activité')).toHaveValue('Samira');fireEvent.click(button);
  await waitFor(()=>expect(apply).toHaveBeenCalledTimes(2));expect(apply.mock.calls[1][1].requestId).toBe(apply.mock.calls[0][1].requestId);
  await waitFor(()=>expect(button).toBeEnabled());fireEvent.change(screen.getByLabelText('Présentation, expérience et conditions'),{target:{value:'5 ans'}});fireEvent.click(button);
  await waitFor(()=>expect(apply).toHaveBeenCalledTimes(3));expect(apply.mock.calls[2][1].requestId).not.toBe(apply.mock.calls[0][1].requestId);
});
it('requires phone only for phone replies and does not prefill a candidate city from the recipient',()=>{
  setup();expect(screen.getByLabelText('Ville d’intervention')).toHaveValue('Rabat');expect(screen.queryByLabelText('Téléphone')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Réponse souhaitée par'),{target:{value:'PHONE'}});expect(screen.getByLabelText('Téléphone')).toBeRequired();
});

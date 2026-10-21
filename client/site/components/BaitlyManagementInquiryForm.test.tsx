import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import BaitlyManagementInquiryForm from './BaitlyManagementInquiryForm';
import { baitlyConciergeApi, type BaitlyConciergeProfile } from '../lib/baitlyConciergeApi';
vi.mock('../lib/siteLanguage',() => ({ useSiteLanguage: () => ({ language:'fr' }) }));
vi.mock('../../src/config/runtimeConfig',() => ({ runtimeEnvOr: (_: string, fallback: string) => fallback }));
const profile={ id:'12345678-1234-1234-1234-123456789012',name:'Accueil Rabat',organization:'Conciergerie Rabat',role:'CONCIERGE',managementServices:[],properties:[] } satisfies BaitlyConciergeProfile;
afterEach(() => {cleanup();vi.restoreAllMocks();});
function setup() {
  render(<MemoryRouter><BaitlyManagementInquiryForm profile={profile} /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Nom complet'),{ target:{ value:'Samira' } });
  fireEvent.change(screen.getByLabelText('Adresse email'),{ target:{ value:'samira@example.com' } });
  fireEvent.change(screen.getByLabelText('Ville du logement'),{ target:{ value:'Rabat' } });
}
it('names the recipient, requires an unchecked request and submits no campaign authorization or organization id',async () => {
  const submit=vi.spyOn(baitlyConciergeApi,'submit').mockResolvedValue(); setup();
  const consent=screen.getByRole('checkbox',{ name:'Je demande à Conciergerie Rabat de me recontacter pour cette demande.' });
  expect(consent).not.toBeChecked();expect(consent).toBeRequired(); fireEvent.click(consent);
  fireEvent.change(screen.getByLabelText('Votre demande'),{ target:{ value:'ESTIMATE' } });
  fireEvent.click(screen.getByRole('button',{ name:'Envoyer ma demande' }));
  await waitFor(() => expect(submit).toHaveBeenCalledOnce());
  const [id,body]=submit.mock.calls[0];expect(id).toBe(profile.id);
  expect(body).toMatchObject({ name:'Samira',email:'samira@example.com',purpose:'ESTIMATE',requestContact:true,replyChannel:'EMAIL' });
  expect(body).not.toHaveProperty('organizationId');expect(body).not.toHaveProperty('marketingConsent');
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Votre demande a bien été reçue.'));
});
it('keeps fields after a failure, reuses the retry key and starts a new request when the project changes',async () => {
  const submit=vi.spyOn(baitlyConciergeApi,'submit').mockRejectedValue(new Error('offline')); setup();
  fireEvent.click(screen.getByRole('checkbox',{ name:/Je demande à/ }));
  const button=screen.getByRole('button',{ name:'Envoyer ma demande' });
  await waitFor(() => expect(button).toBeEnabled());fireEvent.click(button);
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  expect(screen.getByLabelText('Nom complet')).toHaveValue('Samira');fireEvent.click(button);
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
  expect(submit.mock.calls[0][1].requestId).toBe(submit.mock.calls[1][1].requestId);
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Votre projet (facultatif)'),{ target:{ value:'A second home' } });fireEvent.click(button);
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(3));
  expect(submit.mock.calls[2][1].requestId).not.toBe(submit.mock.calls[0][1].requestId);
});
it('requires a phone number only when a phone reply is requested',() => {
  setup();expect(screen.queryByLabelText('Téléphone (avec indicatif pays)')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Comment souhaitez-vous être recontacté ?'),{ target:{ value:'PHONE' } });
  expect(screen.getByLabelText('Téléphone (avec indicatif pays)')).toBeRequired();
});
it('prefills selected property requirements and sends the editable snapshot to the chosen profile',async () => {
  const submit=vi.spyOn(baitlyConciergeApi,'submit').mockResolvedValue();
  render(<MemoryRouter initialEntries={['/conciergeries/'+profile.id+'?city=Rabat&country=MA&propertyType=RIAD&service=CLEANING&maxFee=15']}><BaitlyManagementInquiryForm profile={profile} /></MemoryRouter>);
  expect(screen.getByLabelText('Ville du logement')).toHaveValue('Rabat');
  expect(screen.getByLabelText('Type de logement')).toHaveValue('RIAD');
  expect(screen.getByRole('checkbox',{name:'Ménage'})).toBeChecked();
  fireEvent.change(screen.getByLabelText('Nom complet'),{target:{value:'Alice'}});
  fireEvent.change(screen.getByLabelText('Adresse email'),{target:{value:'alice@example.com'}});
  fireEvent.change(screen.getByLabelText('Commission de gestion maximale en % (facultatif)'),{target:{value:'12.50'}});
  fireEvent.click(screen.getByRole('checkbox',{name:/Je demande à/}));
  fireEvent.click(screen.getByRole('button',{name:'Envoyer ma demande'}));
  await waitFor(() => expect(submit).toHaveBeenCalledWith(profile.id,expect.objectContaining({city:'Rabat',countryCode:'MA',propertyType:'RIAD',requestedServices:['CLEANING'],maxManagementFeePct:12.5})));
});

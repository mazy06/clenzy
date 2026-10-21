import { render,screen,fireEvent,waitFor,cleanup } from '@testing-library/react';
import { MemoryRouter,Routes,Route } from 'react-router-dom';
import { afterEach,expect,it,vi } from 'vitest';
import BaitlyConciergesPage from '../pages/BaitlyConciergesPage';
import { baitlyConciergeApi,type BaitlyConciergeProfile } from '../lib/baitlyConciergeApi';
vi.mock('../lib/siteLanguage',() => ({ useSiteLanguage:()=>({language:'fr'}) }));
vi.mock('../../src/hooks/useTranslation',() => ({ useTranslation:()=>({ t:(_:string,fallback:string)=>fallback }) }));
vi.mock('../../src/config/runtimeConfig',() => ({ runtimeEnvOr:(_:string,fallback:string)=>fallback }));
const profile={id:'12345678-1234-1234-1234-123456789012',name:'Accueil Rabat',organization:'Conciergerie Rabat',city:'Rabat',role:'CONCIERGE',managementServices:['CLEANING'],managementFeePct:12,properties:[]} satisfies BaitlyConciergeProfile;
afterEach(() => {cleanup();vi.restoreAllMocks();});
function setup() {
  render(<MemoryRouter initialEntries={['/conciergeries?utm_source=salon&organizationId=999']}><Routes>
    <Route path="/conciergeries" element={<BaitlyConciergesPage />} /><Route path="/conciergeries/:id" element={<BaitlyConciergesPage />} />
  </Routes></MemoryRouter>);
}
it('finds published profiles for the home and carries the requirements to one targeted inquiry',async () => {
  const search=vi.spyOn(baitlyConciergeApi,'matches').mockResolvedValue({content:[{...profile,countryConfirmed:false,cityEvidence:'PROFILE_CITY'}],totalElements:1,page:0,size:25});
  vi.spyOn(baitlyConciergeApi,'detail').mockResolvedValue(profile);const submit=vi.spyOn(baitlyConciergeApi,'submit');setup();
  await screen.findByRole('link',{name:'Voir le profil'});
  fireEvent.change(screen.getByLabelText('Ville du logement'),{target:{value:'Rabat'}});
  fireEvent.change(screen.getByLabelText('Pays du logement (facultatif)'),{target:{value:'MA'}});
  fireEvent.change(screen.getByLabelText('Type de logement'),{target:{value:'RIAD'}});
  fireEvent.change(screen.getByLabelText('Commission de gestion maximale en % (facultatif)'),{target:{value:'15'}});
  fireEvent.click(screen.getByRole('checkbox',{name:'Ménage'}));
  fireEvent.click(screen.getByRole('button',{name:'Trouver une conciergerie'}));
  await waitFor(() => expect(search).toHaveBeenLastCalledWith({city:'Rabat',country:'MA',propertyType:'RIAD',services:['CLEANING'],maxFee:'15'},0,expect.any(AbortSignal)));
  const link=await screen.findByRole('link',{name:'Voir le profil'});
  expect(link.getAttribute('href')).toContain('utm_source=salon');expect(link.getAttribute('href')).not.toContain('organizationId');
  fireEvent.click(link);
  await screen.findByRole('checkbox',{name:/Je demande à Conciergerie Rabat/});
  expect(screen.getByLabelText('Ville du logement')).toHaveValue('Rabat');expect(screen.getByLabelText('Type de logement')).toHaveValue('RIAD');
  expect(screen.getByRole('checkbox',{name:'Ménage'})).toBeChecked();
  expect(screen.getByRole('checkbox',{name:/Je demande à/})).not.toBeChecked();expect(submit).not.toHaveBeenCalled();
});
it('shows no-match guidance without substituting unrelated profiles',async () => {
  vi.spyOn(baitlyConciergeApi,'matches').mockResolvedValue({content:[],totalElements:0,page:0,size:25});
  const legacy=vi.spyOn(baitlyConciergeApi,'list');setup();
  expect(await screen.findByText(/Aucun profil ne correspond/)).toBeInTheDocument();expect(legacy).not.toHaveBeenCalled();
});
it('paginates through the server results using the shared pagination',async () => {
  const search=vi.spyOn(baitlyConciergeApi,'matches').mockResolvedValue({content:[{...profile,countryConfirmed:false}],totalElements:30,page:0,size:25});setup();
  fireEvent.click(await screen.findByRole('link',{name:'Suivant'}));
  await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.any(Object),1,expect.any(AbortSignal)));
});

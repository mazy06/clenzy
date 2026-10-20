import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { afterEach,expect,it,vi } from 'vitest';
import BaitlyCampaignReplyPage from './BaitlyCampaignReplyPage';
import { baitlyCampaignReplyApi } from '../lib/baitlyCampaignReplyApi';
vi.mock('../lib/siteLanguage',()=>({useSiteLanguage:()=>({language:'fr'})}));
vi.mock('../../src/config/runtimeConfig',()=>({runtimeEnvOr:(_:string,fallback:string)=>fallback}));
const token='a'.repeat(43);afterEach(()=>{cleanup();vi.restoreAllMocks();});
function setup(fragment=token){render(<MemoryRouter initialEntries={['/campagnes/reponse?lang=fr#'+fragment]}><Routes><Route path="/campagnes/reponse" element={<BaitlyCampaignReplyPage />} /></Routes></MemoryRouter>);}
it('requires an explicit submission and binds the response to the opaque fragment without exposing CRM identifiers',async()=>{
  vi.spyOn(baitlyCampaignReplyApi,'lookup').mockResolvedValue({organization:'Maison Rabat'});const respond=vi.spyOn(baitlyCampaignReplyApi,'respond').mockResolvedValue();setup();
  await screen.findByText('Votre réponse sera transmise à Maison Rabat.');expect(respond).not.toHaveBeenCalled();expect(document.body.textContent).not.toContain(token);
  fireEvent.change(screen.getByLabelText('Réponse'),{target:{value:'UNSUBSCRIBE'}});fireEvent.click(screen.getByRole('button',{name:'Transmettre ma réponse'}));
  await waitFor(()=>expect(respond).toHaveBeenCalledOnce());expect(respond.mock.calls[0][0]).toMatchObject({token,response:{decision:'UNSUBSCRIBE'}});expect(respond.mock.calls[0][0]).not.toHaveProperty('organizationId');
  expect(await screen.findByText('Votre réponse a été reçue.')).toBeInTheDocument();
});
it('does not look up a malformed link and shows no reply form',async()=>{
  const lookup=vi.spyOn(baitlyCampaignReplyApi,'lookup');setup('bad');expect(await screen.findByRole('alert')).toHaveTextContent('Ce lien de réponse est indisponible.');expect(lookup).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Transmettre ma réponse'})).not.toBeInTheDocument();
});
it('retains a failed question and its retry key until its contents change',async()=>{
  vi.spyOn(baitlyCampaignReplyApi,'lookup').mockResolvedValue({organization:'Maison Rabat'});const respond=vi.spyOn(baitlyCampaignReplyApi,'respond').mockRejectedValue(new Error('offline'));setup();
  fireEvent.change(await screen.findByLabelText('Réponse'),{target:{value:'QUESTION'}});expect(screen.getByLabelText('Votre message')).toBeRequired();fireEvent.change(screen.getByLabelText('Votre message'),{target:{value:'Quel tarif ?'}});
  const button=screen.getByRole('button',{name:'Transmettre ma réponse'});fireEvent.click(button);await screen.findByRole('alert');fireEvent.click(button);await waitFor(()=>expect(respond).toHaveBeenCalledTimes(2));expect(respond.mock.calls[0][0].response.requestId).toBe(respond.mock.calls[1][0].response.requestId);expect(screen.getByLabelText('Votre message')).toHaveValue('Quel tarif ?');
});

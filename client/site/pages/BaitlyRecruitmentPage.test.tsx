import { cleanup,render,screen } from '@testing-library/react';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { afterEach,expect,it,vi } from 'vitest';
import BaitlyRecruitmentPage from './BaitlyRecruitmentPage';
import { baitlyRecruitmentPublicApi } from '../lib/baitlyRecruitmentApi';
import { BaitlyInquiryError } from '../lib/baitlyConciergeApi';
import { initialPageKey } from '../SiteApp';
vi.mock('../components/SiteMetadata',()=>({default:()=>null}));
vi.mock('../lib/siteLanguage',()=>({useSiteLanguage:()=>({language:'fr'})}));
vi.mock('../../src/config/runtimeConfig',()=>({runtimeEnvOr:(_:string,fallback:string)=>fallback}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const id='12345678-1234-1234-1234-123456789012';
function setup(){render(<MemoryRouter initialEntries={['/recrutement/'+id]}><Routes><Route path="/recrutement/:id" element={<BaitlyRecruitmentPage />} /></Routes></MemoryRouter>);}
it('loads the published recruitment and names its recipient before an external candidate applies',async()=>{
  const get=vi.spyOn(baitlyRecruitmentPublicApi,'page').mockResolvedValue({id,published:true,recipientName:'Maison Rabat',title:'Ménage et accueil',city:'Rabat',countryCode:'MA',services:['CLEANING']});setup();
  expect(initialPageKey('/recrutement/'+id)).toBe('BaitlyRecruitmentPage');
  expect(await screen.findByRole('heading',{level:1,name:'Ménage et accueil'})).toBeInTheDocument();
  expect(screen.getByRole('checkbox',{name:/Je demande à Maison Rabat/})).not.toBeChecked();expect(get).toHaveBeenCalledWith(id,expect.any(AbortSignal));
});
it('offers no application form for a closed publication',async()=>{
  vi.spyOn(baitlyRecruitmentPublicApi,'page').mockRejectedValue(new BaitlyInquiryError(404));setup();
  expect(await screen.findByRole('alert')).toHaveTextContent('Ce recrutement est fermé ou indisponible.');expect(screen.queryByRole('button',{name:'Envoyer ma candidature'})).not.toBeInTheDocument();
});

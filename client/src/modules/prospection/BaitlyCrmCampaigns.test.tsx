import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import BaitlyCrmCampaigns from './BaitlyCrmCampaigns';
import { baitlyCampaignsApi,type BaitlyCampaign,type BaitlyCampaignDetail } from '../../services/api/baitlyCampaignsApi';
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr'})}));
const campaign={id:8,name:'Propriétaires Rabat',contact_type:'OWNER',status:'READY',language:'fr',segment:{type:'OWNER',city:'Rabat'},subject:'Bonjour {{name}}',body:'Gestion de votre bien',organization_name:'Maison Rabat',created_at:'2026-10-19T12:00:00Z'} satisfies BaitlyCampaign;
const detail={campaign,content:[{id:12,prospect_id:2,contact_name:'Alice',email:'alice@example.com',subject:'Bonjour Alice',body:'Gestion de votre bien',status:'QUEUED',responses:[]}],counts:{QUEUED:1},totalElements:1,responded:0} satisfies BaitlyCampaignDetail;
beforeEach(()=>{
  vi.spyOn(baitlyCampaignsApi,'list').mockResolvedValue({content:[],totalElements:0});vi.spyOn(baitlyCampaignsApi,'templates').mockResolvedValue([{id:4,name:'Gestion',contact_type:'OWNER',subject:campaign.subject,body:campaign.body}]);
  vi.spyOn(baitlyCampaignsApi,'detail').mockResolvedValue(detail);vi.spyOn(baitlyCampaignsApi,'transport').mockResolvedValue({available:true});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function setup(canManage=true,canSend=true){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><BaitlyCrmCampaigns org={10} canManage={canManage} canSend={canSend} /></QueryClientProvider>);}
it('prepares a scoped campaign without sending and requires a new preview when its segment changes',async()=>{
  const create=vi.spyOn(baitlyCampaignsApi,'create').mockResolvedValue(campaign);const dispatch=vi.spyOn(baitlyCampaignsApi,'dispatch').mockResolvedValue({accepted:1,unknown:0,skipped:0});
  const preview=vi.spyOn(baitlyCampaignsApi,'preview').mockResolvedValue({total:2,eligible:1,exclusions:{REQUEST_ONLY:1},content:[{id:2,name:'Alice',email:'alice@example.com',reason:'ELIGIBLE'},{id:3,name:'Bob',reason:'REQUEST_ONLY'}],page:0,size:25});setup();
  fireEvent.click(await screen.findByRole('button',{name:'Préparer une campagne'}));
  expect(screen.getByRole('button',{name:'3 Vérification'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Ville contient'),{target:{value:'Rabat'}});fireEvent.click(screen.getByRole('button',{name:'Continuer'}));
  await screen.findByRole('option',{name:'Gestion'},{timeout:10000});fireEvent.change(screen.getByLabelText('Modèle de message'),{target:{value:'4'}});
  fireEvent.click(screen.getByRole('button',{name:'Continuer'}));fireEvent.change(screen.getByLabelText('Nom de la campagne'),{target:{value:'Propriétaires Rabat'}});
  fireEvent.click(screen.getByRole('button',{name:'Vérifier les destinataires'}));await screen.findByText('Réponse isolée uniquement : 1');
  let prepare=screen.getByRole('button',{name:'Préparer sans envoyer'});expect(prepare).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'1 Destinataires'}));
  fireEvent.change(screen.getByLabelText('Ville contient'),{target:{value:'Tanger'}});fireEvent.click(screen.getByRole('button',{name:'3 Vérification'}));prepare=screen.getByRole('button',{name:'Préparer sans envoyer'});expect(prepare).toBeDisabled();expect(create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Vérifier les destinataires'}));await waitFor(()=>expect(prepare).toBeEnabled());fireEvent.click(prepare);
  await screen.findByRole('heading',{name:'Propriétaires Rabat'});expect(create.mock.calls[0][0]).toMatchObject({templateId:4,segment:{type:'OWNER',city:'Tanger'},language:'fr'});expect(create.mock.calls[0][0]).not.toHaveProperty('organizationId');expect(dispatch).not.toHaveBeenCalled();
  const send=screen.getByRole('button',{name:'Envoyer les 10 suivants'});expect(send).toBeDisabled();const consent=screen.getByRole('checkbox',{name:'J’ai vérifié les destinataires et les messages préparés.'});expect(consent).not.toBeChecked();
  fireEvent.click(consent);await waitFor(()=>expect(send).toBeEnabled());fireEvent.click(send);await waitFor(()=>expect(dispatch).toHaveBeenCalledWith(8));
  expect(preview).toHaveBeenCalledWith(expect.objectContaining({type:'OWNER',city:'Tanger'}),0);
});
it('separates read-only CRM access from campaign preparation and dispatch permission',async()=>{
  vi.mocked(baitlyCampaignsApi.list).mockResolvedValue({content:[campaign],totalElements:1});const dispatch=vi.spyOn(baitlyCampaignsApi,'dispatch');setup(false,false);
  expect(screen.queryByRole('button',{name:'Préparer une campagne'})).not.toBeInTheDocument();fireEvent.click(await screen.findByRole('button',{name:'Propriétaires Rabat'}));
  await screen.findByRole('heading',{name:'Propriétaires Rabat'});expect(screen.queryByRole('button',{name:'Envoyer les 10 suivants'})).not.toBeInTheDocument();expect(screen.queryByText('Consigner une réponse hors du lien')).not.toBeInTheDocument();expect(dispatch).not.toHaveBeenCalled();
});
it('does not offer dispatch to a manager lacking the specific sending right',async()=>{
  vi.mocked(baitlyCampaignsApi.list).mockResolvedValue({content:[campaign],totalElements:1});setup(true,false);fireEvent.click(await screen.findByRole('button',{name:'Propriétaires Rabat'}));
  expect(await screen.findByText(/Le droit d’envoi est nécessaire/)).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Envoyer les 10 suivants'})).not.toBeInTheDocument();
});
it('creates a reusable provider template with the selected audience and editable text',async()=>{
  const preview=vi.spyOn(baitlyCampaignsApi,'preview').mockResolvedValue({total:0,eligible:0,exclusions:{},content:[],page:0,size:25});
  const saved={id:9,name:'Partenaires ménage',contact_type:'PROVIDER' as const,subject:'Collaborer à Rabat',body:'Bonjour {{name}}'};
  vi.mocked(baitlyCampaignsApi.templates).mockResolvedValueOnce([]).mockResolvedValue([saved]);const save=vi.spyOn(baitlyCampaignsApi,'saveTemplate').mockResolvedValue(saved);setup();
  fireEvent.click(await screen.findByRole('button',{name:'Préparer une campagne'}));fireEvent.change(screen.getByLabelText('Contacts ciblés'),{target:{value:'PROVIDER'}});
  fireEvent.click(screen.getByRole('button',{name:'Continuer'}));
  fireEvent.click(screen.getByText('Créer ou modifier un modèle'));fireEvent.change(screen.getByLabelText('Nom du modèle'),{target:{value:saved.name}});fireEvent.change(screen.getByLabelText('Objet de l’email'),{target:{value:saved.subject}});fireEvent.change(screen.getByLabelText('Message'),{target:{value:saved.body}});
  fireEvent.click(screen.getByRole('button',{name:'Enregistrer le modèle'}));await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({contactType:'PROVIDER',name:saved.name,subject:saved.subject,body:saved.body}),expect.anything()));
  fireEvent.click(screen.getByRole('button',{name:'1 Destinataires'}));fireEvent.change(screen.getByLabelText('Métier déclaré dans une candidature'),{target:{value:'CLEANING'}});fireEvent.click(screen.getByRole('button',{name:'3 Vérification'}));fireEvent.click(screen.getByRole('button',{name:'Vérifier les destinataires'}));await waitFor(()=>expect(preview).toHaveBeenCalledWith(expect.objectContaining({type:'PROVIDER',trade:'CLEANING'}),0));
});

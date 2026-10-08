import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import type { Invoice } from '../../services/api/invoicesApi';
import BaitlyInvoiceFiscalPanel from './BaitlyInvoiceFiscalPanel';
const context=vi.hoisted(()=>({origin:'',orgRole:'OWNER',org:2}));
vi.mock('../../hooks/useAuth',()=>({useAuth:()=>({user:{id:'staff',organizationId:context.org,orgRole:context.orgRole},isPlatformStaff:()=>false})}));
vi.mock('../../config/api',()=>({API_CONFIG:{get BASE_URL(){return context.origin;},BASE_PATH:'/api'}}));
vi.mock('../../keycloak',()=>({default:{authenticated:false},getAccessToken:()=>undefined}));
const http=financeHttp();beforeAll(async()=>{context.origin=await http.start();});afterAll(()=>http.close());
beforeEach(()=>{context.orgRole='OWNER';context.org=2;});afterEach(()=>{cleanup();expect(http.unexpected).toEqual([]);});
const invoice={id:7,countryCode:'FR',status:'ISSUED',sellerName:'Vendeur TEST',sellerAddress:'Adresse vendeur',buyerName:'Acheteur TEST',buyerAddress:'Adresse acheteur'} as Invoice;
const initial={state:'TO_PREPARE',sourceHash:'a'.repeat(64),documentHash:null,validation:null,archivedAt:null,data:null,issues:[]};
function open() {
  const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  const result=render(<QueryClientProvider client={client}><BaitlyInvoiceFiscalPanel invoice={invoice}/></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button',{name:'Document fiscal électronique'}));return {...result,client};
}
async function fill() {
  await screen.findByRole('group',{name:'Vendeur · France'});
  for (const [label,siren] of [['Vendeur · France','123456789'],['Acheteur · France','987654321']]) {
    const group=within(screen.getByRole('group',{name:label}));
    fireEvent.change(group.getByLabelText('Code postal'),{target:{value:'75001'}});
    fireEvent.change(group.getByLabelText('Ville'),{target:{value:'Paris'}});
    fireEvent.change(group.getByLabelText('SIREN'),{target:{value:siren}});
    fireEvent.change(group.getByLabelText('Adresse de routage (SIREN ou SIREN_suffixe)'),{target:{value:siren}});
  }
  fireEvent.change(screen.getByLabelText('Nature de la facture commerciale'),{target:{value:'S1'}});
  for(const label of ['Mention des frais de recouvrement','Mention des pénalités de retard','Mention de l’escompte'])
    fireEvent.change(screen.getByLabelText(label),{target:{value:`TEST ${label}`}});
}
it('contrôle par HTTP puis archive explicitement sans annoncer de transmission',async()=>{
  http.route((req,res)=>{
    if(req.method==='GET')return json(res,initial);
    const body=JSON.parse(req.body);expect(body.sourceHash).toBe(initial.sourceHash);expect(body.data.buyer.legalId).toBe('987654321');
    if(req.path.endsWith('/check'))return json(res,{valid:true,issues:[]});
    expect(req.path).toBe('/api/invoices/7/fiscal-document');return json(res,{...initial,state:'LOCAL_VALIDATED',archivedAt:'2026-10-07T12:00:00Z',documentHash:'b'.repeat(64),validation:'EN16931-CII-1.3.16',data:body.data});
  });open();await fill();
  expect(screen.getByRole('button',{name:'Archiver le document contrôlé'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Contrôler le document'}));
  await screen.findByText('Contrôles EN 16931 et règles françaises validés. Vous pouvez archiver le document.');
  await waitFor(()=>expect(screen.getByRole('button',{name:'Archiver le document contrôlé'})).toBeEnabled());
  expect(http.requests.filter(r=>r.method==='POST' && !r.path.endsWith('/check'))).toHaveLength(0);
  fireEvent.click(screen.getByRole('button',{name:'Archiver le document contrôlé'}));
  expect(await screen.findByText('XML archivé · contrôles locaux validés')).toBeVisible();
  expect(screen.getByRole('button',{name:'Télécharger le XML'})).toBeEnabled();expect(screen.queryByText('Transmission confirmée')).not.toBeInTheDocument();
});
it('une modification du formulaire annule le contrôle précédent',async()=>{
  http.route((req,res)=>json(res,req.method==='GET'?initial:{valid:true,issues:[]}));open();await fill();
  fireEvent.click(screen.getByRole('button',{name:'Contrôler le document'}));await screen.findByText('Contrôles EN 16931 et règles françaises validés. Vous pouvez archiver le document.');
  fireEvent.change(screen.getAllByLabelText('Ville')[0],{target:{value:'Lyon'}});
  expect(screen.getByRole('button',{name:'Archiver le document contrôlé'})).toBeDisabled();
});
it('bloque une facture historique incomplète sans inventer de TVA',async()=>{
  http.route((req,res)=>json(res,{...initial,issues:['Identifiant TVA absent sur la facture émise.']}));open();
  expect(await screen.findByText('Identifiant TVA absent sur la facture émise.')).toBeVisible();expect(screen.queryByLabelText('SIREN')).not.toBeInTheDocument();
});
it('affiche les règles échouées et interdit l’archivage',async()=>{
  http.route((req,res)=>json(res,req.method==='GET'?initial:{valid:false,issues:[{code:'BR-CO-16',message:'Montants incohérents'}]}));open();await fill();
  fireEvent.click(screen.getByRole('button',{name:'Contrôler le document'}));expect(await screen.findByText('BR-CO-16')).toBeVisible();
  expect(screen.getByRole('button',{name:'Archiver le document contrôlé'})).toBeDisabled();
});
it('ne transforme pas un échec HTTP en validation réussie',async()=>{
  http.route((req,res)=>req.method==='GET'?json(res,initial):json(res,{message:'Source modifiée'},409));open();await fill();
  fireEvent.click(screen.getByRole('button',{name:'Contrôler le document'}));expect(await screen.findByRole('alert')).toHaveTextContent('Préparation indisponible');
  expect(screen.getByRole('button',{name:'Archiver le document contrôlé'})).toBeDisabled();
});
it('bloque aussi une mention française manquante après un contrôle EN 16931',async()=>{
  http.route((req,res)=>json(res,req.method==='GET'?initial:{valid:false,issues:[],transmissionIssues:[{code:'BR-FR-05',message:'Mention de recouvrement manquante'}]}));open();await fill();
  fireEvent.click(screen.getByRole('button',{name:'Contrôler le document'}));
  expect(await screen.findByText('Transmission bloquée : mentions françaises à compléter')).toBeVisible();
  expect(screen.getByRole('button',{name:'Archiver le document contrôlé'})).toBeDisabled();
});
it('remonte la séparation des organisations et ne réutilise pas une archive en cache',async()=>{
  http.route((req,res)=>json(res,{...initial,state:'LOCAL_VALIDATED',archivedAt:'2026-10-07T12:00:00Z'}));const result=open();
  await screen.findByText('XML archivé · contrôles locaux validés');context.org=3;
  result.rerender(<QueryClientProvider client={result.client}><BaitlyInvoiceFiscalPanel invoice={invoice}/></QueryClientProvider>);
  expect(screen.queryByText('XML archivé · contrôles locaux validés')).not.toBeInTheDocument();
  http.route((req,res)=>json(res,{message:'Facture inaccessible'},403));fireEvent.click(screen.getByRole('button',{name:'Document fiscal électronique'}));
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Préparation indisponible'));
});
it('n’expose pas la préparation aux membres sans droits de gestion',()=>{
  context.orgRole='MEMBER';http.route(()=>{throw new Error('Aucun appel attendu');});
  render(<QueryClientProvider client={new QueryClient()}><BaitlyInvoiceFiscalPanel invoice={invoice}/></QueryClientProvider>);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();expect(http.requests).toHaveLength(0);
});

import {mockDirectoryCoverage} from '../marketplace/__tests__/baitlyCoverageFixture';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import BaitlyCrmMap from './BaitlyCrmMap';
import {professionalDirectoryApi as api,crmProfessionalImportsApi,type ReferencedProfessional} from '../../services/api/baitlyProfessionalDirectoryApi';
import {baitlyCrmLocationsApi} from '../../services/api/baitlyCrmLocationsApi';
import {baitlyCrmEnrichmentRunsApi} from '../../services/api/baitlyCrmEnrichmentRunsApi';
import {baitlyDirectoryGlyphs} from '../../config/baitlyDirectoryGlyphs';
import type {BaitlyCrmContact} from './baitlyCrmWorkspace';
vi.mock('../../hooks/useAuth',()=>({useAuth:()=>({user:{id:7,roles:['TECHNICIAN'],permissions:[]}})}));
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr',t:(_key:string,fallback?:string)=>fallback||_key})}));
vi.mock('../../hooks/useThemeMode',()=>({useThemeMode:()=>({isDark:false})}));
vi.mock('../../components/BaitlyMapCanvas',()=>({BaitlyMapCanvas:({properties,mapTools,onMarkerClick,selectedPropertyId,renderPopup,onBoundsChange,focusBounds,highlightedPropertyIds}:any)=><div><div data-testid="map" data-highlighted={JSON.stringify(highlightedPropertyIds)} data-focus={JSON.stringify(focusBounds)}>{properties.map((row:any)=><button key={row.id} data-glyph={row.glyph?.body} onClick={()=>onMarkerClick(row)}>{row.name} {row.id}</button>)}{properties.filter((row:any)=>row.id===selectedPropertyId).map((row:any)=><section key={row.id} data-testid="popup">{renderPopup(row)}</section>)}</div>{mapTools}<button onClick={()=>onBoundsChange({west:1,south:45,east:4,north:48})}>Déplacer la carte</button><button onClick={()=>onBoundsChange({west:-10,south:35,east:20,north:55})}>Dézoomer la carte</button></div>}));
vi.mock('../../components/baitly/MapWithSheet',()=>({default:({map,children}:any)=><div>{map}<div data-map-list-scroll>{children}</div></div>}));
const row:ReferencedProfessional={id:1,siret:'12345678900011',name:'Atlas national',address:'1 rue du Port Nantes',city:'Nantes',postal_code:'44000',activity:'81.21Z',latitude:47.2,longitude:-1.5,location_source:'SIRENE',sirene_retrieved_at:'2026-10-20',osm_confirmed_at:null,osm_key:null,osm_name:null,phone:'0102030405',email:null,website:null};
beforeEach(()=>{
 mockDirectoryCoverage();
 vi.spyOn(api,'synchronization').mockResolvedValue({enabled:true,phase:'COMPLETED'});vi.spyOn(api,'map').mockResolvedValue({items:[row],nextCursor:null});vi.spyOn(baitlyCrmLocationsApi,'list').mockResolvedValue([]);vi.spyOn(baitlyCrmEnrichmentRunsApi,'latest').mockResolvedValue({run:null});window.matchMedia=vi.fn().mockReturnValue({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()});});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('shows all-region coverage even when the detail list only has the first loaded company',async()=>{
 vi.mocked(api.clusters).mockResolvedValue({total:50001,clusters:[{key:'8:2',count:50000,latitude:45,longitude:5,west:4,south:44,east:6,north:46,representativeId:9999}]});
 const view=setup();await screen.findByRole('button',{name:/50000 Professionnels/});
 const panel=view.container.querySelector<HTMLElement>('[data-map-list-scroll]')!;
 expect(within(panel).getByRole('button',{name:'Atlas national'})).toBeInTheDocument();
 expect(within(panel).queryByText(/50000 Professionnels/)).not.toBeInTheDocument();
 expect(api.map).toHaveBeenCalledTimes(1);
});
it('shows a non-blocking loading indicator and list placeholders until the initial map response arrives',async()=>{
 let complete!:(value:{items:ReferencedProfessional[];nextCursor:null})=>void;
 vi.mocked(api.map).mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
 const {container}=setup();
 const status=await screen.findByRole('status',{name:'Recherche des professionnels…'});
 expect(status).toHaveAttribute('data-overlay','true');expect(screen.getByTestId('map')).toBeInTheDocument();
 expect(container.querySelector('.baitly-map-list-skeleton')).toHaveAttribute('aria-hidden','true');
 expect(screen.queryByRole('button',{name:'Charger la suite'})).not.toBeInTheDocument();
 await waitFor(()=>expect(complete).toBeTypeOf('function'));
 await act(async()=>complete({items:[row],nextCursor:null}));await screen.findByRole('button',{name:'Atlas national -1'});
 expect(status).not.toBeInTheDocument();expect(container.querySelector('.baitly-map-list-skeleton')).not.toBeInTheDocument();
});
it('keeps loaded map pins visible and replaces load-more text with an accessible spinner while fetching the next page',async()=>{
 let complete!:(value:{items:ReferencedProfessional[];nextCursor:null})=>void;
 vi.mocked(api.map).mockImplementation(async input=>input.after?new Promise(resolve=>{complete=resolve;}):{items:[row],nextCursor:1});
 setup();fireEvent.click(await screen.findByRole('button',{name:'Charger la suite'}));
 await screen.findByRole('status',{name:'Chargement des professionnels…'});
 expect(screen.getByRole('button',{name:'Atlas national -1'})).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Charger la suite'})).not.toBeInTheDocument();
 await act(async()=>complete({items:[{...row,id:2,name:'Second national'}],nextCursor:null}));
 await screen.findByRole('button',{name:'Second national'});expect(screen.queryByRole('status',{name:'Chargement des professionnels…'})).not.toBeInTheDocument();
});
it('filters contact availability in the request, map and list; a website alone is not a contact',async()=>{
 const email={...row,id:2,name:'Avec courriel',phone:null,email:'contact@example.com'},website={...row,id:3,name:'Site seulement',phone:null,website:'https://example.com'};
 vi.mocked(api.map).mockResolvedValue({items:[row,email,website],nextCursor:null});setup();
 await screen.findByRole('button',{name:'Site seulement -3'});fireEvent.click(screen.getByRole('button',{name:'Filtres de la carte'}));
 fireEvent.change(screen.getByRole('combobox',{name:'Coordonnées disponibles'}),{target:{value:'ANY'}});
 await waitFor(()=>expect(api.map).toHaveBeenLastCalledWith(expect.objectContaining({contacts:'ANY',after:0}),expect.any(AbortSignal)));
 expect(screen.queryByRole('button',{name:'Site seulement -3'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Site seulement'})).not.toBeInTheDocument();
 fireEvent.change(screen.getByRole('combobox',{name:'Coordonnées disponibles'}),{target:{value:'EMAIL'}});
 await screen.findByRole('button',{name:'Avec courriel -2'});expect(screen.queryByRole('button',{name:'Atlas national -1'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Réinitialiser les filtres'}));await screen.findByRole('button',{name:'Site seulement -3'});
 expect(screen.getByRole('combobox',{name:'Coordonnées disponibles'})).toHaveValue('');
});
function setup(contacts:BaitlyCrmContact[]=[],org?:number,canManage=false){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><BaitlyCrmMap contacts={contacts} org={org} nationalDirectory canManage={canManage}/></QueryClientProvider>);}
it('keeps the selected company and revealed list rows while zooming out and appending missing areas',async()=>{
 const rows=Array.from({length:45},(_,index)=>({...row,id:index+1,name:`Entreprise ${index+1}`}));
 const complete:Array<(value:{items:ReferencedProfessional[];nextCursor:null})=>void>=[];
 vi.mocked(api.map).mockImplementation(async input=>input.bounds.west===-5.5&&input.bounds.east===10&&input.bounds.south===41&&input.bounds.north===51.5?{items:rows,nextCursor:null}:new Promise(resolve=>complete.push(resolve)));
 const view=setup();fireEvent.click(await screen.findByRole('button',{name:'Entreprise 45 -45'}));
 const panel=view.container.querySelector<HTMLElement>('[data-map-list-scroll]')!;
 fireEvent.click(screen.getByRole('button',{name:'Dézoomer la carte'}));
 await waitFor(()=>expect(complete).toHaveLength(1));
 expect(within(panel).getByRole('button',{name:'Entreprise 45'})).toHaveAttribute('aria-pressed','true');
 expect(screen.getByTestId('popup')).toHaveTextContent('Entreprise 45');
 expect(view.container.querySelector('.baitly-map-list-skeleton')).toBeNull();
 await act(async()=>complete[0]({items:[{...row,id:100,name:'Nouvelle zone'}],nextCursor:null}));

 await screen.findByRole('button',{name:'Nouvelle zone -100'});
 expect(within(panel).getByRole('button',{name:'Entreprise 45'})).toHaveAttribute('aria-pressed','true');
 expect(screen.getAllByRole('button',{name:'Nouvelle zone -100'})).toHaveLength(1);
});
it('reveals and selects the list card when its marker is clicked beyond the first twenty rows',async()=>{
 const rows=Array.from({length:45},(_,index)=>({...row,id:index+1,name:`Entreprise ${index+1}`}));
 vi.mocked(api.map).mockResolvedValue({items:rows,nextCursor:null});
 const view=setup();await screen.findByRole('button',{name:'Entreprise 45 -45'});
 const panel=view.container.querySelector<HTMLElement>('[data-map-list-scroll]')!;
 expect(within(panel).queryByRole('button',{name:'Entreprise 45'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Entreprise 45 -45'}));
 const selected=within(panel).getByRole('button',{name:'Entreprise 45'});
 expect(selected).toHaveAttribute('aria-pressed','true');
 expect(selected.closest('article')).toHaveAttribute('data-selected','true');
});
it('shows public professionals without CRM access or imports and opens a read-only source card',async()=>{
 const imported=vi.spyOn(crmProfessionalImportsApi,'importReference');setup();
 fireEvent.click(await screen.findByRole('button',{name:'Atlas national -1'}));
 const popup=screen.getByTestId('popup');expect(within(popup).getByText('12345678900011')).toBeInTheDocument();expect(within(popup).getByText('0102030405')).toBeInTheDocument();
 expect(within(popup).queryByText('Adresse localisée par Sirene')).not.toBeInTheDocument();expect(baitlyCrmLocationsApi.list).not.toHaveBeenCalled();expect(baitlyCrmEnrichmentRunsApi.latest).not.toHaveBeenCalled();expect(imported).not.toHaveBeenCalled();
 expect(screen.queryByRole('checkbox',{name:/Sélectionner ce prestataire/})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:/Importer dans mon CRM/})).not.toBeInTheDocument();
});
it('imports multiple selected references in one request and clears only the successful selection',async()=>{
 vi.mocked(api.map).mockResolvedValue({items:[row,{...row,id:2,name:'Second national'}],nextCursor:null});
 const imported=vi.spyOn(crmProfessionalImportsApi,'importReferences').mockResolvedValue([{siret:row.siret,name:row.name,status:'CREATED',id:40},{siret:'22345678900022',name:'Second national',status:'EXISTING',id:41}]);
 setup([],10,true);const list=await screen.findByRole('region',{name:'Annuaire national partagé'});
 fireEvent.click(await within(list).findByRole('checkbox',{name:'Sélectionner ce prestataire : Atlas national'}));fireEvent.click(within(list).getByRole('checkbox',{name:'Sélectionner ce prestataire : Second national'}));
 expect(imported).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Importer dans mon CRM (2)'}));
 await screen.findByText('1 importés · 1 déjà présents · 0 à vérifier');expect(imported).toHaveBeenCalledExactlyOnceWith([1,2]);
 expect(within(list).getByRole('checkbox',{name:'Sélectionner ce prestataire : Atlas national'})).not.toBeChecked();
});
it('keeps selected professionals when city filters change',async()=>{
 vi.mocked(api.map).mockImplementation(async input=>({items:[input.city==='Lyon'?{...row,id:2,name:'Lyon national',city:'Lyon'}:row],nextCursor:null}));
 const imported=vi.spyOn(crmProfessionalImportsApi,'importReferences').mockResolvedValue([]);setup([],10,true);
 fireEvent.click(await screen.findByRole('checkbox',{name:'Sélectionner ce prestataire : Atlas national'}));fireEvent.click(screen.getByRole('button',{name:'Filtres de la carte'}));
 fireEvent.change(screen.getByRole('textbox',{name:'Ville'}),{target:{value:'Lyon'}});fireEvent.click(await screen.findByRole('checkbox',{name:'Sélectionner ce prestataire : Lyon national'}));
 fireEvent.click(screen.getByRole('button',{name:'Filtres de la carte'}));fireEvent.click(screen.getByRole('button',{name:'Importer dans mon CRM (2)'}));await waitFor(()=>expect(imported).toHaveBeenCalledExactlyOnceWith([1,2]));
});
it('selects directly from map pins and highlights each selected source without selecting private contacts',async()=>{
 vi.mocked(api.map).mockResolvedValue({items:[row,{...row,id:2,name:'Second national'}],nextCursor:null});
 vi.mocked(baitlyCrmLocationsApi.list).mockResolvedValue([{prospect_id:7,label:'Paris',latitude:48.8,longitude:2.3,precision:'ADDRESS'}]);setup([{id:7,name:'Propriétaire privé',contactType:'OWNER'} as BaitlyCrmContact],10,true);
 await screen.findByRole('button',{name:'Atlas national -1'});fireEvent.click(screen.getByRole('button',{name:'Sélection multiple sur la carte'}));fireEvent.click(screen.getByRole('button',{name:'Atlas national -1'}));fireEvent.click(screen.getByRole('button',{name:'Second national -2'}));
 fireEvent.click(screen.getByRole('button',{name:/Propriétaire privé 7/}));
 expect(screen.getByTestId('map')).toHaveAttribute('data-highlighted','[-1,-2]');expect(screen.getByRole('button',{name:'Importer dans mon CRM (2)'})).toBeEnabled();
});
it('retains selection after an import error and permits a safe retry',async()=>{
 const imported=vi.spyOn(crmProfessionalImportsApi,'importReferences').mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce([{siret:row.siret,name:row.name,status:'EXISTING',id:40}]);setup([],10,true);
 fireEvent.click(await screen.findByRole('checkbox',{name:'Sélectionner ce prestataire : Atlas national'}));fireEvent.click(screen.getByRole('button',{name:'Importer dans mon CRM (1)'}));
 await screen.findByRole('alert');expect(screen.getByRole('checkbox',{name:'Sélectionner ce prestataire : Atlas national'})).toBeChecked();
 fireEvent.click(screen.getByRole('button',{name:'Importer dans mon CRM (1)'}));await screen.findByText('0 importés · 1 déjà présents · 0 à vérifier');expect(imported).toHaveBeenCalledTimes(2);
});
it('limits loaded-result selection to one hundred references',async()=>{
 vi.mocked(api.map).mockResolvedValue({items:Array.from({length:110},(_,index)=>({...row,id:index+1,name:`National ${index+1}`})),nextCursor:null});
 const imported=vi.spyOn(crmProfessionalImportsApi,'importReferences').mockResolvedValue([]);setup([],10,true);
 fireEvent.click(await screen.findByRole('checkbox',{name:'Résultats chargés (100 max)'}));fireEvent.click(screen.getByRole('button',{name:'Importer dans mon CRM (100)'}));
 await waitFor(()=>expect(imported).toHaveBeenCalledTimes(1));expect(imported.mock.calls[0][0]).toHaveLength(100);expect(new Set(imported.mock.calls[0][0]).size).toBe(100);
});
it('keeps public IDs distinct from private contacts with the same numeric ID',async()=>{
 vi.mocked(baitlyCrmLocationsApi.list).mockResolvedValue([{prospect_id:1,label:'Paris',latitude:48.8,longitude:2.3,precision:'ADDRESS'}]);
 setup([{id:1,name:'Contact privé',contactType:'OWNER'} as BaitlyCrmContact],10);
 const map=await screen.findByTestId('map');await within(map).findByRole('button',{name:'Atlas national -1'});
 expect(within(map).getByRole('button',{name:/Contact privé 1/})).toBeInTheDocument();
 fireEvent.click(within(map).getByRole('button',{name:'Atlas national -1'}));expect(within(screen.getByTestId('popup')).queryByText('Contact privé')).not.toBeInTheDocument();
});
it('searches a city across France, applies the service filter and focuses its results',async()=>{
 setup();await screen.findByRole('button',{name:'Atlas national -1'});fireEvent.click(screen.getByRole('button',{name:'Filtres de la carte'}));
 fireEvent.change(screen.getByRole('textbox',{name:'Ville'}),{target:{value:'Nantes'}});fireEvent.click(screen.getByRole('button',{name:'Type de service'}));fireEvent.click(screen.getByRole('checkbox',{name:'Ménage et nettoyage'}));
 await waitFor(()=>expect(api.map).toHaveBeenLastCalledWith(expect.objectContaining({city:'Nantes',service:'CLEANING',bounds:{west:-180,south:-90,east:180,north:90}}),expect.any(AbortSignal)));
 await waitFor(()=>expect(screen.getByTestId('map')).toHaveAttribute('data-focus','[-1.5,47.2,-1.5,47.2]'));
});
it('appends server pages and reuses a fully loaded area when moving inside it',async()=>{
 vi.mocked(api.map).mockImplementation(async input=>input.after?{items:[{...row,id:2,name:'Second national'}],nextCursor:null}:{items:[row],nextCursor:1});
 setup();fireEvent.click(await screen.findByRole('button',{name:'Charger la suite'}));await screen.findByRole('button',{name:'Second national'});
 expect(screen.getByRole('button',{name:'Atlas national -1'})).toBeInTheDocument();const calls=vi.mocked(api.map).mock.calls.length;fireEvent.click(screen.getByRole('button',{name:'Déplacer la carte'}));
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,400));});expect(api.map).toHaveBeenCalledTimes(calls);
 expect(screen.getByRole('button',{name:'Second national'})).toBeInTheDocument();
});

it('uses the laundry symbol and excludes maintenance from both the map and list when filtering laundry',async()=>{
 const laundry={...row,id:2,name:'Blanchisserie',activity:'96.01B'},maintenance={...row,id:3,name:'Maintenance',activity:'43.21A'};
 // Deliberately include an unrelated server result to exercise the display guard.
 vi.mocked(api.map).mockResolvedValue({items:[row,laundry,maintenance],nextCursor:null});setup();
 const map=await screen.findByTestId('map');await within(map).findByRole('button',{name:'Maintenance -3'});
 fireEvent.click(screen.getByRole('button',{name:'Filtres de la carte'}));fireEvent.click(screen.getByRole('button',{name:'Type de service'}));fireEvent.click(screen.getByRole('checkbox',{name:'Blanchisserie'}));
 const pin=await within(map).findByRole('button',{name:'Blanchisserie -2'});expect(pin).toHaveAttribute('data-glyph',baitlyDirectoryGlyphs.LAUNDRY.body);
 expect(within(map).queryByRole('button',{name:'Maintenance -3'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Maintenance'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('checkbox',{name:'Ménage et nettoyage'}));
 await within(map).findByRole('button',{name:'Atlas national -1'});
 expect(within(map).getByRole('button',{name:'Blanchisserie -2'})).toBeInTheDocument();
 expect(within(map).queryByRole('button',{name:'Maintenance -3'})).not.toBeInTheDocument();
 await waitFor(()=>expect(api.map).toHaveBeenLastCalledWith(expect.objectContaining({service:'CLEANING,LAUNDRY'}),expect.any(AbortSignal)));
});

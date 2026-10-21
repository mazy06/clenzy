import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import BaitlyProfessionalMapCard from './BaitlyProfessionalMapCard';
import type {ReferencedProfessional} from '../../services/api/baitlyProfessionalDirectoryApi';
import {baitlyDirectoryActivity} from '../../config/baitlyDirectoryActivities';
const row:ReferencedProfessional={id:1,siret:'12345678900011',name:'Entreprise',address:'1 rue du Port',city:'Nantes',postal_code:'44000',activity:'81.21Z',latitude:null,longitude:null,phone:null,email:null,website:null,sirene_retrieved_at:'2026-10-20',osm_key:null,osm_name:null,osm_confirmed_at:null};
afterEach(cleanup);
it('shows the actual foreign identifier and mapped service without labelling it as a SIRET',()=>{
 const view=render(<BaitlyProfessionalMapCard row={{...row,siret:null,country_code:'MA',identifier_type:'ICE',identifier:'001234567890123',activity:'',service:'LAUNDRY',city:'Rabat'}} language="fr"/>);
 expect(screen.getByText('ICE')).toBeInTheDocument();expect(screen.getByText('001234567890123')).toBeInTheDocument();
 expect(screen.queryByText('SIRET')).not.toBeInTheDocument();expect(view.container.querySelector('[data-service="LAUNDRY"]')).toBeInTheDocument();
});
it('separates street and locality without duplicating the imported postal code or city',()=>{
 const locate=vi.fn();
 const view=render(<BaitlyProfessionalMapCard row={{...row,address:'1 rue du Port 44000 NANTES'}} language="fr" onLocate={locate} selected/>);
 expect(screen.getByText('1 rue du Port')).toHaveClass('baitly-directory-card__street');
 expect(screen.getByText('44000').parentElement).toHaveTextContent('44000Nantes');
 expect(screen.getAllByText('44000')).toHaveLength(1);
 const button=screen.getByRole('button',{name:row.name});expect(button).toHaveAttribute('aria-pressed','true');
 fireEvent.click(button);expect(locate).toHaveBeenCalledTimes(1);
 expect(view.container.querySelector('article')).toHaveAttribute('data-selected','true');
});
it('shows only the locality when the street is unavailable',()=>{
 const view=render(<BaitlyProfessionalMapCard row={{...row,address:'44000 Nantes'}} language="fr"/>);
 expect(view.container.querySelector('.baitly-directory-card__street')).toBeNull();
 expect(screen.getByText('Nantes')).toBeInTheDocument();
});
it('shows business details and SIRET without source commentary',()=>{
 render(<BaitlyProfessionalMapCard row={{...row,phone:'0102030405',email:'contact@example.com',website:'https://example.com',rge_retrieved_at:'2026-10-20T03:00:00Z'}} language="fr"/>);
 expect(screen.getByRole('link',{name:/Email/})).toHaveAttribute('href','mailto:contact%40example.com');
 expect(screen.getByText(row.siret)).toBeInTheDocument();
 expect(screen.getByText(row.address)).toBeInTheDocument();
 expect(screen.queryByText('Sources')).not.toBeInTheDocument();
 expect(screen.queryByText('Coordonnées de contact non renseignées par les sources.')).not.toBeInTheDocument();
 expect(screen.queryByText(/Source consultée|Licence Ouverte|Position confirmée|Fiche référencée/)).not.toBeInTheDocument();
});
it('does not invent contact details, coordinates or photos when the source has none',()=>{
 render(<BaitlyProfessionalMapCard row={row} language="fr"/>);
 expect(screen.queryByText('À localiser')).not.toBeInTheDocument();expect(screen.queryByText('Adresse localisée par Sirene')).not.toBeInTheDocument();
 expect(screen.queryByText('Coordonnées de contact non renseignées par les sources.')).not.toBeInTheDocument();expect(screen.queryByRole('img')).not.toBeInTheDocument();
 expect(screen.queryByRole('link',{name:/Téléphone|Email|Site web/})).not.toBeInTheDocument();
});
it('does not expose active content from malformed source URLs or email addresses',()=>{
 render(<BaitlyProfessionalMapCard row={{...row,website:'javascript:alert(1)',email:'test\r\n@example.com',osm_key:'javascript:alert(1)'}} language="fr"/>);
 expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it.each([['81.21Z','CLEANING'],['43.22A','MAINTENANCE'],['96.01B','LAUNDRY'],['81.30Z','EXTERIOR'],['68.32A','CONCIERGE'],['95.22Z','REPAIRS'],['80.20Z','SECURITY'],['81.29A','PEST_CONTROL'],['56.21Z','CATERING'],['49.42Z','MOVING'],['71.20B','PROPERTY_EXPERTS']])('identifies the registered activity %s without inferring unrelated services',(code,service)=>{
 expect(baitlyDirectoryActivity(code)).toBe(service);expect(baitlyDirectoryActivity('00.00X')).toBeUndefined();
});

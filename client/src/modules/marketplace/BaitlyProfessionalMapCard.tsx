import type {ReferencedProfessional} from '../../services/api/baitlyProfessionalDirectoryApi';
import {professionalDirectoryMessages} from '../../i18n/baitlyProfessionalDirectoryMessages';
import {MapPin,Phone,Mail,Globe} from '../../icons/glyphs';
import BaitlyDirectoryService from './BaitlyDirectoryService';
import './baitly-national-directory.css';

function websiteLink(value:string|null){
 try{const url=new URL(value??'');return url.protocol==='https:'&&!url.username&&!url.password?url.href:undefined;}catch{return undefined;}
}
/** Compact business details shared by the directory list and map popup. */
export default function BaitlyProfessionalMapCard({row,language,onLocate,selected=false,selection}:{row:ReferencedProfessional;language:string;onLocate?:()=>void;selected?:boolean;selection?:{checked:boolean;disabled:boolean;onChange:()=>void}}){
 const m=professionalDirectoryMessages(language),website=websiteLink(row.website);
 const phone=row.phone?.replace(/[^+0-9]/g,''),email=row.email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)?row.email:undefined;
 const postalCode=row.postal_code?.trim(),city=row.city?.trim();
 const locality=[postalCode,city].filter(Boolean).join(' ');
 const address=(row.address??'').replace(/\s+/g,' ').trim();
 // Sirene peut déjà inclure le code postal et la ville dans l’adresse complète.
 const street=locality&&address.toLocaleLowerCase().endsWith(locality.toLocaleLowerCase())
  ?address.slice(0,-locality.length).replace(/[\s,;]+$/,''):address;
 return <article className="baitly-professional-map-card" data-selected={selected} data-selectable={!!selection}>
  {selection&&<label className="baitly-directory-card__selection"><input type="checkbox" className="size-4 cursor-pointer accent-primary" checked={selection.checked} disabled={selection.disabled} onChange={selection.onChange} aria-label={`${m.selectProfessional} : ${row.name}`}/></label>}
  {onLocate?<button type="button" aria-pressed={selected} onClick={onLocate} className="baitly-directory-card__name"><span>{row.name}</span><MapPin size={15} aria-hidden/></button>:<h3 className="baitly-directory-card__name">{row.name}</h3>}
  <BaitlyDirectoryService activity={row.activity} language={language}/>
  <address className="baitly-directory-card__address">{street&&<span className="baitly-directory-card__street">{street}</span>}{locality&&<span className="baitly-directory-card__locality">{postalCode&&<span className="tabular-nums">{postalCode}</span>}{city&&<span>{city}</span>}</span>}</address>
  <div className="baitly-directory-card__contacts">{phone&&<a href={`tel:${phone}`} aria-label={`${m.phone} : ${row.phone}`}><Phone size={14} aria-hidden/><span dir="ltr">{row.phone}</span></a>}{email&&<a href={`mailto:${encodeURIComponent(email)}`} aria-label={`${m.email} : ${email}`}><Mail size={14} aria-hidden/><span dir="ltr">{email}</span></a>}{website&&<a href={website} target="_blank" rel="noopener noreferrer"><Globe size={14} aria-hidden/>{m.website}</a>}</div>
  <p className="baitly-directory-card__siret"><span>SIRET</span> <span className="tabular-nums" dir="ltr">{row.siret}</span></p>
 </article>;
}

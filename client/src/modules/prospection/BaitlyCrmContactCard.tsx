import { Home,KeyRound,Wrench,MapPin,ChevronRight } from '../../icons/glyphs';
import { useTranslation } from '../../hooks/useTranslation';
import { prospectionMessages } from '../../i18n/baitlyProspectionMessages';
import type { ProspectDto } from '../../services/api/prospectsApi';
import { contactKind } from './baitlyCrmWorkspace';
export const BaitlyCrmKindIcon=({contact}:{contact:ProspectDto})=>{
  const Icon=contactKind(contact)==='owner'?Home:contactKind(contact)==='concierge'?KeyRound:Wrench;
  return <Icon size={17} aria-hidden />;
};
export default function BaitlyCrmContactCard({contact,selected,onOpen,compact=false,locationLabel,showOrigin=true}:{contact:ProspectDto;selected:boolean;onOpen:()=>void;compact?:boolean;locationLabel?:string;showOrigin?:boolean}){
  const {currentLanguage}=useTranslation();const m=prospectionMessages(currentLanguage);
  return <button type="button" className={`bcrm-contact ${compact?'bcrm-contact--compact':''}`} data-kind={contactKind(contact)} aria-pressed={selected} onClick={onOpen}>
    <span className="bcrm-contact__heading"><span className="bcrm-contact__avatar" data-kind={contactKind(contact)}><BaitlyCrmKindIcon contact={contact} /></span><strong>{contact.name}</strong><ChevronRight className="bcrm-contact__arrow" size={15} aria-hidden /></span>
    <span className="bcrm-contact__type">{m[`${contactKind(contact)}Label`]}{contact.specialty?` · ${contact.specialty}`:''}</span>
    <span className="bcrm-contact__city"><MapPin size={13} aria-hidden />{locationLabel||contact.city||m.cityMissing}</span>
    {compact&&(contact.email||contact.phone)&&<span className="bcrm-contact__coordinates">{contact.email||contact.phone}</span>}
    {!compact&&<><span className="bcrm-contact__coordinates">{contact.email||contact.phone||m.noContact}</span>
      {showOrigin&&<span className="bcrm-contact__origin" data-review={contact.sourceType==='LEGACY'}>{contact.sourceType==='LEGACY'?m.originMissing:m.originKnown}</span>}</>}
  </button>;
}

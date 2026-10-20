import {MapPin,Mail,Phone,ArrowUpRight} from '../../icons/glyphs';
import {useTranslation} from '../../hooks/useTranslation';
import {prospectionMessages} from '../../i18n/baitlyProspectionMessages';
import {BaitlyCrmKindIcon} from './BaitlyCrmContactCard';
import {contactKind,type BaitlyCrmContact} from './baitlyCrmWorkspace';
import type {BaitlyCrmLocation} from '../../services/api/baitlyCrmLocationsApi';

export default function BaitlyCrmMapContact({contact,location,onOpen}:{contact:BaitlyCrmContact;location?:BaitlyCrmLocation;onOpen?:()=>void}){
  const {t,currentLanguage}=useTranslation();const m=prospectionMessages(currentLanguage);const kind=contactKind(contact);
  return <article className="bcrm-map-contact" data-kind={kind} aria-label={`${t('baitlyCrm.contactRecord')} : ${contact.name}`}>
    <header><span className="bcrm-contact__avatar" data-kind={kind}><BaitlyCrmKindIcon contact={contact}/></span><div><h3>{contact.name}</h3><span className="bcrm-map-contact-kind">{m[`${kind}Label`]}</span></div></header>
    <div className="bcrm-map-contact-tags"><span className="bcrm-workflow-tag" data-status={contact.status}>{t('baitlyCrm.values.'+contact.status)}</span>{contact.crm?.qualification==='QUALIFIED'&&<span className="bcrm-workflow-tag" data-status="PUBLISHED">{m.QUALIFIED}</span>}</div>
    {(contact.crm?.company_name||contact.specialty)&&<p className="bcrm-map-contact-business">{[contact.crm?.company_name,contact.specialty].filter(Boolean).join(' · ')}</p>}
    <dl><div><dt><MapPin size={14} aria-hidden/><span className="sr-only">{m.location}</span></dt><dd>{location?.label||contact.city||m.cityMissing}{location&&<small>{location.precision==='CITY'?m.cityPrecision:m.addressPrecision}</small>}{!location&&<small>{m.locationNone}</small>}</dd></div>
      {contact.email&&<div><dt><Mail size={14} aria-hidden/><span className="sr-only">{t('baitlyCrm.email')}</span></dt><dd>{contact.email}</dd></div>}
      {contact.phone&&<div><dt><Phone size={14} aria-hidden/><span className="sr-only">{t('baitlyCrm.phone')}</span></dt><dd>{contact.phone}</dd></div>}
      {contact.crm?.assigned_user_name&&<div className="bcrm-map-contact-assignee"><dt>{m.assignee}</dt><dd>{contact.crm.assigned_user_name}</dd></div>}
    </dl>
    {onOpen&&<button type="button" className="bcrm-map-contact-open" onClick={onOpen}>{m.open}<ArrowUpRight size={15} aria-hidden/></button>}
  </article>;
}

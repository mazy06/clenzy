import type { ProspectDto } from '../../services/api/prospectsApi';
import type { BaitlyCrmDetails } from '../../services/api/baitlyCrmDetailsApi';
export type BaitlyCrmContact=ProspectDto&{crm?:BaitlyCrmDetails};
export type BaitlyCrmKind='all'|'owner'|'concierge'|'provider';
export function contactKind(contact:ProspectDto):Exclude<BaitlyCrmKind,'all'>{
  return contact.contactType==='OWNER'?'owner':contact.category==='CONCIERGERIES'?'concierge':'provider';
}
export function filterCrmContacts(contacts:BaitlyCrmContact[],search:string,kind:BaitlyCrmKind,status:string){
  const query=search.trim().toLocaleLowerCase();
  return contacts.filter(contact=>!contact.archived&&(kind==='all'||contactKind(contact)===kind)&&(status==='all'||contact.status===status)&&
    (!query||[contact.name,contact.city,contact.email,contact.phone,contact.specialty,contact.crm?.company_name,contact.crm?.job_title,contact.crm?.region,contact.crm?.assigned_user_name].some(value=>value?.toLocaleLowerCase().includes(query))));
}

import {directoryContactFilters,type DirectoryContactFilter} from '../../config/baitlyDirectoryContacts';
import {professionalDirectoryMessages} from '../../i18n/baitlyProfessionalDirectoryMessages';

export default function BaitlyDirectoryContactFilter({value,onChange,language}:{value:DirectoryContactFilter;onChange:(value:DirectoryContactFilter)=>void;language:string}){
 const m=professionalDirectoryMessages(language);
 const labels={ '':m.contactsAll,ANY:m.contactsAny,EMAIL:m.contactsEmail,PHONE:m.contactsPhone,BOTH:m.contactsBoth,NONE:m.contactsNone };
 return <label className="bcrm-toolbar-filter"><span>{m.contactAvailability}</span><select aria-label={m.contactAvailability} value={value} onChange={event=>onChange(event.target.value as DirectoryContactFilter)}>{directoryContactFilters.map(key=><option key={key} value={key}>{labels[key]}</option>)}</select></label>;
}

import {baitlyDirectoryIcons,baitlyDirectoryFallbackIcon} from '../../config/baitlyDirectoryGlyphs';
import {baitlyDirectoryActivity} from '../../config/baitlyDirectoryActivities';
import {professionalDirectoryMessages} from '../../i18n/baitlyProfessionalDirectoryMessages';

/** The pictogram describes the source's main activity, not additional inferred services. */
export default function BaitlyDirectoryService({activity,language}:{activity:string;language:string}){
 const m=professionalDirectoryMessages(language),service=baitlyDirectoryActivity(activity),Icon=service?baitlyDirectoryIcons[service]:baitlyDirectoryFallbackIcon;
 return <span className="baitly-directory-service" data-service={service??'OTHER'} title={m.activityHint}><Icon size={15} aria-hidden/><span>{service?m[service]:m.activity}</span><small className="tabular-nums">{activity}</small></span>;
}

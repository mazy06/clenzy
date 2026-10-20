import {professionalDirectoryMessages} from '../../i18n/baitlyProfessionalDirectoryMessages';
export type DirectoryCountry='FR'|'MA'|'SA';
export default function BaitlyDirectoryCountry({value,onChange,language}:{value:DirectoryCountry;onChange:(value:DirectoryCountry)=>void;language:string}){
 const m=professionalDirectoryMessages(language);
 return <span className="inline-flex min-w-0 items-center gap-2"><span>{m.professionals} :</span><select className="min-w-0 cursor-pointer bg-transparent text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring" aria-label={m.country} value={value} onChange={event=>onChange(event.target.value as DirectoryCountry)}>{(['FR','MA','SA'] as const).map(code=><option key={code} value={code}>{m[code]}</option>)}</select></span>;
}

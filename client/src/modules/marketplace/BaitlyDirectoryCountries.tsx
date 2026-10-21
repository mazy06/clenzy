import {ChevronDown} from '../../icons';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuCheckboxItem} from '../../components/ui/dropdown-menu';
import {professionalDirectoryMessages} from '../../i18n/baitlyProfessionalDirectoryMessages';
import type {DirectoryCountry} from './BaitlyDirectoryCountry';

export const directoryCountries:DirectoryCountry[]=['FR','MA','SA'];
export const directoryCountryBounds={
 FR:{west:-5.5,south:41,east:10,north:51.5},
 MA:{west:-17.2,south:20.7,east:-.9,north:36.1},
 SA:{west:34.5,south:16,east:55.7,north:32.3},
};
export function directoryCountriesBounds(countries:DirectoryCountry[]){
 const bounds=countries.map(code=>directoryCountryBounds[code]);
 return {west:Math.min(...bounds.map(b=>b.west)),south:Math.min(...bounds.map(b=>b.south)),east:Math.max(...bounds.map(b=>b.east)),north:Math.max(...bounds.map(b=>b.north))};
}

export default function BaitlyDirectoryCountries({value,onChange,language,disabled=false,inline=false}:{value:DirectoryCountry[];onChange:(value:DirectoryCountry[])=>void;language:string;disabled?:boolean;inline?:boolean}){
 const m=professionalDirectoryMessages(language),label=value.map(code=>m[code]).join(', ');
 const toggle=(code:DirectoryCountry,checked:boolean)=>onChange(directoryCountries.filter(item=>item===code?checked:value.includes(item)));
 if(inline)return <fieldset className="min-w-0 space-y-2"><legend className="text-sm font-medium">{m.country}</legend>{directoryCountries.map(code=><label key={code} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="size-4 cursor-pointer" style={{accentColor:'var(--bui-primary)'}} checked={value.includes(code)} disabled={disabled||value.length===1&&value.includes(code)} onChange={event=>toggle(code,event.target.checked)}/>{m[code]}</label>)}</fieldset>;
 return <span className="inline-flex min-w-0 items-center gap-2"><span className="shrink-0">{m.professionals} :</span>
  <DropdownMenu modal={false}><DropdownMenuTrigger asChild><button type="button" disabled={disabled} aria-label={`${m.country} : ${label}`} title={label} className="inline-flex min-w-0 cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"><span className="truncate">{label}</span><ChevronDown size={14} className="shrink-0" aria-hidden/></button></DropdownMenuTrigger>
   <DropdownMenuContent>{directoryCountries.map(code=><DropdownMenuCheckboxItem key={code} className="cursor-pointer" checked={value.includes(code)} disabled={disabled||value.length===1&&value.includes(code)} onSelect={event=>event.preventDefault()} onCheckedChange={checked=>toggle(code,checked===true)}>{m[code]}</DropdownMenuCheckboxItem>)}</DropdownMenuContent>
  </DropdownMenu>
 </span>;
}

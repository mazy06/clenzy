import type {MapBounds} from '../../components/BaitlyMapCanvas';
import type {DirectoryMapSort,ReferencedProfessional} from '../../services/api/baitlyProfessionalDirectoryApi';

export function inDirectoryViewport(row:ReferencedProfessional,bounds:MapBounds):boolean {
 const {latitude:lat,longitude:lon}=row;
 return lat!==null&&lon!==null&&lat>=bounds.south&&lat<=bounds.north&&(bounds.west<=bounds.east?lon>=bounds.west&&lon<=bounds.east:lon>=bounds.west||lon<=bounds.east);
}
/** Rank cached rows too, while server pagination guarantees the leading results across the whole area. */
export function rankDirectoryRows(rows:ReferencedProfessional[],bounds:MapBounds,sort:DirectoryMapSort):ReferencedProfessional[]{
 const radians=(value:number)=>value*Math.PI/180;
 const lat=(bounds.south+bounds.north)/2,lon=bounds.west+(bounds.east>=bounds.west?bounds.east-bounds.west:360-bounds.west+bounds.east)/2;
 const contactCount=(row:ReferencedProfessional)=>Number(!!row.email?.trim())+Number(!!row.phone?.trim());
 const distance=(row:ReferencedProfessional)=>Math.sin(radians(row.latitude!-lat)/2)**2+Math.cos(radians(lat))*Math.cos(radians(row.latitude!))*Math.sin(radians(row.longitude!-lon)/2)**2;
 const keys=new Map(rows.map(row=>[row.id,{visible:inDirectoryViewport(row,bounds),distance:distance(row),contacts:contactCount(row),name:row.name.toLowerCase()}]));
 return [...rows].sort((a,b)=>{
  const x=keys.get(a.id)!,y=keys.get(b.id)!;
  if(x.visible!==y.visible)return x.visible?-1:1;
  const name=x.name<y.name?-1:x.name>y.name?1:0;
  if(sort==='NAME')return name||a.id-b.id;
  if(sort==='CONTACTS')return y.contacts-x.contacts||x.distance-y.distance||name||a.id-b.id;
  return x.distance-y.distance||y.contacts-x.contacts||name||a.id-b.id;
 });
}

import type {MapBounds} from '../../components/BaitlyMapCanvas';
import type {ReferencedProfessional} from '../../services/api/baitlyProfessionalDirectoryApi';

export interface MapAreaRequest {bounds:MapBounds;after:number}
export interface MapAreaBatch extends MapAreaRequest {additionalBounds?:MapBounds[]}
export interface MapAreaProgress extends MapAreaRequest {nextCursor:number|null}
export interface MapDirectorySnapshot {rows:ReferencedProfessional[];areas:MapAreaProgress[];rankedCoverage?:MapBounds[]}
const key=(bounds:MapBounds)=>JSON.stringify([bounds.west,bounds.south,bounds.east,bounds.north]);
const contains=(outer:MapBounds,inner:MapBounds)=>outer.west<=inner.west&&outer.east>=inner.east&&outer.south<=inner.south&&outer.north>=inner.north;
function rectangles(bounds:MapBounds):MapBounds[]{
 return (bounds.west>bounds.east?[{...bounds,east:180},{...bounds,west:-180}]:[bounds]).filter(r=>r.west<r.east&&r.south<r.north);
}
/** Retire seulement les surfaces dont toutes les pages ont été récupérées. */
function subtract(area:MapBounds,covered:MapBounds):MapBounds[]{
 const west=Math.max(area.west,covered.west),east=Math.min(area.east,covered.east);
 const south=Math.max(area.south,covered.south),north=Math.min(area.north,covered.north);
 if(west>=east||south>=north)return [area];
 return [
  {...area,east:west},{...area,west:east},
  {west,east,south:area.south,north:south},{west,east,south:north,north:area.north},
 ].filter(r=>r.west<r.east&&r.south<r.north);
}
export function nextMapArea(viewport:MapBounds,areas:MapAreaProgress[]):MapAreaRequest|undefined{
 return mapAreaTasks(viewport,areas)[0];
}
function mapAreaTasks(viewport:MapBounds,areas:MapAreaProgress[]):MapAreaRequest[]{
 const views=rectangles(viewport);
 let missing=views;
 for(const area of areas)if(area.nextCursor===null)missing=missing.flatMap(piece=>subtract(piece,area.bounds));
 const tasks=missing.map(bounds=>{
  const pending=areas.find(area=>area.nextCursor!==null&&contains(area.bounds,bounds)&&views.some(view=>contains(view,area.bounds)));
  return pending?{bounds:pending.bounds,after:pending.nextCursor!}:{bounds,after:0};
 });
 // Découvrir d’abord les nouvelles bandes visibles, puis poursuivre leurs pages au scroll.
 const unique=[...new Map(tasks.map(task=>[`${key(task.bounds)}:${task.after}`,task])).values()];
 return [...unique.filter(task=>task.after===0),...unique.filter(task=>task.after!==0)];
}
/** Les nouvelles bandes du cadrage sont récupérées ensemble, sans publier de résultat partiel. */
export function nextMapAreaBatch(viewport:MapBounds,areas:MapAreaProgress[]):MapAreaBatch|undefined{
 const tasks=mapAreaTasks(viewport,areas),first=tasks[0];
 if(!first||first.after!==0)return first;
 const additionalBounds=tasks.filter(task=>task.after===0).slice(1).map(task=>task.bounds);
 return additionalBounds.length?{...first,additionalBounds}:first;
}
export async function loadMapAreaBatch<T>(request:MapAreaBatch,load:(area:MapAreaRequest)=>Promise<T>):Promise<Array<{request:MapAreaRequest;page:T}>>{
 const requests=[{bounds:request.bounds,after:request.after},...(request.additionalBounds??[]).map(bounds=>({bounds,after:0}))];
 const pages:Array<{request:MapAreaRequest;page:T}>=new Array(requests.length);
 let next=0,failed=false;
 await Promise.all(Array.from({length:Math.min(4,requests.length)},async()=>{
  while(!failed&&next<requests.length){
   const index=next++,area=requests[index];
   try{pages[index]={request:area,page:await load(area)};}catch(error){failed=true;throw error;}
  }
 }));
 return pages;
}
export function mergeMapArea(previous:MapDirectorySnapshot|undefined,request:MapAreaRequest,page:{items:ReferencedProfessional[];nextCursor:number|null}):MapDirectorySnapshot{
 return mergeMapAreas(previous,[{request,page}]);
}
export function mergeMapAreas(previous:MapDirectorySnapshot|undefined,pages:Array<{request:MapAreaRequest;page:{items:ReferencedProfessional[];nextCursor:number|null}}>):MapDirectorySnapshot{
 const rows=new Map((previous?.rows??[]).map(row=>[row.id,row]));
 const areas=new Map((previous?.areas??[]).map(area=>[key(area.bounds),area]));
 for(const {request,page} of pages){
  page.items.forEach(row=>rows.set(row.id,row));
  const existing=areas.get(key(request.bounds));
  if(!existing||request.after>=existing.after)areas.set(key(request.bounds),{...request,nextCursor:page.nextCursor});
 }
 return {...previous,rows:[...rows.values()],areas:[...areas.values()]};
}

import type {PropertyMarker} from '../../components/BaitlyMapCanvas';
import type {ReferencedProfessional,DirectoryMapCluster} from '../../services/api/baitlyProfessionalDirectoryApi';
import {baitlyDirectoryActivity} from '../../config/baitlyDirectoryActivities';
import {baitlyDirectoryGlyph} from '../../config/baitlyDirectoryGlyphs';

export function directoryCoverageMarkers(rows:ReferencedProfessional[],clusters:DirectoryMapCluster[]|undefined,selectedId:number|undefined,label:(count:number)=>string):PropertyMarker[]{
 const byId=new Map(rows.map(row=>[row.id,row])),shown=new Set<number>();
 const markers:PropertyMarker[]=[];
 const append=(row:ReferencedProfessional)=>{
  if(shown.has(row.id))return;shown.add(row.id);
  markers.push({id:-row.id,name:row.name,lat:row.latitude!,lng:row.longitude!,type:baitlyDirectoryActivity(row.activity)==='CONCIERGE'?'crm_concierge':'crm_provider',glyph:baitlyDirectoryGlyph(row.activity),subtitle:row.address});
 };
 for(const cluster of clusters??[]){
  const single=cluster.count===1?byId.get(cluster.representativeId):undefined;
  if(single){append(single);continue;}
  // Les petites listes à la même adresse gardent le sélecteur partagé des épingles.
  const coincident=cluster.count<=20&&cluster.west===cluster.east&&cluster.south===cluster.north
   ?rows.filter(row=>row.latitude===cluster.latitude&&row.longitude===cluster.longitude):[];
  if(coincident.length===cluster.count&&coincident.some(row=>row.id===cluster.representativeId)){coincident.forEach(append);continue;}
  const [x,y]=cluster.key.split(':').map(Number);
  markers.push({id:-1_000_000_000_000-x*8-y,type:'directory_cluster',name:label(cluster.count),lat:cluster.latitude,lng:cluster.longitude,
   clusterCount:cluster.count,clusterBounds:[cluster.west,cluster.south,cluster.east,cluster.north]});
 }
 const selected=selectedId!==undefined?byId.get(selectedId):undefined;if(selected)append(selected);
 return markers;
}

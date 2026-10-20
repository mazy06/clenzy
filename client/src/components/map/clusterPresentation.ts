export const MAP_VISIBLE_SYMBOL_LIMIT=300;

/** Paliers inférieurs : les libellés n’annoncent jamais plus de lieux que le groupe. */
export function clusterCountLabel(count:number):string{
 if(count<10)return String(count);
 const power=10**Math.floor(Math.log10(count));
 const ratio=count/power;
 const bucket=power*(ratio>=5?5:ratio>=2.5?2.5:1);
 return bucket>=1_000_000?`${bucket/1_000_000}M+`:bucket>=1000?`${bucket/1000}k+`:`${bucket}+`;
}
/** Six ordres de grandeur sur 32–64 px : les grands groupes laissent le fond de carte visible. */
export function clusterDiameter(count:number):number{
 return Math.round(32+32*Math.min(1,Math.log10(Math.max(1,count))/6));
}
interface MapFeature {geometry:{coordinates:number[]};properties:{index?:number;cluster_id?:number;point_count?:number}}
/** Plafonne les repères affichés après regroupement, en conservant les effectifs réels. */
export function selectVisibleMapFeatures<T extends MapFeature>(features:T[],bounds:{west:number;east:number;south:number;north:number},limit=MAP_VISIBLE_SYMBOL_LIMIT):T[]{
 if(features.length<=limit)return features;
 if(limit<=0)return [];
 const width=bounds.east>=bounds.west?bounds.east-bounds.west:360-bounds.west+bounds.east;
 const cells=new Map<number,T[]>();
 for(const feature of features){
  const [lng,lat]=feature.geometry.coordinates;
  const x=Math.min(11,Math.max(0,Math.floor(((lng-bounds.west+360)%360)/Math.max(width,1e-9)*12)));
  const y=Math.min(7,Math.max(0,Math.floor((lat-bounds.south)/Math.max(bounds.north-bounds.south,1e-9)*8)));
  const key=y*12+x,bucket=cells.get(key)??[];bucket.push(feature);cells.set(key,bucket);
 }
 const groups=[...cells.entries()].sort(([a],[b])=>a-b).map(([,group])=>group.sort((a,b)=>(b.properties.point_count??1)-(a.properties.point_count??1)||(a.properties.cluster_id??a.properties.index??0)-(b.properties.cluster_id??b.properties.index??0)));
 const chosen:T[]=[];
 for(let round=0;chosen.length<limit;round++){
  let found=false;
  for(const group of groups){if(group[round]){chosen.push(group[round]);found=true;}if(chosen.length===limit)break;}
  if(!found)break;
 }
 return chosen;
}

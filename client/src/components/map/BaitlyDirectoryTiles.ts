import type {Map as MapLibreMap,MapMouseEvent,MapGeoJSONFeature,ErrorEvent} from 'maplibre-gl';
import {BAITLY_FONTS} from './baitlyMapStyle';
import {prefersReducedMotion} from './motion';

const SOURCE='baitly-directory-professionals',CIRCLES=SOURCE+'-circles',LABELS=SOURCE+'-labels';
export interface DirectoryTilesOptions {url:string;onReference:(id:number)=>void;onError:()=>void;onNavigate?:()=>void;onReady?:()=>void}
/** Vector tile lifecycle is independent of the DOM markers and preserves the selected company card. */
export class BaitlyDirectoryTiles {
 private disposed=false;
 private ready=false;
 private renderPending=false;
 constructor(private map:MapLibreMap,private options:DirectoryTilesOptions){
  map.on('style.load',this.styleReady);map.on('load',this.styleReady);map.on('idle',this.idle);map.on('sourcedata',this.sourceData);map.on('error',this.error);this.install();
 }
 private sourceData=(event:{sourceId?:string;sourceDataType?:string;isSourceLoaded?:boolean})=>{
  if(this.disposed||this.ready||this.renderPending||event.sourceId!==SOURCE||!this.map.getLayer(CIRCLES))return;
  if(event.sourceDataType!=='content'&&!event.isSourceLoaded)return;
  this.renderPending=true;this.map.once('render',this.rendered);this.map.triggerRepaint();
 };
 private rendered=()=>{
  this.renderPending=false;
  if(this.disposed||this.ready||!this.map.getLayer(CIRCLES))return;
  // A loaded empty viewport is also usable; otherwise wait for an actual visible cluster.
  if(!this.map.queryRenderedFeatures({layers:[CIRCLES]}).length&&!this.map.isSourceLoaded(SOURCE))return;
  this.ready=true;this.options.onReady?.();
 };
 private styleReady=()=>this.install(true);
 private idle=()=>this.install();
 private error=(event:ErrorEvent)=>{if((event as ErrorEvent&{sourceId?:string}).sourceId===SOURCE)this.options.onError();};
 private install=(styleReady=false)=>{
  // style.load means addSource is safe, even while basemap tiles keep isStyleLoaded() false.
  if(this.disposed||!styleReady&&!this.map.isStyleLoaded())return;
  if(this.map.getSource(SOURCE))return;
  this.map.addSource(SOURCE,{type:'vector',tiles:[this.options.url],minzoom:0,maxzoom:9,promoteId:'id'});
  const tokens=getComputedStyle(this.map.getCanvasContainer()),ink=tokens.getPropertyValue('--bui-navy').trim()||'#25406e',surface=tokens.getPropertyValue('--bui-card').trim()||'#f7f9fc';
  this.map.addLayer({id:CIRCLES,type:'circle',source:SOURCE,'source-layer':'professionals',paint:{
   'circle-color':ink,'circle-radius':['interpolate',['linear'],['ln',['max',1,['get','count']]],0,16,Math.log(1_000_000),32],
   'circle-stroke-width':2,'circle-stroke-color':surface}});
  const labels:(string|number|unknown[])[]=['step',['get','count'],['to-string',['get','count']]];
  for(const [count,label] of [[10,'10+'],[25,'25+'],[50,'50+'],[100,'100+'],[250,'250+'],[500,'500+'],[1000,'1k+'],[2500,'2.5k+'],[5000,'5k+'],[10000,'10k+'],[25000,'25k+'],[50000,'50k+'],[100000,'100k+'],[250000,'250k+'],[500000,'500k+'],[1000000,'1M+']] as const)labels.push(count,label);
  this.map.addLayer({id:LABELS,type:'symbol',source:SOURCE,'source-layer':'professionals',
   layout:{'text-field':labels as never,'text-font':[BAITLY_FONTS.bold],'text-size':12,'text-allow-overlap':true,'text-ignore-placement':true},
   paint:{'text-color':surface}});
  this.map.off('click',CIRCLES,this.click);this.map.off('mouseenter',CIRCLES,this.enter);this.map.off('mouseleave',CIRCLES,this.leave);
  this.map.on('click',CIRCLES,this.click);this.map.on('mouseenter',CIRCLES,this.enter);this.map.on('mouseleave',CIRCLES,this.leave);
 };
 private click=(event:MapMouseEvent&{features?:MapGeoJSONFeature[]})=>{
  const p=event.features?.[0]?.properties;if(!p)return;
  if(Number(p.count)===1){this.options.onReference(Number(p.id));return;}
  const bounds=[Number(p.west),Number(p.south),Number(p.east),Number(p.north)] as const;
  this.options.onNavigate?.();
  if(bounds.every(Number.isFinite))this.map.fitBounds([[bounds[0],bounds[1]],[bounds[2],bounds[3]]],{padding:56,maxZoom:16,duration:prefersReducedMotion()?0:450});
 };
 private enter=()=>{this.map.getCanvas().style.cursor='pointer';};
 private leave=()=>{this.map.getCanvas().style.cursor='';};
 dispose(){
  this.disposed=true;this.map.off('style.load',this.styleReady);this.map.off('load',this.styleReady);this.map.off('idle',this.idle);this.map.off('sourcedata',this.sourceData);this.map.off('render',this.rendered);this.map.off('error',this.error);
  this.map.off('click',CIRCLES,this.click);this.map.off('mouseenter',CIRCLES,this.enter);this.map.off('mouseleave',CIRCLES,this.leave);
  if(this.map.getLayer(LABELS))this.map.removeLayer(LABELS);
  if(this.map.getLayer(CIRCLES))this.map.removeLayer(CIRCLES);
  if(this.map.getSource(SOURCE))this.map.removeSource(SOURCE);
 }
}

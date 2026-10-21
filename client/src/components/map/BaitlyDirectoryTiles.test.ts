import {expect,it,vi} from 'vitest';
import type {Map as MapLibreMap} from 'maplibre-gl';
import {BaitlyDirectoryTiles} from './BaitlyDirectoryTiles';
const SOURCE='baitly-directory-professionals';
function fixture(styleLoaded=true){
 const sources=new Set<string>(),layers=new Set<string>();
 const map={
  on:vi.fn(),once:vi.fn(),off:vi.fn(),triggerRepaint:vi.fn(),queryRenderedFeatures:vi.fn(()=>[{}]),isSourceLoaded:vi.fn(()=>true),isStyleLoaded:()=>styleLoaded,getSource:(id:string)=>sources.has(id),getLayer:(id:string)=>layers.has(id),
  getStyle:()=>({layers:[{id:'water-label',type:'symbol',layout:{'text-font':['Baitly Sans Italic']}}]}),getCanvasContainer:()=>document.body,getCanvas:()=>document.createElement('canvas'),
  addSource:vi.fn((id:string)=>sources.add(id)),addLayer:vi.fn((layer:{id:string})=>layers.add(layer.id)),
  removeSource:vi.fn((id:string)=>sources.delete(id)),removeLayer:vi.fn((id:string)=>layers.delete(id)),fitBounds:vi.fn()
 };
 const onReference=vi.fn(),onError=vi.fn(),onNavigate=vi.fn(),onReady=vi.fn();
 const layer=new BaitlyDirectoryTiles(map as unknown as MapLibreMap,{url:'https://api.example.test/{z}/{x}/{y}.mvt',onReference,onError,onNavigate,onReady});
 const click=map.on.mock.calls.find(call=>call[0]==='click')?.[2] as unknown as (event:unknown)=>void;
 return {map,layer,click,onReference,onError,onNavigate,onReady};
}
it('reports readiness after a rendered directory tile, never for basemap data or metadata',()=>{
 const f=fixture();
 const source=f.map.on.mock.calls.find(call=>call[0]==='sourcedata')?.[1] as (event:unknown)=>void;
 source({sourceId:'world',sourceDataType:'content'});source({sourceId:SOURCE,sourceDataType:'metadata'});
 expect(f.map.once).not.toHaveBeenCalled();expect(f.onReady).not.toHaveBeenCalled();
 source({sourceId:SOURCE,sourceDataType:'content'});
 expect(f.onReady).not.toHaveBeenCalled();
 const render=f.map.once.mock.calls.find(call=>call[0]==='render')?.[1] as ()=>void;
 render();source({sourceId:SOURCE,sourceDataType:'content'});render();
 expect(f.onReady).toHaveBeenCalledOnce();f.layer.dispose();
});
it('waits for visible features or a completely loaded empty viewport and ignores late renders after disposal',()=>{
 const f=fixture();f.map.queryRenderedFeatures.mockReturnValue([]);f.map.isSourceLoaded.mockReturnValue(false);
 const source=f.map.on.mock.calls.find(call=>call[0]==='sourcedata')?.[1] as (event:unknown)=>void;
 source({sourceId:SOURCE,sourceDataType:'content'});
 const render=f.map.once.mock.calls[0][1] as ()=>void;
 render();expect(f.onReady).not.toHaveBeenCalled();
 f.map.isSourceLoaded.mockReturnValue(true);source({sourceId:SOURCE,isSourceLoaded:true});render();
 expect(f.onReady).toHaveBeenCalledOnce();f.layer.dispose();render();expect(f.onReady).toHaveBeenCalledOnce();
});
it('uses upright medium counts even when the first basemap label is italic',()=>{
 const f=fixture();
 expect(f.map.addLayer).toHaveBeenCalledWith(expect.objectContaining({
  id:SOURCE+'-labels',layout:expect.objectContaining({'text-font':['Baitly Sans Medium']})
 }));
 f.layer.dispose();
});
it('installs on stylesheet readiness while the basemap tiles are still loading',()=>{
 const f=fixture(false);expect(f.map.addSource).not.toHaveBeenCalled();
 const loaded=f.map.on.mock.calls.find(call=>call[0]==='style.load')?.[1] as ()=>void;
 loaded();expect(f.map.addSource).toHaveBeenCalledOnce();expect(f.map.addLayer).toHaveBeenCalledTimes(2);
 loaded();expect(f.map.addSource).toHaveBeenCalledOnce();f.layer.dispose();
});
it('catches map load when stylesheet readiness occurred before the layer subscribed',()=>{
 const f=fixture(false);
 const loaded=f.map.on.mock.calls.find(call=>call[0]==='load')?.[1] as ()=>void;
 loaded();expect(f.map.addSource).toHaveBeenCalledOnce();f.layer.dispose();
});
it('zooms aggregate bounds and selects a real reference only for a single company',()=>{
 const f=fixture();
 f.click({features:[{properties:{id:4,count:200,west:1,south:45,east:3,north:48}}]});
 expect(f.onReference).not.toHaveBeenCalled();expect(f.onNavigate).toHaveBeenCalledOnce();expect(f.map.fitBounds).toHaveBeenCalledOnce();
 f.click({features:[{properties:{id:4,count:1}}]});expect(f.onReference).toHaveBeenCalledWith(4);
 f.layer.dispose();
});
it('isolates tile failures and removes only its own source and layers',()=>{
 const f=fixture();
 const error=f.map.on.mock.calls.find(call=>call[0]==='error')?.[1] as unknown as (event:unknown)=>void;
 error({sourceId:'protomaps'});expect(f.onError).not.toHaveBeenCalled();
 error({sourceId:SOURCE});expect(f.onError).toHaveBeenCalledOnce();
 f.layer.dispose();
 expect(f.map.removeSource).toHaveBeenCalledExactlyOnceWith(SOURCE);
 expect(f.map.removeLayer).toHaveBeenCalledTimes(2);
 expect(f.map.off).toHaveBeenCalled();
});

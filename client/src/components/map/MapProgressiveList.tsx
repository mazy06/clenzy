import { useEffect,useRef,useState,type ReactNode } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import BaitlyVirtualMapList from './BaitlyVirtualMapList';

/** Collections déjà chargées : ajoute des lignes au bas du panneau partagé, sans pages. */
export default function MapProgressiveList<T>({items,renderItem,resetKey,batchSize=20,activeIndex=-1,virtualize=false,getItemKey}:{items:T[];renderItem:(item:T)=>ReactNode;resetKey:string;batchSize?:number;activeIndex?:number;virtualize?:boolean;getItemKey?:(item:T)=>string|number}) {
  return virtualize?<BaitlyVirtualMapList key={resetKey} items={items} renderItem={renderItem} activeIndex={activeIndex} getItemKey={getItemKey}/>:<ProgressiveRows items={items} renderItem={renderItem} resetKey={resetKey} batchSize={batchSize} activeIndex={activeIndex}/>;
}
function ProgressiveRows<T>({items,renderItem,resetKey,batchSize,activeIndex}:{items:T[];renderItem:(item:T)=>ReactNode;resetKey:string;batchSize:number;activeIndex:number}) {
  const {t}=useTranslation();
  const [window,setWindow]=useState({key:resetKey,count:batchSize});
  const count=Math.max(window.key===resetKey?window.count:batchSize,activeIndex+1);
  const rows=useRef<HTMLDivElement>(null);
  const end=useRef<HTMLDivElement>(null);
  const more=count<items.length;
  const reveal=()=>setWindow({key:resetKey,count:count+batchSize});
  useEffect(()=>{
    if(activeIndex<0)return;
    setWindow(previous=>({key:resetKey,count:Math.max(previous.key===resetKey?previous.count:batchSize,activeIndex+1)}));
    const row=rows.current?.children[activeIndex] as HTMLElement|undefined;
    const panel=rows.current?.closest<HTMLElement>('[data-map-list-scroll]');
    if(!row||!panel)return;
    const bounds=panel.getBoundingClientRect(),item=row.getBoundingClientRect();
    const delta=item.top<bounds.top?item.top-bounds.top:item.bottom>bounds.bottom?item.bottom-bounds.bottom:0;
    // Déplacer seulement le panneau, jamais la page ou la caméra de la carte.
    if(delta)panel.scrollTo({top:panel.scrollTop+delta,behavior:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  },[activeIndex,resetKey,batchSize]);
  useEffect(()=>{
    const node=end.current;
    if(!node||!more||typeof IntersectionObserver==='undefined')return;
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))setWindow(previous=>({key:resetKey,count:(previous.key===resetKey?previous.count:batchSize)+batchSize}));},
      {root:node.closest('[data-map-list-scroll]'),rootMargin:'0px 0px 160px 0px'});
    observer.observe(node);return()=>observer.disconnect();
  },[resetKey,count,more,batchSize]);
  return <><div ref={rows} className="contents">{items.slice(0,count).map(renderItem)}</div>{more&&<div ref={end} className="flex justify-center p-3"><button type="button" onClick={reveal} className="min-h-9 cursor-pointer rounded-md px-3 text-xs text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">{t('missionMap.loadMore','Charger les 20 suivants')}</button></div>}</>;
}

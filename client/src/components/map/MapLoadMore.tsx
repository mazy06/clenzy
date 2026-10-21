import {useEffect,useRef} from 'react';
import {Button} from '../ui';
import {useTranslation} from '../../hooks/useTranslation';
import {MapLoadingIndicator} from './MapLoading';

/** Server pagination appended on scroll in the shared map sheet; button is the accessible fallback. */
export default function MapLoadMore({hasMore,busy,onMore,label,loadingLabel}:{hasMore:boolean;busy:boolean;onMore:()=>void;label:string;loadingLabel?:string}){
 const {t}=useTranslation();
 const sentinel=useRef<HTMLDivElement>(null);
 const onMoreRef=useRef(onMore);onMoreRef.current=onMore;
 useEffect(()=>{
  const node=sentinel.current;if(!node||!hasMore||busy||typeof IntersectionObserver==='undefined')return;
  const panel=node.closest<HTMLElement>('[data-map-list-scroll]');if(!panel)return;
  let visible=false,armed=false;
  const request=()=>{if(visible&&armed){armed=false;onMoreRef.current();}};
  const gesture=()=>{armed=true;request();};
  const keyboard=(event:KeyboardEvent)=>{if(['ArrowDown','PageDown','End',' '].includes(event.key)&&!(event.target as HTMLElement)?.closest('input,select,textarea,button,a'))gesture();};
  const scrollbar=(event:PointerEvent)=>{if(event.target===panel)gesture();};
  const observer=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);request();},{root:panel,rootMargin:'150px'});
  panel.addEventListener('wheel',gesture,{passive:true});panel.addEventListener('touchmove',gesture,{passive:true});
  panel.addEventListener('keydown',keyboard);panel.addEventListener('pointerdown',scrollbar);
  observer.observe(node);return()=>{observer.disconnect();panel.removeEventListener('wheel',gesture);panel.removeEventListener('touchmove',gesture);panel.removeEventListener('keydown',keyboard);panel.removeEventListener('pointerdown',scrollbar);};
 },[hasMore,busy]);
 return hasMore?<div ref={sentinel}>{busy?<MapLoadingIndicator label={loadingLabel??t('common.loading','Chargement…')}/>:<div className="flex justify-center p-3"><Button size="sm" variant="ghost" onClick={onMore}>{label}</Button></div>}</div>:null;
}

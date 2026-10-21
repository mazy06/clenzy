import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {defaultRangeExtractor,measureElement,observeElementRect,useVirtualizer} from '@tanstack/react-virtual';

/** Variable-height Baitly rows share the sheet's scroll element, never the document scroll. */
export default function BaitlyVirtualMapList<T>({items,renderItem,activeIndex=-1,getItemKey}:{items:T[];renderItem:(item:T)=>ReactNode;activeIndex?:number;getItemKey?:(item:T)=>string|number}){
 const host=useRef<HTMLDivElement>(null);
 const [panel,setPanel]=useState<HTMLElement|null>(null),[margin,setMargin]=useState(0),[focusedKey,setFocusedKey]=useState<string|number|null>(null);
 const focused=useMemo(()=>focusedKey===null?-1:items.findIndex((item,index)=>(getItemKey?.(item)??index)===focusedKey),[items,getItemKey,focusedKey]);
 useLayoutEffect(()=>{
  const node=host.current,scroll=node?.closest<HTMLElement>('[data-map-list-scroll]');
  if(!node||!scroll)return;
  setPanel(scroll);
  const measure=()=>setMargin(node.getBoundingClientRect().top-scroll.getBoundingClientRect().top+scroll.scrollTop);
  measure();
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);
  observer?.observe(scroll);observer?.observe(node);
  return()=>observer?.disconnect();
 },[]);
 const key=useCallback((index:number)=>getItemKey?.(items[index])??index,[items,getItemKey]);
 const virtual=useVirtualizer({count:items.length,getScrollElement:()=>panel,estimateSize:()=>180,getItemKey:key,
  overscan:5,scrollMargin:margin,initialRect:{width:360,height:600},
  observeElementRect:(instance,notify)=>observeElementRect(instance,rect=>notify({width:rect.width||360,height:rect.height||600})),
  measureElement:(element,entry,instance)=>measureElement(element,entry,instance)||180,
  rangeExtractor:range=>{
   const indexes=defaultRangeExtractor(range);
   for(const index of [focused,activeIndex])if(index>=0&&index<items.length&&!indexes.includes(index))indexes.push(index);
   return indexes.sort((a,b)=>a-b);
  }});
 useEffect(()=>{if(panel&&activeIndex>=0&&activeIndex<items.length)virtual.scrollToIndex(activeIndex,{align:'auto',behavior:'auto'});},[panel,activeIndex,items.length,virtual]);
 return <div ref={host} role="list" style={{height:virtual.getTotalSize(),position:'relative',overflowAnchor:'none'}}
  onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setFocusedKey(null);}}>
  {virtual.getVirtualItems().map(row=><div key={row.key} ref={virtual.measureElement} data-index={row.index} role="listitem" aria-posinset={row.index+1} aria-setsize={items.length}
   onFocusCapture={()=>setFocusedKey(key(row.index))}
   style={{position:'absolute',insetInline:0,top:0,transform:`translateY(${row.start-margin}px)`}}>{renderItem(items[row.index])}</div>)}
 </div>;
}

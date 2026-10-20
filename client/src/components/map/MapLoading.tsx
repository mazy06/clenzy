import {Skeleton,Spinner} from '../ui';
import './map-loading.css';

/** Non-blocking map feedback, also reused while appending server pages. */
export function MapLoadingIndicator({label,overlay=false}:{label:string;overlay?:boolean}){
 return <div className="baitly-map-loading" data-overlay={overlay} role="status" aria-live="polite" aria-label={label}>
  <div className="baitly-map-loading__indicator"><Spinner role="presentation" aria-hidden="true" aria-label={undefined}/><span>{label}</span></div>
 </div>;
}

export function MapListSkeleton(){
 return <div className="baitly-map-list-skeleton" aria-hidden="true">{Array.from({length:4},(_,index)=><div className="baitly-map-list-skeleton__row" key={index}>
  <Skeleton className="baitly-map-list-skeleton__icon"/>
  <div><Skeleton className="baitly-map-list-skeleton__name"/><Skeleton className="baitly-map-list-skeleton__service"/><Skeleton className="baitly-map-list-skeleton__address"/></div>
 </div>)}</div>;
}

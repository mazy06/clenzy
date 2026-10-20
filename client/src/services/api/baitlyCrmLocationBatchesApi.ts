import apiClient from '../apiClient';
import type {BaitlyOsmCandidate} from './baitlyCrmLocationsApi';
export type BaitlyLocationBatchStatus='QUEUED'|'PROPOSED'|'NOT_FOUND'|'NEEDS_DATA'|'FAILED'|'CONFIRMED'|'SKIPPED';
export interface BaitlyLocationBatch {
  job?:{id:string;country:string;status:'RUNNING'|'COMPLETED'|'CANCELLED';created_at:string};
  counts?:{status:BaitlyLocationBatchStatus;count:number}[];
  content?:{prospect_id:number;name:string;city?:string;contact_type?:'OWNER'|'PROVIDER';category?:string;status:BaitlyLocationBatchStatus;candidates:BaitlyOsmCandidate[]}[];
  totalElements?:number;
}
export const baitlyCrmLocationBatchesApi={
  config:()=>apiClient.get<{enabled:boolean}>('/prospect-location-batches/config'),
  latest:(page=0)=>apiClient.get<BaitlyLocationBatch>(`/prospect-location-batches?page=${page}`),
  start:(country:string,publicBusinesses:boolean)=>apiClient.post<{id:string}>('/prospect-location-batches',{country,publicBusinesses}),
  cancel:(id:string)=>apiClient.post<void>(`/prospect-location-batches/${id}/cancel`),
  confirm:(id:string,prospect:number,index:number)=>apiClient.post<void>(`/prospect-location-batches/${id}/contacts/${prospect}/confirm`,{index}),
  skip:(id:string,prospect:number)=>apiClient.post<void>(`/prospect-location-batches/${id}/contacts/${prospect}/skip`),
};

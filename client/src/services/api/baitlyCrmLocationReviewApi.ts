import apiClient from '../apiClient';
import type {BaitlyOsmResults} from './baitlyCrmLocationsApi';
import type {DirectoryImportResult} from './baitlyProfessionalDirectoryApi';
export interface BaitlyLocationProgress {
 items:{id:number;status:'PENDING'|'CONFIRMED'|'SKIPPED'|'NOT_FOUND'}[];
 remaining:number;confirmed:number;skipped:number;notFound:number;
}
export interface BaitlyOsmEnrichment {status:'CONFIRMED'|'ALREADY_LOCATED'|'REVIEW'|'SKIPPED'|'NOT_FOUND';copiedFields:string[];proposal?:BaitlyOsmResults|null}
export const baitlyCrmLocationReviewApi={
 prepareImported:(signal?:AbortSignal)=>apiClient.post<DirectoryImportResult[]>('/prospect-location-review/prepare-imported',undefined,{signal}),
 enrich:(id:number,signal?:AbortSignal)=>apiClient.post<BaitlyOsmEnrichment>(`/prospect-location-review/${id}/enrich`,undefined,{signal}),
 progress:()=>apiClient.get<BaitlyLocationProgress>('/prospect-location-review'),
 enqueue:(ids:number[])=>apiClient.post<BaitlyLocationProgress>('/prospect-location-review',ids),
 skip:(id:number)=>apiClient.post<BaitlyLocationProgress>(`/prospect-location-review/${id}/skip`),
 search:(id:number,signal?:AbortSignal)=>apiClient.post<BaitlyOsmResults>(`/prospect-location-review/${id}/search`,undefined,{signal}),
};

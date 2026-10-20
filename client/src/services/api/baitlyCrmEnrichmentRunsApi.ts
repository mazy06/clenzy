import apiClient from '../apiClient';
export interface BaitlyEnrichmentRun {
 id:string;status:'RUNNING'|'COMPLETED'|'CANCELLED';locationOnly:boolean;
 total:number;confirmed:number;review:number;pending:number;unavailable:number;failed:number;
}
export interface BaitlyEnrichmentProgress {run:BaitlyEnrichmentRun|null}
export const baitlyCrmEnrichmentRunsApi={
 latest:()=>apiClient.get<BaitlyEnrichmentProgress>('/prospect-enrichment-runs'),
 start:(ids:readonly number[]|undefined,locationOnly:boolean)=>apiClient.post<BaitlyEnrichmentProgress>('/prospect-enrichment-runs',{ids:ids??null,locationOnly}),
 cancel:(id:string)=>apiClient.post<void>(`/prospect-enrichment-runs/${id}/cancel`),
};

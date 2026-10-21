import {baitlyCrmEnrichmentRunsApi} from '../../services/api/baitlyCrmEnrichmentRunsApi';
import type {DirectoryImportResult} from '../../services/api/baitlyProfessionalDirectoryApi';
import {importedCrmContactIds} from './baitlyCrmImportedContacts';

export interface BaitlyEnrichmentSummary {confirmed:number;review:number;pending:number}
/** Starts durable server work; leaving an import screen only stops observing it. */
export async function enrichImportedContacts(results:DirectoryImportResult[],signal:AbortSignal,onProgress?:(summary:BaitlyEnrichmentSummary)=>void){
 const ids=importedCrmContactIds(results);let summary:BaitlyEnrichmentSummary={confirmed:0,review:0,pending:ids.length};
 if(!ids.length||signal.aborted)return summary;
 try {
  const {run}=await baitlyCrmEnrichmentRunsApi.start(ids,false);
  if(run)summary={confirmed:run.confirmed,review:run.review,pending:run.pending+run.failed};
 }catch{/* The import already succeeded. A later CRM action can resume enrichment. */}
 if(!signal.aborted)onProgress?.(summary);
 return summary;
}

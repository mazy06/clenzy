import type {NationalDirectoryStatus} from '../../services/api/baitlyProfessionalDirectoryApi';
import {professionalDirectoryMessages} from '../../i18n/baitlyProfessionalDirectoryMessages';

export function nationalFeedLabel(data:NationalDirectoryStatus|undefined,language:string){
 const m=professionalDirectoryMessages(language);
 if(!data)return m.syncStarting;
 if(!data.enabled)return m.syncDisabled;
 if(data.retry_at&&Date.parse(data.retry_at)>Date.now())return m.syncPaused;
 switch(data.phase){case 'COMPLETED':return m.syncComplete;case 'ESTABLISHMENTS':return m.syncEstablishments;case 'UNITS':return m.syncUnits;case 'PUBLISH':return m.syncPublish;default:return m.syncStarting;}
}
/** The feed belongs to the server. Consulting this status never starts an import. */
export default function BaitlyNationalFeedStatus({data,language,error,onRetry}:{data:NationalDirectoryStatus|undefined;language:string;error:boolean;onRetry:()=>void}){
 const m=professionalDirectoryMessages(language),running=!!data?.enabled&&data.phase!==undefined&&data.phase!=='COMPLETED'&&!(data.retry_at&&Date.parse(data.retry_at)>Date.now());
 return <details className="baitly-national-feed"><summary><strong>{error&&!data?m.syncUnavailable:nationalFeedLabel(data,language)}</strong>{data?.published!==undefined&&<span className="tabular-nums"> · {data.published.toLocaleString(language)} {m.published}</span>}</summary>
  <p>{m.syncHelp}</p><p>{m.sourceCoverage}</p>
  {data?.scanned!==undefined&&<p className="tabular-nums">{data.scanned.toLocaleString(language)} {m.sourceRows}</p>}
  {data?.completed_at&&Number.isFinite(Date.parse(data.completed_at))&&<p><time dateTime={data.completed_at}>{new Date(data.completed_at).toLocaleString(language)}</time></p>}
  {data?.retry_at&&Number.isFinite(Date.parse(data.retry_at))&&Date.parse(data.retry_at)>Date.now()&&<p>{m.syncPaused} : <time dateTime={data.retry_at}>{new Date(data.retry_at).toLocaleString(language)}</time></p>}
  {error&&<button className="cursor-pointer underline" type="button" onClick={onRetry}>{m.retry}</button>}
  {running&&<progress aria-label={nationalFeedLabel(data,language)}/>}
  <p><a href="https://www.data.gouv.fr/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret" target="_blank" rel="noopener noreferrer">Sirene · Licence Ouverte 2.0</a></p>
 </details>;
}

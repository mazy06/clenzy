import {Button} from '../../components/ui';
import {usePageHeaderActions} from '../../components/PageHeaderActionsContext';
import {useTranslation} from '../../hooks/useTranslation';
import {professionalDirectoryMessages} from '../../i18n/baitlyProfessionalDirectoryMessages';
import {useBaitlyCrmEnrichment} from './useBaitlyCrmEnrichment';
import {MapPin} from '../../icons/glyphs';
import BaitlyCrmIconAction from './BaitlyCrmIconAction';

/** Uses the existing import evidence and enrichment pipeline, without importing another contact. */
export default function BaitlyCrmEnrichImported({onReview}:{onReview:()=>void}){
 const {currentLanguage}=useTranslation();const m=professionalDirectoryMessages(currentLanguage??'fr');
 const {enrich,summary,cancel}=useBaitlyCrmEnrichment();
 const actions=usePageHeaderActions(<BaitlyCrmIconAction action="enrich" label={enrich.isPending?m.enriching:m.enrichExisting} icon={<MapPin size={16}/>} disabled={enrich.isPending} aria-busy={enrich.isPending} onClick={()=>enrich.mutate()}/>);
 return <>{actions}
  {(enrich.isPending||enrich.isSuccess||enrich.isError)&&<div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 text-xs tabular-nums">
   {enrich.isError?<p role="alert" className="text-destructive">{m.error}</p>:enrich.data?.cancelled?<p role="status">{m.enrichmentStopped}</p>:enrich.data?.total===0?<p role="status">{m.noImportedToEnrich}</p>:summary?<p role="status">{summary.confirmed} {m.autoLocated} · {summary.review} {m.manualReview} · {summary.pending} {m.enrichmentPending}</p>:<p role="status">{m.enriching}</p>}
   {enrich.isPending&&<Button variant="ghost" size="sm" onClick={cancel}>{m.cancelCapture}</Button>}
   {!enrich.isPending&&summary&&(summary.review>0||summary.pending>0)&&<Button variant="outline" size="sm" onClick={onReview}>{m.reviewImported} ({summary.review+summary.pending})</Button>}
  </div>}
 </>;
}

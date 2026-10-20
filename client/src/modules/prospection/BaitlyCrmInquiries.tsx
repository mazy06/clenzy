import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, Button, Skeleton } from '../../components/ui';
import PagePagination from '../../components/PagePagination';
import { baitlyInquiriesApi, type BaitlyInquiry } from '../../services/api/baitlyInquiriesApi';
import { useTranslation } from '../../hooks/useTranslation';
import {crmWorkflowMessages} from '../../i18n/baitlyCrmWorkflowMessages';
import BaitlyCrmIconAction from "./BaitlyCrmIconAction";
import BaitlyCrmHeaderActions from './BaitlyCrmHeaderActions';
import {ChevronDown,ArrowUpRight,RefreshCw} from '../../icons/glyphs';
import { getPropertyTypeLabel } from '../../utils/statusUtils';
import { recruitmentMessages,recruitmentTrade } from '../../i18n/baitlyRecruitmentMessages';

export default function BaitlyCrmInquiries({ org, canManage, onContact, contactId }: {
  org: number; canManage: boolean; onContact?: (id: number) => void; contactId?: number;
}) {
  const { t,currentLanguage } = useTranslation(); const client=useQueryClient(); const [page,setPage]=useState(0);
  const recruitment=recruitmentMessages(currentLanguage);const w=crmWorkflowMessages(currentLanguage);
  const query=useQuery({ queryKey: ['prospects',org,'inquiries',contactId,page], queryFn: () => baitlyInquiriesApi.list(page,contactId) });
  const update=useMutation({ mutationFn: ({ id,status }: { id: number; status: string }) => baitlyInquiriesApi.status(id,status),
    onSuccess: () => client.invalidateQueries({ queryKey: ['prospects',org,'inquiries'] }) });
  if(query.isPending)return <Skeleton className="h-24 w-full" />;
  if(query.isError)return <Alert variant="destructive"><AlertDescription>{t('baitlyInquiries.error')}</AlertDescription><Button variant="outline" onClick={() => query.refetch()}>{t('baitlyCrm.retry')}</Button></Alert>;
  return <section className="bcrm-inbox" aria-label={t('baitlyInquiries.title')}>
    {contactId===undefined&&<BaitlyCrmHeaderActions><BaitlyCrmIconAction action="refresh" label={t('common.refresh','Actualiser')} icon={<RefreshCw size={16}/>} disabled={query.isFetching} onClick={()=>query.refetch()}/></BaitlyCrmHeaderActions>}
    {update.isError&&<Alert variant="destructive"><AlertDescription>{t('baitlyInquiries.error')}</AlertDescription></Alert>}
    {!query.data.content.length&&<p className="bcrm-workflow-empty">{t('baitlyInquiries.empty')}</p>}
    {query.data.content.map((item:BaitlyInquiry)=><article key={item.id} className="bcrm-inquiry-row">
      <details className="bcrm-inquiry-content" open={contactId!==undefined}>
        <summary><ChevronDown size={15} aria-hidden /><span className="bcrm-inquiry-summary"><h3>{item.name}</h3><span className="bcrm-inquiry-context"><span className="bcrm-workflow-tag" data-tone={item.purpose==='APPLICATION'?'purple':'blue'}>{item.purpose==='APPLICATION'?recruitment.APPLICATION:t('baitlyInquiries.'+item.purpose)}</span><span>{item.city}</span>{item.needs_review&&<span className="bcrm-review-flag" title={t('baitlyInquiries.review')}>{w.review}</span>}</span><span className="bcrm-inquiry-excerpt">{item.message||item.application_availability}</span></span><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString(currentLanguage)}</time></summary>
        <div className="bcrm-inquiry-body">{item.needs_review&&<p className="bcrm-review-flag">{t('baitlyInquiries.review')}</p>}
          <p className="bcrm-inquiry-message">{item.message}</p>
          <div className="bcrm-inquiry-facts">
            <p>{item.city}{item.country_code?` (${item.country_code})`:''}{item.purpose!=='APPLICATION'&&` · ${getPropertyTypeLabel(item.property_type,t)}`}</p>
            <p className="bcrm-reply-coordinate">{t('baitlyInquiries.reply')} {t('baitlyInquiries.'+item.reply_channel)} : {item.reply_channel==='PHONE'?item.phone:item.email}</p>
            {item.recruitment_title&&<p>{recruitment.applicationTitle} : {item.recruitment_title}</p>}
            {!!item.application_services?.length&&<p>{recruitment.applicationServices} : {item.application_services.map(code=>recruitmentTrade(code,currentLanguage)).join(', ')}</p>}
            {item.application_availability&&<p>{recruitment.applicationAvailability} : {item.application_availability}</p>}
            {!!item.requested_services?.length&&<p>{t('baitlyOwnerMatch.services')} : {item.requested_services.map(service=>t('baitlyInquiries.service'+service)).join(', ')}</p>}
            {item.max_management_fee_pct!=null&&<p>{t('baitlyOwnerMatch.fee')} : {new Intl.NumberFormat(currentLanguage).format(item.max_management_fee_pct)} %</p>}
          </div>
          <details className="bcrm-help-disclosure"><summary>{w.origin}</summary><div>
            <p>{item.purpose==='APPLICATION'?recruitment.origin:t('baitlyInquiries.origin')} /{item.purpose==='APPLICATION'?'recrutement':'conciergeries'}/{item.profile_id}</p>
            <p>{t('baitlyInquiries.declared')} {[item.utm_source,item.utm_medium,item.utm_campaign,item.referrer_host].filter(Boolean).join(' · ')||t('baitlyInquiries.direct')}</p>
            <p>{t('baitlyInquiries.requestOnly')}</p>
          </div></details>
        </div>
      </details>
      <div className="bcrm-inquiry-actions">
        {canManage?<select aria-label={`${t('baitlyCrm.status')} : ${item.name}`} className="bcrm-inquiry-status" data-status={item.status} value={item.status} disabled={update.isPending} onChange={event=>update.mutate({id:item.id,status:event.target.value})}>{['NEW','IN_PROGRESS','CLOSED'].map(status=><option key={status} value={status}>{t('baitlyInquiries.'+status)}</option>)}</select>:<span className="bcrm-workflow-tag" data-status={item.status}>{t('baitlyInquiries.'+item.status)}</span>}
        {onContact&&<button type="button" className="bcrm-icon-action" title={t('baitlyInquiries.contact')} aria-label={`${t('baitlyInquiries.contact')} : ${item.name}`} onClick={()=>onContact(item.prospect_id)}><ArrowUpRight size={17}/></button>}
      </div>
    </article>)}
    {query.data.totalElements>25&&<PagePagination page={page} count={query.data.totalElements} rowsPerPage={25} onPageChange={setPage}/>}
  </section>;
}

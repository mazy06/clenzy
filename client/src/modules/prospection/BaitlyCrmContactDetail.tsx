import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, Button, Skeleton } from '../../components/ui';
import { prospectsApi } from '../../services/api/prospectsApi';
import { useTranslation } from '../../hooks/useTranslation';
import { prospectsKeys } from '../../hooks/useProspects';
import BaitlyCrmContactEditor from './BaitlyCrmContactEditor';
import BaitlyCrmAuthorizations from './BaitlyCrmAuthorizations';
import BaitlyCrmInquiries from './BaitlyCrmInquiries';
import { baitlyCrmError } from './BaitlyCrmFields';
import BaitlyCrmLocationEditor from './BaitlyCrmLocationEditor';
import PageTabs from '../../components/PageTabs';
import { BAITLY_CRM_STATUSES } from './BaitlyCrmFields';
import { prospectionMessages } from '../../i18n/baitlyProspectionMessages';
import { contactKind } from './baitlyCrmWorkspace';
import { BaitlyCrmKindIcon } from './BaitlyCrmContactCard';
import BaitlyCrmDetailsEditor from './BaitlyCrmDetailsEditor';

export default function BaitlyCrmContactDetail({ id, org, canManage, canAuthorize, onClose }: {
  id: number; org: number; canManage: boolean; canAuthorize: boolean; onClose: () => void;
}) {
  const { t, currentLanguage } = useTranslation(); const client = useQueryClient();
  const contact = useQuery({ queryKey: ['prospects', org, id], queryFn: () => prospectsApi.detail(id) });
  const duplicates = useQuery({ queryKey: ['prospects', org, id, 'duplicates'], queryFn: () => prospectsApi.duplicates(id) });
  const [editing,setEditing] = useState(false); const [confirmArchive,setConfirmArchive] = useState(false);
  const [tab,setTab]=useState('overview');const m=prospectionMessages(currentLanguage);
  const stage=useMutation({mutationFn:(status:string)=>prospectsApi.update(id,{status}),onSuccess:()=>client.invalidateQueries({queryKey:prospectsKeys.all})});
  const archive = useMutation({ mutationFn: () => prospectsApi.delete(id),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: prospectsKeys.all }); onClose(); } });
  if (contact.isPending) return <Skeleton className="h-64 w-full" />;
  if (!contact.data) return <Alert variant="destructive"><AlertDescription>{t('baitlyCrm.loadError')}</AlertDescription></Alert>;
  const p = contact.data;
  if (editing) return <BaitlyCrmContactEditor contact={p} onDone={() => setEditing(false)} />;
  return <article className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-balance">{p.name}</h2>
      <Button variant="ghost" size="sm" onClick={onClose} className="cursor-pointer">{t('common.close')}</Button>
    </div>
    <div className="bcrm-record-identity"><span className="bcrm-contact__avatar" data-kind={contactKind(p)}><BaitlyCrmKindIcon contact={p} /></span><span>{m[`${contactKind(p)}Label`]}</span><span>{p.city||m.cityMissing}</span></div>
    <div className="bcrm-relation-progress" role="group" aria-label={m.stage}>{BAITLY_CRM_STATUSES.map((status,index)=><button type="button" key={status} aria-pressed={p.status===status} disabled={!canManage||p.archived||stage.isPending} data-stage={status} onClick={()=>stage.mutate(status)}><span>{index+1}</span>{t('baitlyCrm.values.'+status)}</button>)}</div>
    {stage.isError&&<Alert variant="destructive"><AlertDescription>{t('baitlyCrm.saveError')}</AlertDescription></Alert>}
    <PageTabs trail={false} size="compact" options={[{value:'overview',label:m.overview},{value:'activity',label:m.activity},{value:'permissions',label:m.permissions},{value:'location',label:m.location}]} value={tab} onChange={setTab} />
    {p.archived && <p className="text-sm text-muted-foreground">{t('baitlyInquiries.archivedRecord')}</p>}
    {!!duplicates.data?.length && <Alert><AlertDescription>
      {t('baitlyCrm.duplicatesHelp', { count: duplicates.data.length })}
      <ul className="mt-2 list-inside list-disc">{duplicates.data.map((duplicate) => <li key={duplicate.id}>{duplicate.name} (#{duplicate.id})</li>)}</ul>
    </AlertDescription></Alert>}
    {tab==='overview'&&<div className="bcrm-record-overview"><section><BaitlyCrmInquiries org={org} contactId={id} canManage={canManage} /></section><section><BaitlyCrmDetailsEditor id={id} org={org} canManage={canManage&&!p.archived} /><dl className="bcrm-record-fields grid gap-3 text-sm sm:grid-cols-2">
      {['email','phone','specialty','contactNature','sourceType','sourceDetail','sourceRecordedAt'].filter(field=>Boolean(p[field as keyof typeof p])).map((field) => {
        const value = p[field as keyof typeof p];
        const displayed = field === 'sourceRecordedAt' && typeof value === 'string' ? new Date(value).toLocaleString(currentLanguage)
          : field === 'sourceType' && value === 'PUBLIC_FORM' ? t('baitlyInquiries.publicForm') : ['contactType','contactNature','status','sourceType'].includes(field) ? t('baitlyCrm.values.' + value) : String(value || '—');
        return <div key={field} className={field === 'sourceDetail' ? 'sm:col-span-2' : ''}>
          <dt className="text-xs text-muted-foreground">{t('baitlyCrm.' + field)}</dt>
          <dd className="whitespace-pre-wrap break-words tabular-nums">{displayed}</dd>
        </div>;
      })}
    </dl>
    {p.sourceUrl && <p className="break-all text-xs text-muted-foreground">{p.sourceUrl}</p>}
    {p.notes && <p className="whitespace-pre-wrap break-words text-sm">{p.notes}</p>}
    {canManage && !p.archived && <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="cursor-pointer">{t('baitlyCrm.edit')}</Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirmArchive((v) => !v)} className="cursor-pointer">{t('baitlyCrm.archive')}</Button>
    </div>}
    {confirmArchive && <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-sm">{t('baitlyCrm.archiveHelp')}</p>
      <Button variant="outline" size="sm" disabled={archive.isPending} onClick={() => archive.mutate()} className="cursor-pointer">{t('baitlyCrm.confirmArchive')}</Button>
    </div>}
    {archive.isError && <Alert variant="destructive"><AlertDescription>{baitlyCrmError(archive.error,t('baitlyCrm.saveError'))}</AlertDescription></Alert>}
    </section></div>}
    {tab==='location'&&<BaitlyCrmLocationEditor id={id} org={org} contact={p} canManage={canManage && !p.archived} />}
    {tab==='activity'&&<BaitlyCrmInquiries org={org} contactId={id} canManage={canManage} />}
    {tab==='permissions'&&<BaitlyCrmAuthorizations key={p.contactType + p.email + p.phone} contact={p} org={org} canAuthorize={canAuthorize && !p.archived} />}
  </article>;
}

import BaitlyCrmIconAction from "./BaitlyCrmIconAction";
import {Save} from "../../icons/glyphs";
import { useId,useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, Button, Input, Textarea, Skeleton } from '../../components/ui';
import { baitlyInquiriesApi, type BaitlyPublication } from '../../services/api/baitlyInquiriesApi';
import {crmWorkflowMessages} from '../../i18n/baitlyCrmWorkflowMessages';
import BaitlyCrmHeaderActions from './BaitlyCrmHeaderActions';
import {ArrowUpRight} from '../../icons/glyphs';
import { useTranslation } from '../../hooks/useTranslation';

export default function BaitlyCrmPublicPage({ org,canManage }: { org: number; canManage: boolean }) {
  const { t }=useTranslation();
  const query=useQuery({ queryKey: ['prospects',org,'publication'],queryFn: baitlyInquiriesApi.publication });
  if(query.isPending)return <Skeleton className="h-24 w-full" />;
  if(query.isError)return <Alert variant="destructive"><AlertDescription>{t('baitlyInquiries.error')}</AlertDescription><Button variant="outline" onClick={() => query.refetch()}>{t('baitlyCrm.retry')}</Button></Alert>;
  if(!query.data.available)return <p className="text-sm text-muted-foreground">{t('baitlyInquiries.conciergeOnly')}</p>;
  return <PublicationEditor key={JSON.stringify(query.data.profile)} profile={query.data.profile} org={org} canManage={canManage} />;
}
function PublicationEditor({ profile,org,canManage }: { profile: BaitlyPublication; org: number; canManage: boolean }) {
  const { t,currentLanguage }=useTranslation();const w=crmWorkflowMessages(currentLanguage); const client=useQueryClient(); const [published,setPublished]=useState(!!profile.networkPublished);
  const [services,setServices]=useState(profile.managementServices ?? []);
  const save=useMutation({ mutationFn: baitlyInquiriesApi.publish,
    onSuccess: () => client.invalidateQueries({ queryKey: ['prospects',org,'publication'] }) });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields=new FormData(event.currentTarget);
    save.mutate({ ...profile,name:String(fields.get('name')),city:String(fields.get('city')),bio:String(fields.get('bio')),networkPublished:published,managementServices:services });
  }
  const formId=useId();
  const site='https://baitly.fr';
  return <form id={formId} onSubmit={submit} className="bcrm-public-editor">
    <BaitlyCrmHeaderActions>{canManage&&<BaitlyCrmIconAction action="save" label={t('baitlyCrm.save')} icon={<Save size={16}/>} type="submit" form={formId} disabled={save.isPending}/>}</BaitlyCrmHeaderActions>
    <div className="bcrm-public-editor-head"><span className="bcrm-workflow-tag" data-status={profile.networkPublished?'PUBLISHED':'DRAFT'}>{profile.networkPublished?w.published:w.draft}</span>{profile.id&&profile.networkPublished&&<a href={`${site}/conciergeries/${profile.id}`} target="_blank" rel="noopener noreferrer">{w.open}<ArrowUpRight size={15}/></a>}</div>
    <fieldset disabled={!canManage || save.isPending} className="bcrm-public-fields">
      <label className="block text-sm">{t('baitlyCrm.name')}<Input name="name" required maxLength={150} defaultValue={profile.name} /></label>
      <label className="block text-sm">{t('baitlyCrm.city')}<Input name="city" maxLength={150} defaultValue={profile.city} /></label>
      <label className="bcrm-wide-field">{t('baitlyInquiries.bio')}<Textarea rows={3} name="bio" maxLength={1000} defaultValue={profile.bio} /></label>
      <fieldset className="bcrm-service-options bcrm-wide-field"><legend>{t('baitlyInquiries.services')}</legend>
        {['LISTINGS','PRICING','GUESTS','CLEANING','MAINTENANCE','OWNER_REPORTING'].map(service => <label key={service} className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={services.includes(service)} onChange={event => setServices(values => event.target.checked ? [...values,service] : values.filter(value => value !== service))} />
          {t('baitlyInquiries.service'+service)}
        </label>)}
      </fieldset>
      <div className="bcrm-publish-actions bcrm-wide-field"><label><input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} />{t('baitlyInquiries.published')}</label>
      </div>
    </fieldset>
    {save.isError && <Alert variant="destructive"><AlertDescription>{t('baitlyInquiries.error')}</AlertDescription></Alert>}
  </form>;
}

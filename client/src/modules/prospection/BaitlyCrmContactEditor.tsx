import React, { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, Button, Field, FieldLabel, Input, Textarea } from '../../components/ui';
import { prospectsApi, type BaitlyCrmContactWrite, type ProspectDto } from '../../services/api/prospectsApi';
import { prospectsKeys } from '../../hooks/useProspects';
import { useTranslation } from '../../hooks/useTranslation';
import { BaitlyCrmSelect, BAITLY_CRM_CATEGORIES, BAITLY_CRM_STATUSES, baitlyCrmError } from './BaitlyCrmFields';
import { prospectionMessages } from '../../i18n/baitlyProspectionMessages';
import { Home,KeyRound,Wrench } from '../../icons/glyphs';

export default function BaitlyCrmContactEditor({ contact, onDone }: { contact?: ProspectDto; onDone: (id?:number) => void }) {
  const { t,currentLanguage } = useTranslation(); const m=prospectionMessages(currentLanguage);const id = useId(); const client = useQueryClient();
  const [draft, setDraft] = useState<BaitlyCrmContactWrite>(() => contact ? { ...contact, sourceType: contact.sourceType === 'LEGACY' ? 'MANUAL' : contact.sourceType } : {
    name: '', email: '', phone: '', city: '', specialty: '', contactType: 'OWNER', contactNature: 'UNKNOWN',
    category: 'OWNERS', status: 'TO_CONTACT', sourceType: 'MANUAL', sourceDetail: '', sourceUrl: '', notes: '',
  });
  const set = (key: keyof BaitlyCrmContactWrite, value: string) => setDraft((prev) => ({ ...prev, [key]: value }));
  const save = useMutation({
    mutationFn: () => contact ? prospectsApi.update(contact.id, draft) : prospectsApi.create(draft),
    onSuccess: async (saved) => { await client.invalidateQueries({ queryKey: prospectsKeys.all }); onDone(saved.id); },
  });
  const fields = ['name', 'email', 'phone', 'city', 'specialty'] as const;
  return <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
    <h2 className="text-base font-semibold text-balance">{t(contact ? 'baitlyCrm.edit' : 'baitlyCrm.create')}</h2>
    {save.isError && <Alert variant="destructive"><AlertDescription>{baitlyCrmError(save.error, t('baitlyCrm.saveError'))}</AlertDescription></Alert>}
    <fieldset disabled={save.isPending} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <fieldset className="bcrm-identity-picker sm:col-span-2"><legend>{t('baitlyCrm.type')}</legend>{(['owner','concierge','provider'] as const).map(kind=>{
        const checked=draft.contactType==='OWNER'?kind==='owner':draft.category==='CONCIERGERIES'?kind==='concierge':kind==='provider';const Icon=kind==='owner'?Home:kind==='concierge'?KeyRound:Wrench;
        return <label key={kind} data-selected={checked}><input type="radio" name={id+'kind'} checked={checked} onChange={()=>setDraft(prev=>({...prev,contactType:kind==='owner'?'OWNER':'PROVIDER',category:kind==='owner'?'OWNERS':kind==='concierge'?'CONCIERGERIES':'PROVIDERS'}))} /><Icon size={17} aria-hidden /><span>{m[kind]}</span></label>;
      })}</fieldset>
      <BaitlyCrmSelect label={t('baitlyCrm.nature')} value={draft.contactNature ?? 'UNKNOWN'}
        values={['UNKNOWN','PRIVATE','PROFESSIONAL']} onChange={(v) => set('contactNature',v)} />
      {fields.map((field) => <Field key={field}><FieldLabel htmlFor={id + field}>{t('baitlyCrm.' + field)}</FieldLabel>
        <Input id={id + field} type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
          required={field === 'name'} maxLength={field === 'phone' ? 40 : 255} value={draft[field] ?? ''}
          onChange={(e) => set(field,e.target.value)} />
      </Field>)}
      <BaitlyCrmSelect label={t('baitlyCrm.category')} value={draft.category ?? 'OWNERS'}
        values={draft.contactType === 'OWNER' ? ['OWNERS'] : BAITLY_CRM_CATEGORIES.filter((c) => c !== 'OWNERS')}
        onChange={(v) => set('category',v)} />
      <BaitlyCrmSelect label={t('baitlyCrm.status')} value={draft.status ?? 'TO_CONTACT'} values={BAITLY_CRM_STATUSES} onChange={(v) => set('status',v)} />
      {(!contact || contact.sourceType === 'LEGACY') && <>
        <BaitlyCrmSelect label={t('baitlyCrm.source')} value={draft.sourceType ?? 'MANUAL'}
          values={['MANUAL','REFERRAL','PARTNER','OPEN_DATA']} onChange={(v) => set('sourceType',v)} />
        <Field className="sm:col-span-2"><FieldLabel htmlFor={id + 'source'}>{t('baitlyCrm.sourceDetail')}</FieldLabel>
          <Textarea id={id + 'source'} required maxLength={1000} value={draft.sourceDetail ?? ''} onChange={(e) => set('sourceDetail',e.target.value)} />
        </Field>
        <Field className="sm:col-span-2"><FieldLabel htmlFor={id + 'url'}>{t('baitlyCrm.sourceUrl')}</FieldLabel>
          <Input id={id + 'url'} type="url" maxLength={2000} value={draft.sourceUrl ?? ''} onChange={(e) => set('sourceUrl',e.target.value)} />
        </Field>
      </>}
      <Field className="sm:col-span-2"><FieldLabel htmlFor={id + 'notes'}>{t('baitlyCrm.notes')}</FieldLabel>
        <Textarea id={id + 'notes'} maxLength={10000} value={draft.notes ?? ''} onChange={(e) => set('notes',e.target.value)} />
      </Field>
    </fieldset>
    <p className="text-xs text-muted-foreground">{t('baitlyCrm.noAutomaticConsent')}</p>
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={save.isPending} className="cursor-pointer">
      {t(save.isPending ? 'common.saving' : 'common.save')}</Button>
      <Button type="button" variant="outline" disabled={save.isPending} onClick={()=>onDone()} className="cursor-pointer">{t('common.cancel')}</Button></div>
  </form>;
}

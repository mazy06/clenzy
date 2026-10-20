import React, { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, Badge, Button, Field, FieldLabel, Input, Textarea } from '../../components/ui';
import { prospectsApi, type BaitlyCrmAuthorizationCommand, type ProspectDto } from '../../services/api/prospectsApi';
import { useTranslation } from '../../hooks/useTranslation';
import { BaitlyCrmSelect, baitlyCrmError } from './BaitlyCrmFields';
import { baitlyCrmAuthorizationState } from './baitlyCrmAuthorizationState';

function localNow() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0,16);
}
export default function BaitlyCrmAuthorizations({ contact, org, canAuthorize }: { contact: ProspectDto; org: number; canAuthorize: boolean }) {
  const { t, currentLanguage } = useTranslation(); const id = useId(); const client = useQueryClient();
  const queryKey = ['prospects', org, contact.id, 'authorizations'];
  const history = useQuery({ queryKey, queryFn: () => prospectsApi.history(contact.id) });
  const [editing,setEditing] = useState(false);
  const [channel,setChannel] = useState('EMAIL'); const [basis,setBasis] = useState('CONSENT');
  const [decision,setDecision] = useState('GRANTED'); const [evidence,setEvidence] = useState('');
  const [date,setDate] = useState(localNow); const [expiry,setExpiry] = useState('');
  const purpose = contact.contactType === 'OWNER' ? 'MANAGEMENT' : 'PROVIDER_RECRUITMENT';
  const save = useMutation({
    mutationFn: () => prospectsApi.authorize(contact.id, { channel, purpose, basis, decision, evidence,
      occurredAt: new Date(date).toISOString(), expiresAt: expiry ? new Date(expiry).toISOString() : undefined } as BaitlyCrmAuthorizationCommand),
    onSuccess: async () => { await client.invalidateQueries({ queryKey }); setEvidence(''); setEditing(false); },
  });
  return <section className="space-y-4 border-t border-border pt-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{t('baitlyCrm.authorizations')}</h3>
      {canAuthorize && !editing && <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setEditing(true)}>{t('baitlyCrm.recordDecision')}</Button>}
    </div>
    <p className="text-xs text-muted-foreground">{t('baitlyCrm.authorizationHelp')}</p>
    {history.isError && <Alert variant="destructive"><AlertDescription>{t('baitlyCrm.historyError')}</AlertDescription></Alert>}
    {history.isPending ? <p className="text-sm" role="status">{t('common.loading')}</p> :
      <dl className="space-y-2">{['EMAIL','SMS','PHONE'].map((value) => <div key={value} className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <dt>{t('baitlyCrm.values.' + value)}</dt><dd><Badge variant="secondary">{t('baitlyCrm.values.' + baitlyCrmAuthorizationState(history.data ?? [],value,purpose))}</Badge></dd>
      </div>)}</dl>}
    {editing && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <fieldset disabled={save.isPending} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <BaitlyCrmSelect label={t('baitlyCrm.channel')} value={channel} values={['EMAIL','SMS','PHONE']} onChange={(v) => { setChannel(v); setBasis('CONSENT'); }} />
        <BaitlyCrmSelect label={t('baitlyCrm.decision')} value={decision} values={['GRANTED','REVOKED']} onChange={setDecision} />
        <BaitlyCrmSelect label={t('baitlyCrm.basis')} value={basis} values={contact.contactNature === 'PROFESSIONAL' && channel === 'EMAIL'
          ? ['CONSENT','REQUESTED_CONTACT','B2B_LEGITIMATE_INTEREST'] : ['CONSENT','REQUESTED_CONTACT']} onChange={setBasis} />
        <Field><FieldLabel htmlFor={id + 'date'}>{t('baitlyCrm.occurredAt')}</FieldLabel>
          <Input id={id + 'date'} type="datetime-local" required value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field><FieldLabel htmlFor={id + 'expiry'}>{t('baitlyCrm.expiresAt')}</FieldLabel>
          <Input id={id + 'expiry'} type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
        <Field className="sm:col-span-2"><FieldLabel htmlFor={id + 'proof'}>{t('baitlyCrm.evidence')}</FieldLabel>
          <Textarea id={id + 'proof'} required maxLength={4000} value={evidence} onChange={(e) => setEvidence(e.target.value)} /></Field>
      </fieldset>
      {save.isError && <Alert variant="destructive"><AlertDescription>{baitlyCrmError(save.error,t('baitlyCrm.saveError'))}</AlertDescription></Alert>}
      <div className="flex gap-2"><Button type="submit" disabled={save.isPending} className="cursor-pointer">{t('common.save')}</Button>
        <Button type="button" variant="outline" disabled={save.isPending} onClick={() => setEditing(false)} className="cursor-pointer">{t('common.cancel')}</Button></div>
    </form>}
    {!!history.data?.length && <details className="text-sm"><summary className="cursor-pointer rounded-sm py-2 focus-visible:outline focus-visible:outline-2">{t('baitlyCrm.history')}</summary>
      <ol className="divide-y divide-border">{history.data.map((entry) => <li key={entry.id} className="space-y-1 py-3">
        <p>{t('baitlyCrm.values.' + entry.channel)} · {t('baitlyCrm.values.' + entry.decision)} · {t('baitlyCrm.values.' + entry.basis)}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{new Date(entry.occurredAt).toLocaleString(currentLanguage)}</p>
        <p className="whitespace-pre-wrap break-words text-sm">{entry.evidence}</p>
        {!entry.currentIdentity && <p className="text-xs text-muted-foreground">{t('baitlyCrm.identityChanged')}</p>}
      </li>)}</ol>
    </details>}
  </section>;
}

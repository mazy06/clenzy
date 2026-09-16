import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Skeleton, Textarea } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import apiClient from '../../services/apiClient';

interface Evidence { id: number; name: string; type: string; status: string; expiresAt: string | null }
interface Review { id: number; country: string; professional_status: string; service_scope: string; valid_until: string; currently_valid: boolean; revoked_at: string | null; note: string }
interface Rule { country: string; professional_status: string; service_scope: string; required_types: string; regulated: boolean }
interface View { professionalStatus: string | null; baseCountry: string; serviceScopes: string[]; documents: Evidence[]; reviews: Review[]; rules: Rule[] }
export default function ProviderDocumentaryPanel({ providerId }: { providerId: number }) {
  const { user } = useAuth(); const { t } = useTranslation(); const client = useQueryClient();
  const path = `/admin/marketplace/documentary/${providerId}`;
  const key = ['provider-documentary', providerId, user?.id, user?.organizationId];
  const query = useQuery({ queryKey: key, queryFn: () => apiClient.get<View>(path), enabled: !!user, refetchInterval: 30_000 });
  const [country, setCountry] = useState(''); const [status, setStatus] = useState(''); const [scope, setScope] = useState('*');
  const [ids, setIds] = useState<number[]>([]); const [regulated, setRegulated] = useState(false); const [license, setLicense] = useState('');
  const [ruleConfirmed, setRuleConfirmed] = useState(false);
  const [until, setUntil] = useState(''); const [note, setNote] = useState(''); const [confirmed, setConfirmed] = useState(false);
  const submitting = useRef(false);
  const mutation = useMutation({ mutationFn: ({ url, body }: { url: string; body: object }) => url.endsWith('/rules') ? apiClient.put(url, body) : apiClient.post(url, body),
    onSettled: () => client.invalidateQueries({ queryKey: key }) });
  const data = query.isError ? undefined : query.data;
  const effectiveCountry = country || data?.baseCountry || ''; const effectiveStatus = status || data?.professionalStatus || '';
  const rule = data?.rules.find(r => r.country === effectiveCountry && r.professional_status === effectiveStatus && r.service_scope === scope);
  const send = async (reviewId?: number) => {
    if (submitting.current) return; submitting.current = true;
    try {
      await mutation.mutateAsync(reviewId ? { url: `${path}/reviews/${reviewId}/revoke`, body: { reason: note } } : {
        url: `${path}/reviews`, body: { country: effectiveCountry, professionalStatus: effectiveStatus, serviceScope: scope,
          documentIds: ids, regulated: regulated || !!rule?.regulated, licenseDocumentId: license ? Number(license) : null, validUntil: until, note, manualAssessment: confirmed } });
      setNote(''); setConfirmed(false);
    } catch { /* Erreur affichée ; garder les saisies pour correction. */ } finally { submitting.current = false; }
  };
  return <section className="flex flex-col gap-3 border-t border-border pt-3" aria-busy={mutation.isPending}>
    <h3 className="m-0 text-sm font-medium">{t('documentary.title')}</h3>
    <p className="m-0 text-sm text-muted-foreground">{t('documentary.explanation')}</p>
    {query.isPending ? <Skeleton className="h-24 w-full" /> : query.isError ? <p role="alert">{t('documentary.error')} <Button variant="ghost" onClick={() => void query.refetch()}>{t('financialCase.refresh')}</Button></p> : data && <>
      <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); void send(); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">{t('documentary.country')}<Input value={effectiveCountry} maxLength={2} required onChange={e => setCountry(e.target.value.toUpperCase())} /></label>
          <label className="flex flex-col gap-1 text-sm">{t('documentary.status')}
            <select required className="min-h-10 rounded-md border border-border bg-background p-2" value={effectiveStatus} onChange={e => setStatus(e.target.value)}>
              <option value="">{t('financialCase.select')}</option>{['SOLE_TRADER', 'COMPANY', 'EMPLOYEE', 'OTHER'].map(s => <option key={s} value={s}>{t(`documentary.statuses.${s}`)}</option>)}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">{t('documentary.scope')}
          <select className="min-h-10 rounded-md border border-border bg-background p-2" value={scope} onChange={e => setScope(e.target.value)}>
            {data.serviceScopes.map(s => <option key={s} value={s}>{s === '*' ? t('documentary.publication') : s.replace(/^(ITEM|CATEGORY|TYPE):/, '')}</option>)}
          </select>
        </label>
        <p className="m-0 text-sm">{rule ? `${t('documentary.required')}: ${rule.required_types || t('documentary.baseRequirements')}` : t('documentary.manualRequired')}</p>
        <fieldset className="flex flex-col gap-2 border-0 p-0"><legend className="mb-2 text-sm font-medium">{t('documentary.evidence')}</legend>
          {data.documents.length === 0 && <p className="m-0 text-sm">{t('documentary.noDocuments')}</p>}
          {data.documents.map(d => <label key={d.id} className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" disabled={d.status !== 'APPROVED' || mutation.isPending} checked={ids.includes(d.id)} onChange={e => setIds(old => e.target.checked ? [...old, d.id] : old.filter(id => id !== d.id))} />
            <span className="break-words">{d.name} · {d.type}{d.expiresAt && <span className="tabular-nums"> · {d.expiresAt}</span>}</span>
          </label>)}
        </fieldset>
        <label className="flex cursor-pointer gap-2 text-sm"><input type="checkbox" checked={regulated || !!rule?.regulated} disabled={!!rule?.regulated} onChange={e => setRegulated(e.target.checked)} />{t('documentary.regulated')}</label>
        {(regulated || rule?.regulated) && <label className="flex flex-col gap-1 text-sm">{t('documentary.license')}
          <select required className="min-h-10 rounded-md border border-border bg-background p-2" value={license} onChange={e => setLicense(e.target.value)}>
            <option value="">{t('financialCase.select')}</option>{data.documents.filter(d => ids.includes(d.id)).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>}
        <label className="flex flex-col gap-1 text-sm">{t('documentary.until')}<Input type="date" required value={until} onChange={e => setUntil(e.target.value)} className="tabular-nums" /></label>
        <label className="flex flex-col gap-1 text-sm">{t('documentary.note')}<Textarea required maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label>
        <label className="flex cursor-pointer gap-2 text-sm"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />{t('documentary.confirmation')}</label>
        <Button type="submit" disabled={mutation.isPending || !confirmed || !note.trim() || !ids.length}>{t('documentary.save')}</Button>
      </form>
      <details><summary className="cursor-pointer text-sm">{t('documentary.ruleTitle')}</summary>
        <p className="text-sm">{t('documentary.ruleExplanation')}</p>
        <label className="flex cursor-pointer gap-2 text-sm"><input type="checkbox" checked={ruleConfirmed} onChange={e => setRuleConfirmed(e.target.checked)} />{t('documentary.ruleConfirm')}</label>
        <Button variant="outline" disabled={mutation.isPending || !ruleConfirmed || !effectiveCountry || !effectiveStatus || !note.trim()} onClick={() => {
          if(submitting.current) return; submitting.current = true;
          void mutation.mutateAsync({ url: '/admin/marketplace/documentary/rules', body: { country: effectiveCountry, professionalStatus: effectiveStatus, serviceScope: scope,
            requiredTypes: [...new Set(data.documents.filter(d => ids.includes(d.id)).map(d => d.type))], regulated, reason: note } })
            .then(() => setRuleConfirmed(false)).catch(() => {}).finally(() => { submitting.current = false; });
        }}>{t('documentary.ruleSave')}</Button>
      </details>
      <div className="flex flex-col gap-2">{data.reviews.map(r => <div key={r.id} className="border-t border-border pt-2 text-sm">
        <p className="m-0">{r.country} · {r.service_scope === '*' ? t('documentary.publication') : r.service_scope} · <span className="tabular-nums">{r.valid_until}</span></p>
        <p className="m-0">{t(r.currently_valid && !r.revoked_at ? 'documentary.valid' : 'documentary.reviewRequired')}</p>
        <p className="whitespace-pre-wrap break-words">{r.note}</p>
        {!r.revoked_at && <Button variant="outline" disabled={mutation.isPending || !note.trim()} onClick={() => void send(r.id)}>{t('documentary.revoke')}</Button>}
      </div>)}</div>
    </>}
    {mutation.isError && <p role="alert">{t('documentary.error')}</p>}
  </section>;
}

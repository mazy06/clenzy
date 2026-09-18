import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { propertyTeamsApi, propertyTeamsKeys } from '../../services/api/propertyTeamsApi';
import ServiceItemSelect, { serviceReferenceQuery } from '../../components/ServiceItemSelect';
import { Button, Input, Skeleton } from '../../components/ui';

export default function PropertyServiceTeams({ propertyId }: { propertyId: number }) {
  const { hasRole } = useAuth();
  return hasRole('SUPER_ADMIN') ? <Editor propertyId={propertyId} /> : null;
}
function Editor({ propertyId }: { propertyId: number }) {
  const { t, isEnglish } = useTranslation();
  const client = useQueryClient();
  const [code, setCode] = useState('');
  const [teamId, setTeamId] = useState('');
  const [priority, setPriority] = useState(100);
  const mappings = useQuery({ queryKey: [...propertyTeamsKeys.byProperty(propertyId), 'all'], queryFn: () => propertyTeamsApi.getAssociations(propertyId) });
  const teams = useQuery({
    queryKey: [...propertyTeamsKeys.byProperty(propertyId), 'candidates', code],
    queryFn: () => propertyTeamsApi.getCandidates(propertyId, code),
    enabled: Boolean(code),
  });
  const catalog = useQuery(serviceReferenceQuery);
  const mutation = useMutation({
    mutationFn: async (removeId?: number) => {
      if (removeId == null) await propertyTeamsApi.assign(propertyId, Number(teamId), code, priority);
      else await propertyTeamsApi.removeAssociation(removeId);
    },
    onSuccess: () => { void client.invalidateQueries({ queryKey: propertyTeamsKeys.all }); },
  });
  const candidates = teams.data ?? [];
  return <section className="mb-6 flex flex-col gap-3 border-b border-border pb-4">
    <h2 className="text-sm font-semibold">{t('serviceReference.propertyTeams')}</h2>
    {mappings.isPending ? <Skeleton className="h-16 w-full" /> : mappings.isError
      ? <p role="alert">{t('serviceReference.loadError')}</p>
      : <ul className="divide-y divide-border">{mappings.data?.map(row => {
        const item = catalog.data?.find(item => item.code === row.serviceItemCode);
        return <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
          <span>{row.teamName} · {item ? (isEnglish ? item.labelEn : item.labelFr) : row.serviceItemCode || t('serviceReference.unqualified')}
            <span className="ms-2 tabular-nums text-muted-foreground">{row.priority}</span></span>
          <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={() => mutation.mutate(row.id)}>{t('serviceReference.remove')}</Button>
        </li>;
      })}</ul>}
    <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
      <ServiceItemSelect value={code} onChange={item => { setCode(item.code); setTeamId(''); }} />
      <label className="flex flex-col gap-1 text-sm">{t('serviceReference.team')}
        <select value={teamId} onChange={e => setTeamId(e.target.value)} disabled={teams.isPending || teams.isError}
          className="h-10 cursor-pointer rounded-md border border-border bg-background px-2 focus-visible:ring-2 focus-visible:ring-primary">
          <option value="">{t('serviceReference.chooseTeam')}</option>
          {candidates.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">{t('serviceReference.priority')}
        <Input type="number" min={0} value={priority} onChange={e => setPriority(Number(e.target.value))} className="tabular-nums" />
      </label>
    </div>
    <Button type="button" variant="outline" className="self-start" disabled={!code || !teamId || !Number.isInteger(priority) || priority < 0 || mutation.isPending || mappings.isError}
      onClick={() => mutation.mutate(undefined)}>{t('serviceReference.addAssociation')}</Button>
    {(mutation.isError || teams.isError) && <p role="alert" className="text-sm text-destructive-ink">{mutation.error?.message || t('serviceReference.loadError')}</p>}
  </section>;
}

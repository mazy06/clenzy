import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Label, Skeleton } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { serviceAssignmentsApi, type AssignmentPolicy } from '../../services/api/serviceAssignmentsApi';

export default function AssignmentPolicyForm() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['assignment-policy'], queryFn: serviceAssignmentsApi.policy });
  if (query.isPending) return <Skeleton className="h-64 w-full" />;
  if (query.isError) return <p role="alert">{t('assignmentFlow.loadFailed')}</p>;
  return <PolicyEditor initial={query.data} />;
}

function PolicyEditor({ initial }: { initial: AssignmentPolicy }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [policy, setPolicy] = useState(initial);
  const save = useMutation({ mutationFn: () => serviceAssignmentsApi.savePolicy(policy), onSuccess: value => cache.setQueryData(['assignment-policy'], value) });
  return <form className="max-w-3xl space-y-5 py-3" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
    <p className="text-sm text-muted-foreground">{t('assignmentFlow.policy.help')}</p>
    {(['enabled', 'publicSearch'] as const).map(key => <Label key={key} className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={policy[key]} onChange={event => setPolicy({ ...policy, [key]: event.target.checked })} />{t(`assignmentFlow.policy.${key}`)}
    </Label>)}
    <div className="grid gap-3 sm:grid-cols-3">
      <div><Label htmlFor="assignment-timezone">{t('assignmentFlow.policy.timezone')}</Label><Input id="assignment-timezone" required value={policy.timezone} onChange={event => setPolicy({ ...policy, timezone: event.target.value })} /></div>
      {(['contactFromHour', 'contactUntilHour'] as const).map(key => <div key={key}><Label htmlFor={`assignment-${key}`}>{t(`assignmentFlow.policy.${key}`)}</Label><Input id={`assignment-${key}`} type="number" required min={0} max={key === 'contactFromHour' ? 23 : 24} value={policy[key]} onChange={event => setPolicy({ ...policy, [key]: Number(event.target.value) })} /></div>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      {(Object.keys(policy.deadlines) as Array<keyof AssignmentPolicy['deadlines']>).map(key => <div key={key}>
        <Label htmlFor={`assignment-${key}`}>{t(`assignmentFlow.policy.${key}`)}</Label>
        <Input id={`assignment-${key}`} type="number" required min={key === 'preparationMinutes' ? 0 : 1} max={key === 'preparationMinutes' ? 1440 : 10080} value={policy.deadlines[key]} onChange={event => setPolicy({ ...policy, deadlines: { ...policy.deadlines, [key]: Number(event.target.value) } })} />
      </div>)}
    </div>
    <Button type="submit" disabled={save.isPending}>{t('assignmentFlow.policy.save')}</Button>
    {save.isSuccess && <p role="status">{t('assignmentFlow.policy.saved')}</p>}
    {save.isError && <p role="alert" className="text-sm text-destructive-ink">{t('assignmentFlow.replyFailed')}</p>}
  </form>;
}

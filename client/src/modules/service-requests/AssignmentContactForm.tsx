import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Label, Skeleton } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { serviceAssignmentsApi, type AssignmentContactPreferences } from '../../services/api/serviceAssignmentsApi';

export default function AssignmentContactForm() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['assignment-contacts'], queryFn: serviceAssignmentsApi.contacts });
  if (query.isPending) return <Skeleton className="h-36 w-full" />;
  if (query.isError) return <p role="alert">{t('assignmentFlow.loadFailed')}</p>;
  return <Editor initial={query.data} />;
}
function Editor({ initial }: { initial: AssignmentContactPreferences }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [value, setValue] = useState(initial);
  const save = useMutation({ mutationFn: () => serviceAssignmentsApi.saveContacts(value),
    onSuccess: async data => {
      cache.setQueryData(['assignment-contacts'], data);
      await cache.invalidateQueries({ queryKey: ['onboarding', 'me'] });
    } });
  return <form className="max-w-xl space-y-4 py-3" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
    <p className="text-sm text-muted-foreground">{t('assignmentFlow.contacts.help')}</p>
    <div className="grid grid-cols-2 gap-3">
      {(['fromHour', 'untilHour'] as const).map(key => <div key={key}>
        <Label htmlFor={`contact-${key}`}>{t(`assignmentFlow.contacts.${key}`)}</Label>
        <Input id={`contact-${key}`} type="number" required min={key === 'fromHour' ? 0 : value.fromHour + 1} max={key === 'fromHour' ? value.untilHour - 1 : 24} value={value[key]} onChange={event => setValue({ ...value, [key]: Number(event.target.value) })} />
      </div>)}
    </div>
    <Label className="flex cursor-pointer items-start gap-2">
      <input type="checkbox" checked={value.criticalOnCall} onChange={event => setValue({ ...value, criticalOnCall: event.target.checked })} />
      {t('assignmentFlow.contacts.criticalOnCall')}
    </Label>
    <Button type="submit" disabled={save.isPending}>{t('assignmentFlow.policy.save')}</Button>
    {save.isSuccess && <p role="status">{t('assignmentFlow.policy.saved')}</p>}
    {save.isError && <p role="alert" className="text-sm text-destructive-ink">{t('assignmentFlow.replyFailed')}</p>}
  </form>;
}

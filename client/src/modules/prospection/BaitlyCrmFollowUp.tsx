import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Popover, PopoverContent, PopoverTrigger } from '../../components/ui';
import { CalendarDays, Pencil } from '../../icons/glyphs';
import { useTranslation } from '../../hooks/useTranslation';
import { crmFollowUpMessages } from '../../i18n/baitlyCrmFollowUpMessages';
import { baitlyCrmDetailsApi, type BaitlyCrmDetails, type BaitlyCrmFollowUpWrite } from '../../services/api/baitlyCrmDetailsApi';
import type { BaitlyCrmContact } from './baitlyCrmWorkspace';
import './baitly-crm-follow-up.css';
type FollowUpContact = Pick<BaitlyCrmContact, 'id' | 'name' | 'archived' | 'crm'>;

export function crmLocalDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function crmFollowUpState(due?: string | null, today = crmLocalDay()) {
  return !due ? 'unplanned' : due < today ? 'overdue' : due === today ? 'today' : 'planned';
}
function formatDay(day: string, language: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' });
}
export function BaitlyCrmLastExchange({ details, caption = false }: { details?: BaitlyCrmDetails; caption?: boolean }) {
  const { currentLanguage } = useTranslation();
  const m = crmFollowUpMessages(currentLanguage);
  return <span className="bcrm-last-exchange">
    {caption && <span>{m.lastExchange}</span>}
    {details?.last_exchange_on ? <time dateTime={details.last_exchange_on}>{formatDay(details.last_exchange_on, currentLanguage)}</time> : <span>{m.noExchange}</span>}
  </span>;
}

/** Shared follow-up summary, using the workspace's details query rather than one request per card. */
export default function BaitlyCrmFollowUp({ contact, canManage, showLastExchange = true }: {
  contact: FollowUpContact; canManage: boolean; showLastExchange?: boolean;
}) {
  const { currentLanguage } = useTranslation();
  const m = crmFollowUpMessages(currentLanguage);
  const [open, setOpen] = useState(false);
  const details = contact.crm;
  const editable = canManage && !contact.archived;
  const state = crmFollowUpState(details?.next_action_on);
  const summary = <>
    {showLastExchange && <span className="bcrm-follow-up__caption">{m.nextAction}{editable && <Pencil size={12} aria-hidden />}</span>}
    <strong>{details?.next_action || (editable ? m.plan : m.noAction)}</strong>
    {details?.next_action_on && <span className="bcrm-follow-up__due" data-state={state}>
      <CalendarDays size={13} aria-hidden />
      {state === 'overdue' && <span>{m.overdue} · </span>}{state === 'today' && <span>{m.today} · </span>}
      <time dateTime={details.next_action_on}>{formatDay(details.next_action_on, currentLanguage)}</time>
    </span>}
  </>;
  return <div className="bcrm-follow-up">
    {showLastExchange && <BaitlyCrmLastExchange details={details} caption />}
    {editable ? <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><button type="button" className="bcrm-follow-up__action" title={details?.next_action || m.plan}
        aria-label={`${m.edit} : ${contact.name}`}>{summary}</button></PopoverTrigger>
      <PopoverContent className="bcrm-follow-up-editor" align="start" collisionPadding={12} aria-label={`${m.edit} : ${contact.name}`}>
        <FollowUpForm key={JSON.stringify(details)} contact={contact} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover> : <div className="bcrm-follow-up__action">{summary}</div>}
  </div>;
}
function FollowUpForm({ contact, onClose }: { contact: FollowUpContact; onClose: () => void }) {
  const { currentLanguage } = useTranslation();
  const m = crmFollowUpMessages(currentLanguage);
  const id = useId();
  const client = useQueryClient();
  const [lastExchange, setLastExchange] = useState(contact.crm?.last_exchange_on ?? '');
  const [action, setAction] = useState(contact.crm?.next_action ?? '');
  const [due, setDue] = useState(contact.crm?.next_action_on ?? '');
  const save = useMutation({ mutationFn: (value: BaitlyCrmFollowUpWrite) => baitlyCrmDetailsApi.saveFollowUp(contact.id, value),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['prospects'] }); onClose(); } });
  return <form onSubmit={event => {
    event.preventDefault();
    save.mutate({ lastExchangeOn: lastExchange || null, nextAction: action.trim() || null, nextActionOn: due || null });
  }}>
    <h3>{m.edit}</h3><p>{contact.name}</p>
    <fieldset disabled={save.isPending}>
      <label htmlFor={`${id}-last`}>{m.lastExchange}</label>
      <Input id={`${id}-last`} type="date" max={crmLocalDay()} value={lastExchange} onChange={event => setLastExchange(event.target.value)} />
      <Button type="button" size="sm" variant="link" onClick={() => setLastExchange(crmLocalDay())}>{m.exchangedToday}</Button>
      <label htmlFor={`${id}-action`}>{m.nextAction}</label>
      <Input id={`${id}-action`} maxLength={400} required={!!due} value={action} placeholder={m.actionPlaceholder} onChange={event => setAction(event.target.value)} />
      <label htmlFor={`${id}-due`}>{m.deadline}</label>
      <Input id={`${id}-due`} type="date" required={!!action.trim()} value={due} onChange={event => setDue(event.target.value)} />
      {(action || due) && <Button type="button" size="sm" variant="link" onClick={() => { setAction(''); setDue(''); }}>{m.clearAction}</Button>}
    </fieldset>
    {save.isError && <p role="alert">{m.error}</p>}
    <div className="bcrm-follow-up-editor__buttons"><Button type="button" variant="ghost" disabled={save.isPending} onClick={onClose}>{m.cancel}</Button><Button type="submit" disabled={save.isPending}>{m.save}</Button></div>
  </form>;
}

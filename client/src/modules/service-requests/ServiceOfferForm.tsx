import { useEffect, useId, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Input, Label, Textarea } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';

export interface ServiceOffer { amount: number; currency: string; validUntil: string; description: string }

export default function ServiceOfferForm({ submit, onSuccess, initialPrice, fixedPrice, onPendingChange }: { submit: (offer: ServiceOffer) => Promise<unknown>; onSuccess: () => void; initialPrice?: { amount: number; currency: string }; fixedPrice?: { amount: number; currency: string }; onPendingChange?: (pending: boolean) => void }) {
  const { t } = useTranslation();
  const id = useId();
  const [amount, setAmount] = useState(initialPrice ? String(initialPrice.amount) : '');
  const [currency, setCurrency] = useState(initialPrice?.currency ?? 'EUR');
  const [validUntil, setValidUntil] = useState('');
  const [description, setDescription] = useState('');
  const pending = useRef(false);
  const offer = useMutation({ mutationFn: () => submit({ amount: fixedPrice?.amount ?? Number(amount), currency: fixedPrice?.currency ?? currency, validUntil, description }), onSuccess,
    onSettled: () => { pending.current = false; } });
  useEffect(()=>{onPendingChange?.(offer.isPending);},[offer.isPending,onPendingChange]);
  useEffect(()=>()=>onPendingChange?.(false),[onPendingChange]);
  return <form className="grid gap-3 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); if (!pending.current) { pending.current = true; offer.mutate(); } }}>
    {!fixedPrice && <><div><Label htmlFor={`${id}-amount`}>{t('assignmentFlow.amount')}</Label><Input id={`${id}-amount`} type="number" min="0" max="1000000" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} /></div>
    <div><Label htmlFor={`${id}-currency`}>{t('assignmentFlow.currency')}</Label><Input id={`${id}-currency`} required pattern="[A-Z]{3}" maxLength={3} value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} /></div></>}
    <div><Label htmlFor={`${id}-valid`}>{t('assignmentFlow.validUntil')}</Label><Input id={`${id}-valid`} type="date" required value={validUntil} onChange={e => setValidUntil(e.target.value)} /></div>
    <div><Label htmlFor={`${id}-description`}>{t('assignmentFlow.message')}</Label><Textarea id={`${id}-description`} rows={3} maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} /></div>
    <Button type="submit" disabled={offer.isPending}>{t('assignmentFlow.sendQuote')}</Button>
    {offer.isError && <p role="alert" className="text-sm text-destructive-ink sm:col-span-2">{t('assignmentFlow.offerFailed')}</p>}
  </form>;
}

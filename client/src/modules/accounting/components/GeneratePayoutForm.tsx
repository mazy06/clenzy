import { useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calculator, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, Button, Field, FieldLabel, Input, NativeSelect, Skeleton, Spinner } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { useGeneratePayout } from '../../../hooks/useAccounting';
import { propertiesApi } from '../../../services/api/propertiesApi';
import type { OwnerPayout } from '../../../services/api/accountingApi';

interface Props {
  onClose: () => void;
  onGenerated: (payout: OwnerPayout) => void;
}

/** Le serveur calcule le net depuis les encaissements ; aucun montant n'est saisi. */
export default function GeneratePayoutForm({ onClose, onGenerated }: Props) {
  const { t } = useTranslation();
  const [ownerId, setOwnerId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const properties = useQuery({
    queryKey: ['properties', 'payout-owners'],
    queryFn: () => propertiesApi.getAll(),
    staleTime: 60_000,
  });
  // Un propriétaire sans ancien reversement doit aussi pouvoir être sélectionné.
  const owners = useMemo(() => {
    const names = new Map<number, string>();
    for (const property of properties.data ?? []) {
      if (property.ownerId) names.set(property.ownerId, property.ownerName || `#${property.ownerId}`);
    }
    return [...names].sort((a, b) => a[1].localeCompare(b[1]));
  }, [properties.data]);
  const generate = useGeneratePayout();
  const invalidRange = Boolean(from && to && from > to);
  const canSubmit = Boolean(ownerId && from && to && !invalidRange && !generate.isPending);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    try {
      const payout = await generate.mutateAsync({ ownerId: Number(ownerId), from, to });
      onGenerated(payout);
    } catch {
      // L'erreur métier reste visible et la saisie est conservée.
    }
  }

  return (
    <section aria-labelledby="payout-generate-title" className="mb-3 rounded-xl border border-border bg-card p-4">
      <h2 id="payout-generate-title" className="text-sm font-semibold">{t('accounting.generateFlow.title', 'Calculer un reversement')}</h2>
      <p className="mt-1 max-w-prose text-xs text-muted-foreground">
        {t('accounting.generateFlow.hint', 'Seuls les séjours terminés et encaissés par Baitly sont retenus. Le montant sera à vérifier puis à approuver avant tout transfert.')}
      </p>
      {properties.isPending ? <Skeleton className="mt-3 h-14 w-full" /> : properties.isError ? (
        <Alert variant="destructive" className="mt-3">
          <TriangleAlert />
          <AlertDescription>{t('accounting.generateFlow.loadError', 'Impossible de charger les propriétaires.')}</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => properties.refetch()}>{t('common.retry', 'Réessayer')}</Button>
        </Alert>
      ) : owners.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t('accounting.generateFlow.empty', 'Associez un propriétaire à un logement pour préparer son premier reversement.')}</p>
      ) : (
        <form onSubmit={submit} className="mt-3">
          <fieldset disabled={generate.isPending} className="grid gap-3 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="payout-generate-owner">{t('accounting.filterOwner', 'Propriétaire')}</FieldLabel>
              <NativeSelect id="payout-generate-owner" value={ownerId} onChange={e => setOwnerId(e.target.value)} required>
                <option value="">{t('accounting.generateFlow.chooseOwner', 'Choisir un propriétaire')}</option>
                {owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="payout-generate-from">{t('accounting.generateFlow.from', 'Début de période')}</FieldLabel>
              <Input id="payout-generate-from" type="date" value={from} onChange={e => setFrom(e.target.value)} required className="tabular-nums" />
            </Field>
            <Field>
              <FieldLabel htmlFor="payout-generate-to">{t('accounting.generateFlow.to', 'Fin de période')}</FieldLabel>
              <Input id="payout-generate-to" type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} required aria-invalid={invalidRange} aria-describedby={invalidRange ? 'payout-range-error' : undefined} className="tabular-nums" />
            </Field>
          </fieldset>
          {invalidRange && <p id="payout-range-error" role="alert" className="mt-2 text-xs text-destructive-ink">{t('accounting.generateFlow.invalidRange', 'La fin de période doit être égale ou postérieure au début.')}</p>}
          {generate.isError && (
            <Alert variant="destructive" className="mt-3">
              <TriangleAlert />
              <AlertDescription>{generate.error.message || t('accounting.generateFlow.error', 'Impossible de calculer ce reversement.')}</AlertDescription>
            </Alert>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={!canSubmit} aria-busy={generate.isPending}>
              {generate.isPending ? <Spinner aria-hidden="true" className="size-4" /> : <Calculator className="size-4" />}
              {t('accounting.generateFlow.calculate', 'Calculer le montant')}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={generate.isPending} onClick={onClose}>{t('common.cancel', 'Annuler')}</Button>
          </div>
        </form>
      )}
    </section>
  );
}

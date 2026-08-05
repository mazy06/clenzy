import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, Button } from '../../../components/ui';
import StatusChip from '../../../components/StatusChip';
import { TriangleAlert, CircleCheck } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import {
  Field,
  FieldLabel,
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupText,
} from '../../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  housekeeperRatesApi,
  type HousekeeperRates,
  type HousekeeperPropertyRate,
} from '../../../services/api/housekeeperRatesApi';

// ─── Tarifs & score d'un prestataire — vue staff plateforme (MM-4A #6) ───────
// Consomme GET/PUT /housekeeper-rates/user/{userId} (gardes backend :
// SUPER_ADMIN / SUPER_MANAGER). Score qualité 30 j + taux horaire + forfaits
// par logement avec le nudge fourchette conseil (jamais bloquant).

interface HousekeeperRatesDialogProps {
  userId: number | null;
  userName?: string;
  onClose: () => void;
}

/** Badge du nudge : « dans le marché » (fourchette conseil) ou écart % neutre. */
function RateNudge({ amount, rate }: { amount: number | null; rate: HousekeeperPropertyRate }) {
  const { t } = useTranslation();
  if (amount == null || amount <= 0) return null;
  const inMarket = amount >= rate.advisoryMin && amount <= rate.advisoryMax;
  const deltaPct = rate.advisoryRecommended > 0
    ? Math.round(((amount - rate.advisoryRecommended) / rate.advisoryRecommended) * 100)
    : 0;
  // Pastille de statut = primitive StatusChip, qui porte le couple `-ink`/`-soft`
  // conforme AA, plutot qu'un badge redessine a la main.
  return (
    <StatusChip
      tone={inMarket ? 'ok' : 'neutral'}
      size="sm"
      className="whitespace-nowrap tabular-nums"
      label={inMarket
        ? t('users.ratesDialog.inMarket', 'Dans le marché')
        : `${deltaPct > 0 ? '+' : ''}${deltaPct} %`}
    />
  );
}

export default function HousekeeperRatesDialog({ userId, userName, onClose }: HousekeeperRatesDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [hourly, setHourly] = useState('');
  const [flats, setFlats] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState(false);

  const ratesQuery = useQuery<HousekeeperRates>({
    queryKey: ['housekeeper-rates', 'user', userId],
    queryFn: () => housekeeperRatesApi.getForUser(userId as number),
    enabled: userId != null,
    staleTime: 0,
  });

  // Hydrate les champs quand les données arrivent (dialog ré-ouvrable).
  useEffect(() => {
    const data = ratesQuery.data;
    if (!data) return;
    setHourly(data.hourlyAmount != null ? String(data.hourlyAmount) : '');
    const next: Record<number, string> = {};
    for (const p of data.properties) {
      if (p.flatAmount != null) next[p.propertyId] = String(p.flatAmount);
    }
    setFlats(next);
    setSaved(false);
  }, [ratesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const flatRates = Object.entries(flats).flatMap(([propertyId, raw]) => {
        const amount = parseFloat(raw);
        return !isNaN(amount) && amount > 0 ? [{ propertyId: Number(propertyId), amount }] : [];
      });
      return housekeeperRatesApi.updateForUser(userId as number, {
        hourlyAmount: hourly.trim() !== '' && !isNaN(parseFloat(hourly)) ? parseFloat(hourly) : null,
        flatRates,
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['housekeeper-rates', 'user', userId], data);
      setSaved(true);
    },
  });

  const data = ratesQuery.data;
  const score = data?.score;

  return (
    <Dialog open={userId != null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('users.ratesDialog.title', 'Tarifs & score')}
            {userName ? ` — ${userName}` : ''}
          </DialogTitle>
        </DialogHeader>
        {/* Les filets haut/bas remplacent le `dividers` de l'ancienne modale. */}
        <div className="border-y border-solid border-border py-3">
        {ratesQuery.isPending && (
          <div className="flex justify-center py-6">
            <Spinner className="size-[26px]" />
          </div>
        )}
        {ratesQuery.isError && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{t('users.ratesDialog.loadError', 'Impossible de charger les tarifs de ce prestataire.')}</AlertDescription>
          </Alert>
        )}
        {data && (
          <div className="flex flex-col gap-3.5">
            {/* ── Score qualité 30 j ── */}
            {score != null && (
              <div>
                <p className="m-0 mb-1 text-2xs font-bold uppercase tracking-[.06em] text-faint">
                  {t('settings.myRates.scoreSection', 'Score qualité (30 jours)')}
                </p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="m-0 font-[family-name:var(--font-display)] text-[24px] font-semibold text-primary tabular-nums">
                    {score.score}
                    <span className="text-[13px] text-muted-foreground font-medium">/100</span>
                  </p>
                  <p className="m-0 text-[12px] text-muted-foreground tabular-nums">
                    {t('settings.myRates.scoreDetail', {
                      count: score.completedCount,
                      proof: Math.round(score.proofRate * 100),
                    })}
                  </p>
                </div>
              </div>
            )}

            {/* ── Taux horaire ── */}
            <div>
              <p className="m-0 mb-1 text-2xs font-bold uppercase tracking-[.06em] text-faint">
                {t('settings.myRates.hourlySection', 'Taux horaire')}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <Field className="w-[200px]">
                  <FieldLabel htmlFor="housekeeper-rates-hourly">
                    {t('settings.myRates.hourlyRate', 'Taux horaire')}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="housekeeper-rates-hourly"
                      type="number"
                      min={0}
                      step={0.5}
                      className="tabular-nums"
                      value={hourly}
                      onChange={(e) => setHourly(e.target.value)}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>€/h</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
                <p className="m-0 text-[12px] text-muted-foreground tabular-nums">
                  {t('settings.myRates.referenceRate', 'Taux de référence plateforme')} : {data.referenceHourlyRate} €/h
                </p>
              </div>
            </div>

            {/* ── Forfaits par logement + nudge ── */}
            <div>
              <p className="m-0 mb-1 text-2xs font-bold uppercase tracking-[.06em] text-faint">
                {t('settings.myRates.flatSection', 'Forfaits par logement')}
              </p>
              {data.properties.length === 0 ? (
                <p className="m-0 text-[12.5px] text-muted-foreground italic">
                  {t('settings.myRates.noProperties', 'Aucun logement accessible.')}
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data.properties.map((property) => {
                    const raw = flats[property.propertyId] ?? '';
                    const amount = raw.trim() !== '' && !isNaN(parseFloat(raw)) ? parseFloat(raw) : null;
                    return (
                      <div className="flex items-center gap-2 flex-wrap" key={property.propertyId}>
                        <p className="m-0 flex-1 min-w-[140px] text-[13px] font-semibold text-foreground">
                          {property.propertyName}
                        </p>
                        {/* Champ sans libelle visible (le nom du logement est a
                            gauche) : l'aria-label reste la seule etiquette. */}
                        <InputGroup className="w-[130px]">
                          <InputGroupInput
                            id={`housekeeper-rates-flat-${property.propertyId}`}
                            type="number"
                            min={0}
                            step={1}
                            className="tabular-nums"
                            aria-label={t('settings.myRates.flatFieldAria', { name: property.propertyName })}
                            value={raw}
                            placeholder={String(property.advisoryRecommended)}
                            onChange={(e) => setFlats((prev) => ({ ...prev, [property.propertyId]: e.target.value }))}
                          />
                          <InputGroupAddon align="inline-end">
                            <InputGroupText>€</InputGroupText>
                          </InputGroupAddon>
                        </InputGroup>
                        <p className="m-0 text-[11.5px] text-muted-foreground tabular-nums whitespace-nowrap">
                          {property.advisoryMin}–{property.advisoryMax} €
                        </p>
                        <RateNudge amount={amount} rate={property} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {saveMutation.isError && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertDescription>{t('users.ratesDialog.saveError', 'Enregistrement impossible.')}</AlertDescription>
              </Alert>
            )}
            {saved && !saveMutation.isPending && (
              <Alert variant="success">
                <CircleCheck />
                <AlertDescription>{t('users.ratesDialog.saved', 'Tarifs enregistrés.')}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="ghost">{t('common.close', 'Fermer')}</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={ratesQuery.isPending || saveMutation.isPending || data == null}
          >
            {t('common.save', 'Enregistrer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

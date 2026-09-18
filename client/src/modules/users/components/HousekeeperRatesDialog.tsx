import type { PublishedPricingModel } from '../../../services/api/housekeeperRatesApi';
import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, Button } from '../../../components/ui';
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
} from '../../../services/api/housekeeperRatesApi';

// ─── Tarifs & score d'un prestataire — vue staff plateforme (MM-4A #6) ───────
// Consomme GET/PUT /housekeeper-rates/user/{userId} (gardes backend :
// SUPER_ADMIN / SUPER_MANAGER). Score qualité et tarif horaire global.

interface HousekeeperRatesDialogProps {
  userId: number | null;
  userName?: string;
  onClose: () => void;
}


export default function HousekeeperRatesDialog({ userId, userName, onClose }: HousekeeperRatesDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [hourly, setHourly] = useState('');
  const [unitLabel, setUnitLabel] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [pricingModel, setPricingModel] = useState<PublishedPricingModel>('HOURLY');
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
    setHourly((data.amount ?? data.hourlyAmount) != null ? String(data.amount ?? data.hourlyAmount) : '');
    setPricingModel(data.pricingModel && data.pricingModel !== 'ON_QUOTE' ? data.pricingModel : 'HOURLY');
    setUnitLabel(data.unitLabel ?? '');
    setCurrency(data.currency ?? 'EUR');
    setSaved(false);
  }, [ratesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      return housekeeperRatesApi.updateForUser(userId as number, {
        hourlyAmount: hourly.trim() !== '' && !isNaN(parseFloat(hourly)) ? parseFloat(hourly) : null,
        flatRates: [],
        currency, pricingModel, ...(pricingModel === 'PER_UNIT' ? { unitLabel } : {}),
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

                </div>
              </div>
            )}

            {/* ── Taux horaire ── */}
            <div>
              <p className="m-0 mb-1 text-2xs font-bold uppercase tracking-[.06em] text-faint">
                {t('providerTariff.title')}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <Field className="w-[200px]">
                  <FieldLabel htmlFor="housekeeper-rates-hourly">
                    {t('providerTariff.amount')}
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
                      <InputGroupText>{currency}{pricingModel === 'HOURLY' ? '/h' : pricingModel === 'PER_SQM' ? '/m²' : ''}</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
          <Field className="w-[160px]">
            <FieldLabel htmlFor="tariff-model-staff">{t('providerTariff.model')}</FieldLabel>
            <select id="tariff-model-staff" className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              value={pricingModel} onChange={(event) => setPricingModel(event.target.value as PublishedPricingModel)}>
              <option value="HOURLY">{t('providerTariff.hourly')}</option>
              <option value="FLAT">{t('providerTariff.flat')}</option>
              <option value="PER_UNIT">{t('providerTariff.perUnit')}</option>
              <option value="PER_SQM">{t('providerTariff.perSqm')}</option>
            </select>
          </Field>
          {pricingModel === 'PER_UNIT' && <Field className="w-[160px]">
            <FieldLabel htmlFor="tariff-unit-staff">{t('providerTariff.unit')}</FieldLabel>
            <InputGroup><InputGroupInput id="tariff-unit-staff" value={unitLabel} maxLength={40}
              onChange={(event) => setUnitLabel(event.target.value)} /></InputGroup>
          </Field>}
          <Field className="w-[110px]">
            <FieldLabel htmlFor="tariff-currency-staff">{t('providerTariff.currency')}</FieldLabel>
            <InputGroup>
              <InputGroupInput id="tariff-currency-staff" value={currency} maxLength={3}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
            </InputGroup>
          </Field>
                <p className="m-0 text-[12px] text-muted-foreground tabular-nums">
                  {t('settings.myRates.referenceRate', 'Taux de référence plateforme')} : {data.referenceHourlyRate} €/h
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{t('providerTariff.shared')}</p>
            {data.needsReview && <p className="text-xs text-muted-foreground">{t('providerTariff.review')}</p>}

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

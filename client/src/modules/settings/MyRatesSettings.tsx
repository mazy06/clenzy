import type { PublishedPricingModel } from '../../services/api/housekeeperRatesApi';
import React, { useEffect, useRef, useState } from 'react';
import { Alert as UiAlert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card, Button, Skeleton } from '../../components/ui';
import {
  Field,
  FieldLabel,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '../../components/ui';
import StatTile from '../../components/baitly/StatTile';
import { Save, CheckCircle } from '../../icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotification } from '../../hooks/useNotification';
import { useTranslation } from '../../hooks/useTranslation';
import { housekeeperRatesApi } from '../../services/api/housekeeperRatesApi';
import type { HousekeeperRates } from '../../services/api/housekeeperRatesApi';

// ─── « Mes tarifs » (Moteur Ménage 2A) — HOUSEKEEPER / TECHNICIAN ────────────
// Tarif horaire unique pour toutes les conciergeries.
// Le formulaire modifie le tarif global, sans variante propre à un client.

const ratesKeys = { my: ['housekeeper-rates', 'me'] as const };

/** Surtitre de section (registre « overline » du contrat Baitly UI §3). */
const SECTION_TITLE_CLASS = 'text-2xs font-semibold uppercase tracking-[0.06em] text-faint mb-[9px]';

export default function MyRatesSettings() {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const queryClient = useQueryClient();

  const ratesQuery = useQuery({
    queryKey: ratesKeys.my,
    queryFn: () => housekeeperRatesApi.getMy(),
    staleTime: 30_000,
  });

  // ── État éditable local (hydraté depuis la query) ──
  const [hourly, setHourly] = useState<string>('');
  const [unitLabel, setUnitLabel] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [pricingModel, setPricingModel] = useState<PublishedPricingModel>('HOURLY');
  // Gate d'hydratation one-shot (jamais lu au render) : ref, pas de re-render.
  const hydratedRef = useRef(false);

  useEffect(() => {
    const data = ratesQuery.data;
    if (!data || hydratedRef.current) return;
    setHourly((data.amount ?? data.hourlyAmount) != null ? String(data.amount ?? data.hourlyAmount) : '');
    setPricingModel(data.pricingModel && data.pricingModel !== 'ON_QUOTE' ? data.pricingModel : 'HOURLY');
    setUnitLabel(data.unitLabel ?? '');
    setCurrency(data.currency ?? 'EUR');
    hydratedRef.current = true;
  }, [ratesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: Parameters<typeof housekeeperRatesApi.updateMy>[0]) =>
      housekeeperRatesApi.updateMy(payload),
    onSuccess: (updated: HousekeeperRates) => {
      queryClient.setQueryData(ratesKeys.my, updated);
      notify.success(t('settings.myRates.saveSuccess'));
    },
    onError: () => {
      notify.error(t('settings.myRates.saveError'));
    },
  });

  const handleSave = () => {
    const hourlyAmount = hourly.trim() !== '' && !isNaN(parseFloat(hourly)) ? parseFloat(hourly) : null;
    saveMutation.mutate({ hourlyAmount, flatRates: [], currency, pricingModel, ...(pricingModel === 'PER_UNIT' ? { unitLabel } : {}) });
  };

  const score = ratesQuery.data?.score;

  if (ratesQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[120px] w-full rounded-[13px]" />
        <Skeleton className="h-[260px] w-full rounded-[13px]" />
      </div>
    );
  }

  if (ratesQuery.isError) {
    return <UiAlert variant="destructive">
      <TriangleAlert />
      <AlertDescription>{t('settings.myRates.loadError')}</AlertDescription>
    </UiAlert>;
  }

  // `pb-12` : l'onglet de l'assistant Baitly est fixe en bas a droite sur
  // 44 px de haut. Sans cette reserve, « Enregistrer mes tarifs » — dernier
  // element, aligne a droite — finit dessous, incliquable.
  return (
    <div className="flex flex-col gap-3 pb-12">
      {/* ── Score qualité 30 jours (MM-3D) ───────────────────────────────── */}
      {/* Le bloc « libellé + grosse valeur » ecrit a la main est desormais le
          primitive StatTile : meme information, sans la hero-metric maison. */}
      {score != null && (
        <StatTile
          icon={<CheckCircle strokeWidth={1.75} />}
          label={t('settings.myRates.scoreSection')}
          value={score.score}
          unit="/100"
          iconClassName="text-success"
          hint={
            <>
              <span className="tabular-nums">
                {t('settings.myRates.scoreDetail', {
                  count: score.completedCount,
                  proof: Math.round(score.proofRate * 100),
                })}
              </span>
              {' · '}
              {t('settings.myRates.scoreHint')}
            </>
          }
        />
      )}

      {/* ── Taux horaire général ─────────────────────────────────────────── */}
      <Card className="gap-0 py-0 p-3.5">
        <p className={SECTION_TITLE_CLASS}>{t('providerTariff.title')}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <Field className="w-[220px]">
            <FieldLabel htmlFor="my-rates-hourly">{t('providerTariff.amount')}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="my-rates-hourly"
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
            <FieldLabel htmlFor="tariff-model-mine">{t('providerTariff.model')}</FieldLabel>
            <select id="tariff-model-mine" className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              value={pricingModel} onChange={(event) => setPricingModel(event.target.value as PublishedPricingModel)}>
              <option value="HOURLY">{t('providerTariff.hourly')}</option>
              <option value="FLAT">{t('providerTariff.flat')}</option>
              <option value="PER_UNIT">{t('providerTariff.perUnit')}</option>
              <option value="PER_SQM">{t('providerTariff.perSqm')}</option>
            </select>
          </Field>
          {pricingModel === 'PER_UNIT' && <Field className="w-[160px]">
            <FieldLabel htmlFor="tariff-unit-mine">{t('providerTariff.unit')}</FieldLabel>
            <InputGroup><InputGroupInput id="tariff-unit-mine" value={unitLabel} maxLength={40}
              onChange={(event) => setUnitLabel(event.target.value)} /></InputGroup>
          </Field>}
          <Field className="w-[110px]">
            <FieldLabel htmlFor="tariff-currency-mine">{t('providerTariff.currency')}</FieldLabel>
            <InputGroup>
              <InputGroupInput id="tariff-currency-mine" value={currency} maxLength={3}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
            </InputGroup>
          </Field>

        </div>
        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
          {t('providerTariff.shared')}
          {ratesQuery.data?.needsReview && <span className="block">{t('providerTariff.review')}</span>}
        </p>
      </Card>

      {/* ── Enregistrer ──────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Spinner className="size-4" /> : <Save size={16} strokeWidth={1.75} />}
          {t('settings.myRates.save')}
        </Button>
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert as UiAlert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Badge, Card, Button, Skeleton } from '../../components/ui';
import {
  Field,
  FieldLabel,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
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
import type { HousekeeperRates, HousekeeperPropertyRate } from '../../services/api/housekeeperRatesApi';

// ─── « Mes tarifs » (Moteur Ménage 2A) — HOUSEKEEPER / TECHNICIAN ────────────
// Taux horaire général + forfait optionnel par logement (le forfait PRIME).
// Nudge à la saisie : fourchette conseil du logement (ancre = MÉDIANE), badge
// « dans le marché » si dedans, sinon écart % NEUTRE — jamais de blocage.

const ratesKeys = { my: ['housekeeper-rates', 'me'] as const };

/** Surtitre de section (registre « overline » du contrat Baitly UI §3). */
const SECTION_TITLE_CLASS = 'text-2xs font-semibold uppercase tracking-[0.06em] text-faint mb-[9px]';

/** Chip d'état du nudge — vert doux si dans la fourchette, neutre sinon. */
function NudgeBadge({ amount, rate }: { amount: number | null; rate: HousekeeperPropertyRate }) {
  const { t } = useTranslation();
  if (amount == null || amount <= 0) return null;

  const inMarket = amount >= rate.advisoryMin && amount <= rate.advisoryMax;
  if (inMarket) {
    return (
      <Badge variant="success" className="font-semibold">
        <CheckCircle size={11} strokeWidth={2} />
        {t('settings.myRates.inMarket')}
      </Badge>
    );
  }

  const deltaPct = Math.round(((amount - rate.advisoryRecommended) / rate.advisoryRecommended) * 100);
  return (
    <Badge variant="outline" className="border-field-line bg-field font-semibold tabular-nums text-muted-foreground">
      {deltaPct > 0 ? '+' : ''}{deltaPct} % {t('settings.myRates.vsAdvisory')}
    </Badge>
  );
}

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
  const [flats, setFlats] = useState<Record<number, string>>({});
  // Gate d'hydratation one-shot (jamais lu au render) : ref, pas de re-render.
  const hydratedRef = useRef(false);

  useEffect(() => {
    const data = ratesQuery.data;
    if (!data || hydratedRef.current) return;
    setHourly(data.hourlyAmount != null ? String(data.hourlyAmount) : '');
    const map: Record<number, string> = {};
    for (const p of data.properties) {
      if (p.flatAmount != null) map[p.propertyId] = String(p.flatAmount);
    }
    setFlats(map);
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
    const flatRates = Object.entries(flats).flatMap(([propertyId, value]) => {
      const amount = parseFloat(value);
      return !isNaN(amount) && amount > 0 ? [{ propertyId: Number(propertyId), amount }] : [];
    });
    saveMutation.mutate({ hourlyAmount, flatRates });
  };

  const referenceRate = ratesQuery.data?.referenceHourlyRate;
  const score = ratesQuery.data?.score;
  const properties = useMemo(() => ratesQuery.data?.properties ?? [], [ratesQuery.data]);

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
        <p className={SECTION_TITLE_CLASS}>{t('settings.myRates.hourlySection')}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <Field className="w-[220px]">
            <FieldLabel htmlFor="my-rates-hourly">{t('settings.myRates.hourlyRate')}</FieldLabel>
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
                <InputGroupText>€/h</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          {referenceRate != null && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('settings.myRates.referenceRate')} : {referenceRate} €/h
            </p>
          )}
        </div>
        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
          {t('settings.myRates.hourlyHint')}
        </p>
      </Card>

      {/* ── Forfaits par logement ────────────────────────────────────────── */}
      <Card className="gap-0 py-0 p-3.5">
        <p className={SECTION_TITLE_CLASS}>{t('settings.myRates.flatSection')}</p>
        <p className="mb-3 text-[11.5px] text-muted-foreground">
          {t('settings.myRates.flatHint')}
        </p>

        {properties.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">
            {t('settings.myRates.noProperties')}
          </p>
        ) : (
          <div className="flex flex-col">
            {properties.map((property) => {
              const raw = flats[property.propertyId] ?? '';
              const amount = raw.trim() !== '' && !isNaN(parseFloat(raw)) ? parseFloat(raw) : null;
              return (
                <Item
                  key={property.propertyId}
                  size="sm"
                  className="px-0 border-t border-solid border-t-border first:border-t-0"
                >
                  <ItemContent>
                    <ItemTitle>{property.propertyName}</ItemTitle>
                    {/* Nudge : fourchette conseil, ancre mediane. Elle se lit
                        SOUS le nom du logement qu'elle concerne — alignee a
                        droite, elle formait une colonne de texte en drapeau. */}
                    <ItemDescription className="tabular-nums">
                      {t('settings.myRates.advisoryLine', {
                        min: property.advisoryMin,
                        max: property.advisoryMax,
                      })}{' '}
                      · {t('settings.myRates.advisoryMedian')} <b>{property.advisoryRecommended} €</b>
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <NudgeBadge amount={amount} rate={property} />
                    {/* Champ sans libelle visible (le nom du logement est a
                        gauche) : l'aria-label reste la seule etiquette. */}
                    <InputGroup className="w-[130px]">
                      <InputGroupInput
                        id={`my-rates-flat-${property.propertyId}`}
                        type="number"
                        min={0}
                        step={5}
                        className="tabular-nums"
                        aria-label={t('settings.myRates.flatFieldAria', { name: property.propertyName })}
                        placeholder={String(property.advisoryRecommended)}
                        value={raw}
                        onChange={(e) => setFlats((prev) => ({ ...prev, [property.propertyId]: e.target.value }))}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>€</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </ItemActions>
                </Item>
              );
            })}
          </div>
        )}
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

import React, { useEffect, useState } from 'react';
import { Badge, Button, Card, Field, FieldDescription, FieldError, FieldLabel, Input, NativeSelect, NativeSelectOption, Progress, Spinner, Switch } from '../../components/ui';
import { Download, GppGood } from '../../icons';
import { complianceConnectionApi } from '../../services/api/complianceConnectionApi';
import { useTranslation } from '../../hooks/useTranslation';
import {
  frRegulatoryApi,
  type FrRegulatoryProfile,
  type FrRentalUse,
  type RegistrationVerdict,
} from '../../services/api/frRegulatoryApi';

interface Props {
  propertyId: number;
  canEdit: boolean;
  /** Incrémenté par le parent quand une licence change : le statut du numéro se recharge. */
  refreshKey: number;
}

const USE_KEYS: Record<FrRentalUse, [string, string]> = {
  RESIDENCE_PRINCIPALE: ['properties.frProfile.uses.principal', 'Résidence principale'],
  RESIDENCE_SECONDAIRE: ['properties.frProfile.uses.secondary', 'Résidence secondaire'],
  MEUBLE_DEDIE: ['properties.frProfile.uses.dedicated', 'Meublé de tourisme dédié'],
  CHAMBRE_HOTES: ['properties.frProfile.uses.guestHouse', 'Chambre d’hôtes'],
};

const VERDICT_BADGE: Record<RegistrationVerdict, { key: string; fallback: string; variant: 'secondary' | 'destructive' | 'outline' }> = {
  VALID: { key: 'properties.frProfile.registration.valid', fallback: 'Conforme', variant: 'secondary' },
  ABSENT: { key: 'properties.frProfile.registration.absent', fallback: 'Manquant', variant: 'destructive' },
  MALFORMED: { key: 'properties.frProfile.registration.malformed', fallback: 'À corriger', variant: 'destructive' },
  COMMUNE_MISMATCH: { key: 'properties.frProfile.registration.mismatch', fallback: 'Autre commune', variant: 'destructive' },
  UNCHECKED: { key: 'properties.frProfile.registration.unchecked', fallback: 'Non vérifié', variant: 'outline' },
};

interface Form {
  rentalUse: FrRentalUse | '';
  maxNightsPerYear: string;
  policeFormEnabled: boolean;
}

function toForm(p: FrRegulatoryProfile): Form {
  return {
    rentalUse: p.rentalUse ?? '',
    maxNightsPerYear: String(p.maxNightsPerYear),
    policeFormEnabled: p.policeFormEnabled,
  };
}

/**
 * Fiche logement > Conformité — profil réglementaire France : l'usage du logement
 * décide des obligations (plafond de nuitées d'une résidence principale, numéro
 * d'enregistrement, fiche de police). Masquée pour un logement hors France.
 */
export default function FrRegulatoryProfileCard({ propertyId, canEdit, refreshKey }: Props) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<FrRegulatoryProfile | null | undefined>(undefined);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registerBusy, setRegisterBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    frRegulatoryApi.get(propertyId)
      .then((p) => { if (alive) { setProfile(p); setForm(toForm(p)); } })
      .catch(() => { if (alive) setProfile(null); });
    return () => { alive = false; };
  }, [propertyId, refreshKey]);

  if (profile === undefined) {
    return (
      <div className="flex justify-center py-6">
        <Spinner className="size-6" />
      </div>
    );
  }
  if (profile === null || profile.countryCode?.toUpperCase() !== 'FR' || !form) {
    return null;
  }

  const principal = form.rentalUse === 'RESIDENCE_PRINCIPALE';
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(profile));
  const verdict = VERDICT_BADGE[profile.registrationVerdict];
  const year = new Date().getFullYear();
  const usedPct = profile.maxNightsPerYear > 0
    ? Math.min(100, Math.round((profile.nightsRentedThisYear / profile.maxNightsPerYear) * 100))
    : 0;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const max = Number.parseInt(form.maxNightsPerYear, 10);
      const next = await frRegulatoryApi.update(propertyId, {
        rentalUse: form.rentalUse || null,
        maxNightsPerYear: principal && Number.isFinite(max) ? max : null,
        policeFormEnabled: form.policeFormEnabled,
      });
      setProfile(next);
      setForm(toForm(next));
    } catch (e) {
      setError((e as { message?: string })?.message ?? t('common.error', 'Erreur'));
    } finally {
      setSaving(false);
    }
  };

  // Registre des six derniers mois : la période de conservation légale (CESEDA R814-3).
  const downloadRegister = async () => {
    setRegisterBusy(true);
    setError(null);
    try {
      const to = new Date();
      const from = new Date(to);
      from.setMonth(from.getMonth() - 6);
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      await complianceConnectionApi.downloadPoliceRegister(propertyId, iso(from), iso(to));
    } catch (e) {
      setError((e as { message?: string })?.message ?? t('common.error', 'Erreur'));
    } finally {
      setRegisterBusy(false);
    }
  };

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <GppGood size={18} strokeWidth={1.75} className="text-muted-foreground" />
        <h3 className="m-0 text-sm font-semibold tracking-tight text-foreground">
          {t('properties.frProfile.title', 'Profil réglementaire France')}
        </h3>
      </div>

      {/* Numéro d'enregistrement : la donnée la plus exposée (affichée sur les annonces). */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {t('properties.frProfile.registration.label', 'N° d’enregistrement')}
        </span>
        <span className="text-sm font-medium tabular-nums text-foreground">
          {profile.registrationNumber ?? '—'}
        </span>
        {profile.registrationRequired && (
          <Badge variant={verdict.variant}>{t(verdict.key, verdict.fallback)}</Badge>
        )}
        {profile.registrationRequired && profile.registrationVerdict !== 'VALID' && (
          <span className="basis-full text-xs text-muted-foreground">
            {t('properties.frProfile.registration.hint',
              'Obligatoire sur toute annonce : ajoutez-le ci-dessous comme « Enregistrement touristique ».')}
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="fr-rental-use">{t('properties.frProfile.use', 'Usage du logement')}</FieldLabel>
          <NativeSelect
            id="fr-rental-use"
            value={form.rentalUse}
            disabled={!canEdit}
            onChange={(e) => set('rentalUse', e.target.value as FrRentalUse | '')}
          >
            <NativeSelectOption value="">{t('properties.frProfile.useUnset', 'Non renseigné')}</NativeSelectOption>
            {(Object.keys(USE_KEYS) as FrRentalUse[]).map((use) => (
              <NativeSelectOption key={use} value={use}>{t(USE_KEYS[use][0], USE_KEYS[use][1])}</NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel>{t('properties.frProfile.insee', 'Commune (code INSEE)')}</FieldLabel>
          <p className="m-0 text-sm font-medium tabular-nums text-foreground">
            {profile.communeInseeCode ?? '—'}
          </p>
          <FieldDescription>
            {profile.communeInseeCode
              ? t('properties.frProfile.inseeDeduced', 'Déduite de l’adresse du logement (Base Adresse Nationale).')
              : t('properties.frProfile.inseeUnresolved', 'Commune introuvable : vérifiez l’adresse, le code postal et la ville du logement.')}
          </FieldDescription>
        </Field>
        {principal && (
          <Field>
            <FieldLabel htmlFor="fr-max-nights">{t('properties.frProfile.maxNights', 'Plafond annuel (nuits)')}</FieldLabel>
            <Input
              id="fr-max-nights"
              type="number"
              min={1}
              max={120}
              value={form.maxNightsPerYear}
              disabled={!canEdit}
              onChange={(e) => set('maxNightsPerYear', e.target.value)}
            />
            <FieldDescription>
              {t('properties.frProfile.maxNightsHint', '120 nuits au plus ; votre commune peut l’abaisser jusqu’à 90.')}
            </FieldDescription>
          </Field>
        )}
        <Field orientation="horizontal" className="items-center">
          <Switch
            id="fr-police-form"
            checked={form.policeFormEnabled}
            disabled={!canEdit}
            onCheckedChange={(v) => set('policeFormEnabled', v)}
          />
          <FieldLabel htmlFor="fr-police-form">
            {t('properties.frProfile.policeForm', 'Fiche de police des voyageurs étrangers')}
          </FieldLabel>
        </Field>
      </div>

      {profile.nightsCapEnabled && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              {t('properties.frProfile.nightsUsed', 'Nuits louées en {{year}}', { year })}
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {profile.nightsRentedThisYear} / {profile.maxNightsPerYear}
              {' · '}
              {t('properties.frProfile.nightsLeft', '{{count}} restantes', { count: profile.nightsRemainingThisYear })}
            </span>
          </div>
          <Progress value={usedPct} aria-label={t('properties.frProfile.nightsUsed', 'Nuits louées en {{year}}', { year })} />
        </div>
      )}

      {error && <FieldError className="mt-3">{error}</FieldError>}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {profile.policeFormEnabled && (
          <Button size="sm" variant="outline" onClick={downloadRegister} disabled={registerBusy}>
            {registerBusy ? <Spinner className="size-3.5" /> : <Download size={15} />}
            {t('properties.frProfile.policeRegister', 'Registre des fiches (6 mois)')}
          </Button>
        )}
        {canEdit && (
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {t('common.save', 'Enregistrer')}
          </Button>
        )}
      </div>
    </Card>
  );
}

import React, { useEffect, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Input,
  NativeSelect,
  NativeSelectOption,
  Spinner,
} from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import StatusChip from '../../components/StatusChip';
import { Room, Add, DeleteOutline, Save } from '../../icons';
import { useNotification } from '../../hooks/useNotification';
import { useTranslation } from '../../hooks/useTranslation';
import {
  myCoverageZonesApi,
  type CoverageZone,
  type CoverageZoneInput,
} from '../../services/api/myCoverageZonesApi';

interface Props {
  onSaved?: () => void;
}

/** Pays proposes — la maille de zone en depend, pas seulement le libelle. */
const COUNTRIES = ['FR', 'MA', 'ES', 'PT', 'IT', 'BE', 'CH'];

const emptyZone = (country = 'FR'): CoverageZoneInput => ({
  country,
  department: country === 'FR' ? '' : null,
  arrondissement: null,
  city: country === 'FR' ? null : '',
});

/**
 * Zone d'intervention de l'intervenant.
 *
 * <p>C'est ce qui le rend trouvable par l'affectation automatique : sans zone
 * declaree, il n'apparait dans aucune recherche et ne recoit du travail que si
 * un gestionnaire le designe a la main.</p>
 *
 * <p>La maille change avec le pays : la France se decrit par departement, avec
 * un arrondissement facultatif pour Paris, Lyon et Marseille ; le reste du
 * monde par ville. Le formulaire suit cette regle plutot que d'exposer quatre
 * champs dont deux seraient toujours vides.</p>
 */
export default function MyCoverageZoneCard({ onSaved }: Props) {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const [zones, setZones] = useState<CoverageZoneInput[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    myCoverageZonesApi.getMine()
      .then((loaded: CoverageZone[]) => setZones(loaded.map(({ id: _id, ...rest }) => rest)))
      .catch(() => {
        setZones([]);
        setError(t('coverageZone.loadError', 'Impossible de charger votre zone.'));
      });
  }, [t]);

  const update = (index: number, patch: Partial<CoverageZoneInput>) => {
    setZones((prev) => prev?.map((zone, i) => (i === index ? { ...zone, ...patch } : zone)) ?? prev);
  };

  const changeCountry = (index: number, country: string) => {
    // Changer de pays change la MAILLE : garder l'ancienne valeur laisserait un
    // departement francais sur une zone marocaine.
    update(index, emptyZone(country));
  };

  const save = async () => {
    const cleaned = (zones ?? []).filter((zone) =>
      zone.country === 'FR' ? !!zone.department?.trim() : !!zone.city?.trim());
    setSaving(true);
    setError(null);
    try {
      const saved = await myCoverageZonesApi.replace(cleaned.map((zone) => ({
        ...zone,
        department: zone.department?.trim() || null,
        arrondissement: zone.arrondissement?.trim() || null,
        city: zone.city?.trim() || null,
      })));
      setZones(saved.map(({ id: _id, ...rest }) => rest));
      notify.success(t('coverageZone.saved', 'Zone enregistrée'));
      if (cleaned.length > 0) onSaved?.();
    } catch {
      setError(t('coverageZone.saveError', "L'enregistrement a échoué, réessayez."));
    } finally {
      setSaving(false);
    }
  };

  const declared = (zones ?? []).filter((zone) =>
    zone.country === 'FR' ? !!zone.department?.trim() : !!zone.city?.trim()).length;

  return (
    <Card size="sm" className="shadow-none">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Room size={16} strokeWidth={1.75} className="text-muted-foreground" />
            <p className="m-0 text-2xs font-bold uppercase tracking-wider text-faint">
              {t('coverageZone.title', "Ma zone d'intervention")}
            </p>
          </div>
          {zones && (
            <StatusChip
              tone={declared > 0 ? 'ok' : 'warn'}
              label={declared > 0
                ? t('coverageZone.declared', '{{count}} secteur(s)', { count: declared })
                : t('coverageZone.none', 'Non déclarée')}
              size="sm"
              dot
            />
          )}
        </div>

        <p className="m-0 text-xs text-muted-foreground">
          {t('coverageZone.help',
            "Sans zone déclarée, les missions ne vous sont pas proposées automatiquement — un gestionnaire doit vous désigner à la main.")}
        </p>

        {error && (
          <Alert variant="destructive" className="py-1.5">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {zones === null ? (
          <div className="flex justify-center py-5"><Spinner className="size-6" /></div>
        ) : (
          <>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {zones.map((zone, index) => (
                <li
                  key={index}
                  className="flex flex-wrap items-end gap-2 rounded-xl border border-solid border-border p-2.5"
                >
                  <div className="flex min-w-[110px] flex-col gap-1">
                    <label className="text-xs text-muted-foreground" htmlFor={`zone-country-${index}`}>
                      {t('coverageZone.country', 'Pays')}
                    </label>
                    <NativeSelect
                      id={`zone-country-${index}`}
                      value={zone.country}
                      onChange={(event) => changeCountry(index, event.target.value)}
                    >
                      {COUNTRIES.map((code) => (
                        <NativeSelectOption key={code} value={code}>{code}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>

                  {zone.country === 'FR' ? (
                    <>
                      <div className="flex min-w-[110px] flex-col gap-1">
                        <label className="text-xs text-muted-foreground" htmlFor={`zone-dept-${index}`}>
                          {t('coverageZone.department', 'Département')}
                        </label>
                        <Input
                          id={`zone-dept-${index}`}
                          value={zone.department ?? ''}
                          maxLength={3}
                          placeholder="75"
                          onChange={(event) => update(index, { department: event.target.value })}
                        />
                      </div>
                      <div className="flex min-w-[140px] flex-col gap-1">
                        <label className="text-xs text-muted-foreground" htmlFor={`zone-arr-${index}`}>
                          {t('coverageZone.arrondissement', 'Arrondissement (optionnel)')}
                        </label>
                        <Input
                          id={`zone-arr-${index}`}
                          value={zone.arrondissement ?? ''}
                          maxLength={5}
                          placeholder="75001"
                          onChange={(event) => update(index, { arrondissement: event.target.value })}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex min-w-[160px] flex-1 flex-col gap-1">
                      <label className="text-xs text-muted-foreground" htmlFor={`zone-city-${index}`}>
                        {t('coverageZone.city', 'Ville')}
                      </label>
                      <Input
                        id={`zone-city-${index}`}
                        value={zone.city ?? ''}
                        maxLength={100}
                        placeholder="Marrakech"
                        onChange={(event) => update(index, { city: event.target.value })}
                      />
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="ms-auto text-muted-foreground hover:text-destructive-ink"
                    aria-label={t('coverageZone.remove', 'Retirer ce secteur')}
                    onClick={() => setZones((prev) => prev?.filter((_, i) => i !== index) ?? prev)}
                  >
                    <DeleteOutline size={16} strokeWidth={1.75} />
                  </Button>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
               
                onClick={() => setZones((prev) => [...(prev ?? []), emptyZone()])}
              >
                <Add size={16} strokeWidth={1.75} />
                {t('coverageZone.add', 'Ajouter un secteur')}
              </Button>
              <Button variant="secondary" size="sm" onClick={save} disabled={saving}>
                {saving ? <Spinner className="size-4" /> : <Save size={16} strokeWidth={1.75} />}
                {t('coverageZone.save', 'Enregistrer ma zone')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

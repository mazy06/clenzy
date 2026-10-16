import { Button, Input } from '../../components/ui';
import { NativeSelect, NativeSelectOption } from '../../components/ui/native-select';
import { PlusIcon, Trash2Icon } from '../../icons/glyphs';
import { FRENCH_DEPARTMENTS, getArrondissementsForDepartment } from '../../data/frenchDepartments';
import { useTranslation } from '../../hooks/useTranslation';
import type { ProviderZoneDto } from '../../services/api/marketplaceProvidersApi';
import BaitlyFrenchCitySelect from '../../components/BaitlyFrenchCitySelect';

type Zone = Omit<ProviderZoneDto, 'id'>;

/** Les secteurs Baitly restent un brouillon jusqu'à l'enregistrement de la fiche. */
export default function BaitlyProviderZonesEditor({ value, onChange, country, disabled }: {
  value: Zone[]; onChange: (zones: Zone[]) => void; country: string; disabled: boolean;
}) {
  const { t } = useTranslation();
  const update = (index: number, patch: Partial<Zone>) => onChange(value.map((zone, i) => i === index ? { ...zone, ...patch } : zone));
  return <fieldset disabled={disabled} className="min-w-0 space-y-3 border-0 p-0">
    <legend className="mb-2 text-sm font-medium">{t('providerCoverage.title')}</legend>
    <p className="text-sm text-muted-foreground">{t('providerCoverage.help')}</p>
    {value.map((zone, index) => {
      const arrondissements = getArrondissementsForDepartment(zone.department ?? '');
      return <div key={index} className="flex min-w-0 flex-wrap items-end gap-3 border-b border-border pb-3">
        <label className="flex w-24 flex-col gap-1.5 text-sm">{t('coverageZone.country')}
          <Input required maxLength={2} pattern="[A-Za-z]{2}" value={zone.countryCode}
            onChange={e => update(index, { countryCode: e.target.value.toUpperCase(), department: undefined, arrondissement: undefined, city: undefined })} />
        </label>
        {zone.countryCode === 'FR' ? <>
          <label className="flex min-w-40 flex-1 flex-col gap-1.5 text-sm">{t('coverageZone.department')}
            <NativeSelect required value={zone.department ?? ''} onChange={e => update(index, { department: e.target.value, arrondissement: undefined, city: undefined })}>
              <NativeSelectOption value="">{t('providerCoverage.chooseDepartment')}</NativeSelectOption>
              {FRENCH_DEPARTMENTS.map(department => <NativeSelectOption key={department.code} value={department.code}>{department.code} · {department.name}</NativeSelectOption>)}
            </NativeSelect>
          </label>
          <BaitlyFrenchCitySelect id={`provider-zone-city-${index}`} department={zone.department ?? ''} value={zone.city}
            disabled={disabled} onChange={city => update(index, { city, arrondissement: undefined })} />
          {arrondissements.length > 0 && (!zone.city || zone.city === ({ '75': 'Paris', '69': 'Lyon', '13': 'Marseille' } as Record<string, string>)[zone.department ?? '']) && <label className="flex min-w-40 flex-1 flex-col gap-1.5 text-sm">{t('coverageZone.arrondissement')}
            <NativeSelect value={zone.arrondissement ?? ''} onChange={e => update(index, { arrondissement: e.target.value || undefined })}>
              <NativeSelectOption value="">{t(zone.city ? 'providerCoverage.wholeCity' : 'providerCoverage.wholeDepartment')}</NativeSelectOption>
              {zone.arrondissement && !arrondissements.some(arr => arr.code === zone.arrondissement) && <NativeSelectOption value={zone.arrondissement}>{zone.arrondissement}</NativeSelectOption>}
              {arrondissements.map(arr => <NativeSelectOption key={arr.code} value={arr.code}>{arr.name}</NativeSelectOption>)}
            </NativeSelect>
          </label>}
        </> : <label className="flex min-w-40 flex-1 flex-col gap-1.5 text-sm">{t('coverageZone.city')}
          <Input required maxLength={100} value={zone.city ?? ''} onChange={e => update(index, { city: e.target.value })} />
        </label>}
        <Button type="button" variant="ghost" size="icon" aria-label={t('coverageZone.remove')}
          onClick={() => onChange(value.filter((_, i) => i !== index))}><Trash2Icon /></Button>
      </div>;
    })}
    <Button type="button" variant="outline" disabled={value.length >= 100} onClick={() => onChange([...value, { countryCode: country.toUpperCase() || 'FR', primary: value.length === 0 }])}>
      <PlusIcon />{t('coverageZone.add')}
    </Button>
  </fieldset>;
}

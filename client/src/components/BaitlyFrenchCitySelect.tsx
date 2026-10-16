import { useQuery } from '@tanstack/react-query';
import { Button } from './ui';
import { NativeSelect, NativeSelectOption } from './ui/native-select';
import { useTranslation } from '../hooks/useTranslation';

/** Liste officielle locale, limitée au département choisi. Vide = département entier. */
export default function BaitlyFrenchCitySelect({ department, value, onChange, disabled, id }: {
  department: string; value?: string | null; onChange: (city: string | undefined) => void; disabled?: boolean; id?: string;
}) {
  const { t } = useTranslation();
  const validDepartment = /^[0-9A-Z]{2,3}$/.test(department);
  const { data = [], isPending, isError, refetch } = useQuery<string[]>({
    queryKey: ['baitly-french-communes', department],
    enabled: validDepartment,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/geo/baitly-communes/${encodeURIComponent(department)}.json`, { signal });
      if (!response.ok) throw new Error('Communes indisponibles');
      return response.json();
    },
  });
  return <div className="flex min-w-40 flex-1 flex-col gap-1.5 text-sm">
    <label htmlFor={id ?? `baitly-city-${department}`}>{t('providerCoverage.cityOptional')}</label>
    <NativeSelect id={id ?? `baitly-city-${department}`} value={value ?? ''} disabled={disabled || !validDepartment || isPending || isError}
      onChange={event => onChange(event.target.value || undefined)}>
      <NativeSelectOption value="">{validDepartment && isPending ? t('providerCoverage.loadingCities') : t('providerCoverage.wholeDepartment')}</NativeSelectOption>
      {value && !data.includes(value) && <NativeSelectOption value={value}>{value}</NativeSelectOption>}
      {data.map(city => <NativeSelectOption key={city} value={city}>{city}</NativeSelectOption>)}
    </NativeSelect>
    {isError && <div role="alert" className="text-sm text-destructive-ink">{t('providerCoverage.citiesError')}
      <Button type="button" variant="ghost" onClick={() => void refetch()}>{t('providerCoverage.retryCities')}</Button>
    </div>}
  </div>;
}

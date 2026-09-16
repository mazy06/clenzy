import { useQuery } from '@tanstack/react-query';
import { serviceReferenceQuery } from './ServiceItemSelect';
import { useTranslation } from '../hooks/useTranslation';

export default function ServiceReferenceLabels({ codes }: { codes?: string[] }) {
  const { t, isEnglish } = useTranslation();
  const query = useQuery(serviceReferenceQuery);
  return <>{codes?.length ? codes.map(code => {
    const item = query.data?.find(item => item.code === code);
    return item ? (isEnglish ? item.labelEn : item.labelFr) : code;
  }).join(' · ') : t('serviceReference.unqualified')}</>;
}

export function useServiceReferenceLabel(code: string | null | undefined, fallback = ''): string {
  const { isEnglish } = useTranslation();
  const query = useQuery({ ...serviceReferenceQuery, enabled: !!code && !['CLEANING','MAINTENANCE','OTHER'].includes(code) });
  const item = query.data?.find(item => item.code === code);
  return item ? (isEnglish ? item.labelEn : item.labelFr) : fallback || code || '';
}

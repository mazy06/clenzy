import { useId, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Button, Checkbox, Input, Field, FieldLabel, Skeleton, Alert, AlertDescription, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui';
import { serviceReferenceQuery, type ServiceReferenceItem } from '../../components/ServiceItemSelect';
import { marketplaceProvidersApi } from '../../services/api/marketplaceProvidersApi';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';

export default function ServiceRequestCatalogPicker({ selected, onToggle, disabled, selectionMode = 'multiple' }: {
  selectionMode?: 'single' | 'multiple';
  selected: string[]; onToggle: (item: ServiceReferenceItem) => void; disabled?: boolean;
}) {
  const { t, isEnglish } = useTranslation();
  const id = useId();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const catalog = useQuery(serviceReferenceQuery);
  const categories = useQuery({ queryKey: ['marketplace-categories'], queryFn: marketplaceProvidersApi.getCategories, staleTime: 300_000 });
  const label = (item: ServiceReferenceItem) => isEnglish ? item.labelEn : item.labelFr;
  const groups = useMemo(() => [...new Set((catalog.data ?? []).map(i => i.categoryCode ?? 'OTHER'))], [catalog.data]);
  const categoryLabel = (code: string) => {
    const entry = categories.data?.find(c => c.code === code);
    return entry ? (isEnglish ? entry.labelEn : entry.labelFr) : code.replaceAll('_', ' ');
  };
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  const results = (catalog.data ?? []).filter(i => (!category || i.categoryCode === category) &&
    normalize(label(i) + ' ' + categoryLabel(i.categoryCode ?? '')).includes(normalize(search)));
  return <div className="composer-picker space-y-2">
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
    <Field>
      <FieldLabel htmlFor={id}>{t('requestComposer.findService')}</FieldLabel>
      <div className="relative">
        <Search className="absolute start-3 top-3 size-4 text-muted-foreground pointer-events-none" aria-hidden />
        <Input id={id} value={search} onChange={e => setSearch(e.target.value)} disabled={disabled}
          className="w-full ps-9 h-10" placeholder={t('requestComposer.searchExample')} />
      </div>
    </Field>
    <Field>
      <FieldLabel htmlFor={id + '-category'}>{t('requestComposer.categories')}</FieldLabel>
      <Select value={category || 'all'} onValueChange={value => setCategory(value === 'all' ? '' : value)} disabled={disabled}>
        <SelectTrigger id={id + '-category'} className="w-full min-h-10"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('requestComposer.allServices')}</SelectItem>
          {groups.map(code => <SelectItem key={code} value={code}>{categoryLabel(code)}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
    </div>
    {catalog.isPending ? <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
      : catalog.isError ? <Alert variant="destructive"><AlertDescription>{t('serviceReference.loadError')} <Button type="button" variant="outline" onClick={() => catalog.refetch()}>{t('common.retry')}</Button></AlertDescription></Alert>
      : <div className="composer-results max-h-80 overflow-y-auto divide-y divide-border border-y border-border" aria-label={t('requestComposer.catalog')}>
        {results.length === 0 && <p className="py-6 text-sm text-muted-foreground">{t('serviceReference.empty')}</p>}
        {results.map(item => {
          const active = selected.includes(item.code);
          return <label key={item.code} htmlFor={id + item.code}
            className={cn('w-full flex items-center gap-3 px-2 py-2 text-start cursor-pointer transition-colors duration-150 motion-reduce:transition-none hover:bg-muted focus-within:outline-2 focus-within:outline-primary focus-within:-outline-offset-2', active && 'bg-primary-soft')}>
            <Checkbox id={id + item.code} checked={active} disabled={disabled || (!active && selected.length >= 20)}
              onCheckedChange={() => onToggle(item)} className="cursor-pointer" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{label(item)}</span>
              <span className={cn('block text-xs mt-0.5', active ? 'text-foreground' : 'text-muted-foreground')}>{categoryLabel(item.categoryCode ?? '')}</span>
            </span>
            {item.executionMode === 'REMOTE' && <span className={cn('text-xs', active ? 'text-foreground' : 'text-muted-foreground')}>{t('requestComposer.remote')}</span>}
          </label>;
        })}
      </div>}
    {selectionMode === 'multiple' && <p className="text-xs text-muted-foreground">{t('requestComposer.selectionHelp')}</p>}
  </div>;
}

import { useState } from 'react';
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui';
import { Group, FacetRow, ToggleRow, MoreButton } from '../marketplace/MarketplaceFilters';
import { categoryIcon } from '../marketplace/providerPresentation';
import { useMarketplacePresentation } from '../marketplace/useMarketplacePresentation';
import type { ServiceCategoryDto } from '../../services/api/marketplaceProvidersApi';

export default function ProviderCatalogFilters({ categories, category, setCategory, city, setCity, verifiedOnly,
  setVerifiedOnly, propertyId, setPropertyId, properties, propertyError, locked }: {
  categories: ServiceCategoryDto[]; category: string; setCategory: (value: string) => void;
  city: string; setCity: (value: string) => void; verifiedOnly: boolean; setVerifiedOnly: (value: boolean) => void;
  propertyId: string; setPropertyId: (value: string) => void; properties: {id: number; name: string}[];
  propertyError: boolean; locked: boolean;
}) {
  const { t, catalogLabel } = useMarketplacePresentation();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);
  const matching = categories.filter(item => catalogLabel(item).toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()));
  const visible = matching.filter(item => expanded || search.trim() || item.common || item.code === category);
  const hiddenCount = matching.length - visible.length;
  return <div className="px-1">
    <Group title={t('marketplaceWorkflow.property')}>
      <Select value={propertyId || 'all'} disabled={locked} onValueChange={value => setPropertyId(value === 'all' ? '' : value)}>
        <SelectTrigger className="w-full min-w-0" aria-label={t('marketplaceWorkflow.property')}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('marketplaceWorkflow.allProperties')}</SelectItem>
          {properties.map(property => <SelectItem key={property.id} value={String(property.id)}>{property.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {propertyError && <p role="alert" className="text-xs text-destructive-ink">{t('marketplaceWorkflow.propertiesFailed')}</p>}
    </Group>
    <Group title={t('marketplaceAdmin.trade')}>
      <Input className="mb-2 h-8 text-xs" value={search} onChange={event => setSearch(event.target.value)}
        placeholder={t('marketplaceAdmin.findTrade')} aria-label={t('marketplaceAdmin.tradeSearch')} />
      <FacetRow label={t('marketplaceWorkflow.allCategories')} active={!category} disabled={locked} onClick={() => setCategory('')} />
      {visible.map(item => <FacetRow key={item.code} label={catalogLabel(item)} icon={categoryIcon(item.iconKey)}
        active={category === item.code} disabled={locked} onClick={() => setCategory(category === item.code ? '' : item.code)} />)}
      {hiddenCount > 0 && <MoreButton onClick={() => setExpanded(true)}>{t('marketplaceAdmin.otherTrades', { count: hiddenCount })}</MoreButton>}
      {expanded && !search && <MoreButton onClick={() => setExpanded(false)}>{t('marketplaceAdmin.hideTrades')}</MoreButton>}
    </Group>
    <Group title={t('marketplaceAdmin.city')}>
      <Input value={city} onChange={event => setCity(event.target.value)} placeholder={t('marketplaceWorkflow.city')} aria-label={t('marketplaceWorkflow.city')} />
    </Group>
    <Group title={t('marketplaceAdmin.other')}>
      <ToggleRow label={t('marketplaceAdmin.verifiedOnly')} checked={verifiedOnly} onChange={setVerifiedOnly} />
    </Group>
  </div>;
}

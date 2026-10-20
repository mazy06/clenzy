/** Public matching carries location and requirements only, never a private property ID or address. */
export const BAITLY_OWNER_SERVICES=['LISTINGS','PRICING','GUESTS','CLEANING','MAINTENANCE','OWNER_REPORTING'] as const;
export const BAITLY_OWNER_PROPERTY_TYPES=['APARTMENT','HOUSE','STUDIO','VILLA','LOFT','DUPLEX','TOWNHOUSE','BUNGALOW','RIAD','GUEST_ROOM','COTTAGE','CHALET','BOAT','OTHER'] as const;
export interface BaitlyOwnerCriteria { city: string; country: string; propertyType: string; services: string[]; maxFee: string }
export function ownerCriteria(search: string): BaitlyOwnerCriteria {
  const params=new URLSearchParams(search), type=params.get('propertyType') ?? 'APARTMENT', country=params.get('country')?.toUpperCase() ?? '';
  const fee=params.get('maxFee') ?? '';
  return { city:(params.get('city') ?? '').slice(0,150),country:/^[A-Z]{2}$/.test(country)?country:'',
    propertyType:(BAITLY_OWNER_PROPERTY_TYPES as readonly string[]).includes(type)?type:'APARTMENT',
    services:[...new Set(params.getAll('service').filter(value => (BAITLY_OWNER_SERVICES as readonly string[]).includes(value)))].slice(0,6),
    maxFee:/^\d{1,3}(\.\d{1,2})?$/.test(fee) && Number(fee)<=100 ? fee : '' };
}
export function ownerCriteriaParams(criteria: BaitlyOwnerCriteria,language: string,search='') {
  const params=new URLSearchParams({ lang:language }),incoming=new URLSearchParams(search);
  for(const key of ['utm_source','utm_medium','utm_campaign']) { const value=incoming.get(key);if(value)params.set(key,value.slice(0,150)); }
  if(criteria.city)params.set('city',criteria.city.slice(0,150));
  if(criteria.country)params.set('country',criteria.country);
  params.set('propertyType',criteria.propertyType);
  criteria.services.forEach(service => params.append('service',service));
  if(criteria.maxFee)params.set('maxFee',criteria.maxFee);
  return params;
}
export function ownerPropertySearchUrl(property: { city: string; propertyType: string; countryCode?: string },language: string) {
  const type=property.propertyType.toUpperCase(),country=property.countryCode?.toUpperCase() ?? '';
  return 'https://baitly.fr/conciergeries?'+ownerCriteriaParams({ city:property.city,country:/^[A-Z]{2}$/.test(country)?country:'',
    propertyType:(BAITLY_OWNER_PROPERTY_TYPES as readonly string[]).includes(type)?type:'OTHER',services:[],maxFee:'' },language,
    '?utm_source=baitly-app&utm_medium=property&utm_campaign=owner-matching');
}

import clients from '@/features/marketplace/baitlyDemoClients.json';
import { baitlyDataMode } from '@/config/baitlyDataMode';
import { useBaitlyDemoProfile } from '@/config/baitlyDemoProfileState';
import type { Property } from '@/api/endpoints/propertiesApi';

export function demoOwnedProperties(): Property[] {
  if(baitlyDataMode()!=='demo')throw {status:404};
  const role=useBaitlyDemoProfile.getState().key==='owner'?'OWNER':'CONCIERGE';
  const client=clients.find(item=>item.role===role);
  return (client?.properties ?? []).map((home,index)=>({id:-2000-index,name:home.name,type:home.type,status:'ACTIVE',description:home.description,
    city:home.city,bedroomCount:home.bedrooms,bathroomCount:home.bathrooms,maxGuests:home.guests,squareMeters:home.areaM2,
    photos:home.photos,amenities:home.amenities,defaultCurrency:'MAD',createdAt:'2024-01-01T00:00:00Z',updatedAt:'2024-01-01T00:00:00Z'}));
}

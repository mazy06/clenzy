import apiClient from '../apiClient';
export interface BaitlyCrmLocation {
  prospect_id:number; label:string; latitude:number; longitude:number; precision:'CITY'|'ADDRESS';
  osm_type?:'node'|'way'|'relation'|null; osm_id?:number|null; osm_confirmed_at?:string|null;
}
export interface BaitlyOsmCandidate {osmType:'node'|'way'|'relation'|null;osmId:number;name:string;label:string;latitude:number;longitude:number;signals:('NAME'|'CITY'|'WEBSITE'|'SIRET'|'POSTAL_CODE'|'ADDRESS')[];precision?:'CITY'|'ADDRESS';source?:'BAN'|null;reference?:string|null;score?:number|null}
export interface BaitlyOsmResults {ticket:string;candidates:BaitlyOsmCandidate[]}
export const baitlyCrmLocationsApi={
  list:()=>apiClient.get<BaitlyCrmLocation[]>('/prospect-locations'),
  save:(id:number,location:Omit<BaitlyCrmLocation,'prospect_id'>)=>apiClient.put<void>(`/prospect-locations/${id}`,location),
  remove:(id:number)=>apiClient.delete<void>(`/prospect-locations/${id}`),
  searchOsm:(id:number,input:{business:string;city:string;country:string;publicBusiness:boolean})=>apiClient.post<BaitlyOsmResults>(`/prospect-locations/${id}/osm/search`,input),
  searchImportedOsm:(id:number,signal?:AbortSignal)=>apiClient.post<BaitlyOsmResults>(`/prospect-locations/${id}/osm/imported-search`,undefined,{signal}),
  confirmOsm:(id:number,input:{ticket:string;index:number;replace:boolean})=>apiClient.post<void>(`/prospect-locations/${id}/osm/confirm`,input),
};

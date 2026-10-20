import type {DirectoryContactFilter} from '../../config/baitlyDirectoryContacts';
import apiClient from '../apiClient';
import type {baitlyDirectoryServices} from '../../config/baitlyDirectoryServices';
import type {MapBounds} from '../../components/BaitlyMapCanvas';
export interface ReferencedProfessional {
  id:number;siret:string;name:string;address:string;city:string;postal_code:string;activity:string;
  latitude:number|null;longitude:number|null;phone:string|null;email:string|null;website:string|null;
  sirene_retrieved_at:string;osm_key:string|null;osm_name:string|null;osm_confirmed_at:string|null;
  rge_retrieved_at?:string|null;location_source?:'SIRENE'|'OSM'|null;osm_contact_key?:string|null;
}
export interface SireneBusiness {siret:string;name:string;address:string;city:string;postalCode:string;activity:string;latitude:number|null;longitude:number|null}
export interface OsmBusiness {key:string;name:string;address:string;latitude:number;longitude:number;phone:string;email:string;website:string;signals:string[]}
export interface SourcePreview<T> {ticket:string;candidates:T[];hasNext?:boolean}
export interface DirectoryCity {nom:string;code:string;codesPostaux:string[]}
export interface DirectoryMapCluster {key:string;count:number;latitude:number;longitude:number;west:number;south:number;east:number;north:number;representativeId:number}
export type DirectoryService=typeof baitlyDirectoryServices[number];
export type DirectoryMapSort='PROXIMITY'|'CONTACTS'|'NAME';
export interface NationalDirectoryStatus {enabled:boolean;phase?:'ESTABLISHMENTS'|'UNITS'|'PUBLISH'|'COMPLETED';scanned?:number;selected?:number;published?:number;failures?:number;retry_at?:string|null;completed_at?:string|null}
export interface DirectorySearch {query:string;postalCode?:string;communeCode:string;service:DirectoryService|'';page:number}
export interface DirectoryImportChoice {ticket:string;index:number}
export interface DirectoryImportResult {siret:string;name:string;status:'CREATED'|'EXISTING'|'CATALOGUE'|'REMOVED'|'REVIEW';id:number|null}
const BASE='/professional-directory';
export const professionalDirectoryApi={
  rankedMap:(input:{city:string;service:DirectoryService|'';query:string;bounds:MapBounds;after:number;contacts:DirectoryContactFilter;sort:DirectoryMapSort},signal?:AbortSignal)=>apiClient.get<{items:ReferencedProfessional[];nextCursor:number|null}>(`${BASE}/map/ranked?${new URLSearchParams({city:input.city,service:input.service,query:input.query,contacts:input.contacts,sort:input.sort,after:String(input.after),...Object.fromEntries(Object.entries(input.bounds).map(([k,v])=>[k,String(v)]))})}`,{signal}),
  list:(query:string,page:number,service:DirectoryService|''='',contacts:DirectoryContactFilter='')=>apiClient.get<{items:ReferencedProfessional[];total:number;page:number}>(`${BASE}?${new URLSearchParams({query,page:String(page),service,contacts})}`),
  synchronization:()=>apiClient.get<NationalDirectoryStatus>(`${BASE}/synchronization`),
  clusters:(input:{city:string;service:DirectoryService|'';query:string;bounds:MapBounds;contacts:DirectoryContactFilter},signal?:AbortSignal)=>apiClient.get<{clusters:DirectoryMapCluster[];total:number}>(`${BASE}/map/clusters?${new URLSearchParams({city:input.city,service:input.service,query:input.query,contacts:input.contacts,...Object.fromEntries(Object.entries(input.bounds).map(([k,v])=>[k,String(v)]))})}`,{signal}),
  map:(input:{city:string;service:DirectoryService|'';query:string;bounds:MapBounds;after:number;contacts?:DirectoryContactFilter},signal?:AbortSignal)=>apiClient.get<{items:ReferencedProfessional[];nextCursor:number|null}>(`${BASE}/map?${new URLSearchParams({city:input.city,service:input.service,query:input.query,contacts:input.contacts??'',after:String(input.after),...Object.fromEntries(Object.entries(input.bounds).map(([k,v])=>[k,String(v)]))})}`,{signal}),
  search:(query:string,postalCode:string,page:number)=>apiClient.post<SourcePreview<SireneBusiness>>(`${BASE}/sirene/search`,{query,postalCode,page}),
  cities:(name:string)=>apiClient.get<DirectoryCity[]>(`${BASE}/cities?${new URLSearchParams({name})}`),
  discover:(input:DirectorySearch)=>apiClient.post<SourcePreview<SireneBusiness>>(`${BASE}/sirene/search`,input),
  importBatch:(choices:DirectoryImportChoice[])=>apiClient.post<DirectoryImportResult[]>(`${BASE}/sirene/confirm-batch`,{choices}),
  import:(ticket:string,index:number)=>apiClient.post(`${BASE}/sirene/confirm`,{ticket,index}),
  match:(id:number)=>apiClient.post<SourcePreview<OsmBusiness>>(`${BASE}/${id}/osm/search`),
  confirm:(id:number,ticket:string,index:number)=>apiClient.post(`${BASE}/${id}/osm/confirm`,{ticket,index}),
  remove:(id:number)=>apiClient.delete(`${BASE}/${id}`),
};
const CRM='/prospects/professional-imports';
export const crmProfessionalImportsApi={
  cities:(name:string)=>apiClient.get<DirectoryCity[]>(`${CRM}/cities?${new URLSearchParams({name})}`),
  discover:(input:DirectorySearch,signal?:AbortSignal)=>apiClient.post<SourcePreview<SireneBusiness>>(`${CRM}/search`,input,{signal}),
  importBatch:(choices:DirectoryImportChoice[])=>apiClient.post<DirectoryImportResult[]>(`${CRM}/confirm-batch`,{choices}),
  importReference:(id:number)=>apiClient.post<DirectoryImportResult>(`${CRM}/references/${id}`),
  importReferences:(ids:readonly number[])=>apiClient.post<DirectoryImportResult[]>(`${CRM}/references/confirm-batch`,{ids}),
};

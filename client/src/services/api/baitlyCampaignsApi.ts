import apiClient from '../apiClient';
export interface BaitlyCampaignSegment {type:'OWNER'|'PROVIDER';city?:string;status?:string;category?:string;source?:string;specialty?:string;trade?:string}
export interface BaitlyCampaignTemplate {id:number;name:string;contact_type:'OWNER'|'PROVIDER';subject:string;body:string}
export interface BaitlyCampaign {id:number;name:string;contact_type:string;status:string;language:string;segment:BaitlyCampaignSegment;subject:string;body:string;organization_name:string;created_at:string}
export interface BaitlyCampaignResponse {id:number;decision:string;message?:string;source:string;created_at:string;recorded_by:string}
export interface BaitlyCampaignRecipient {id:number;prospect_id:number;contact_name:string;email:string;subject:string;body:string;status:string;reason?:string;attempted_at?:string;accepted_at?:string;provider_message_id?:string;responses:BaitlyCampaignResponse[]}
export interface BaitlyCampaignPreview {total:number;eligible:number;exclusions:Record<string,number>;content:Array<{id:number;name:string;city?:string;email?:string;reason:string}>;page:number;size:number}
export interface BaitlyCampaignDetail {campaign:BaitlyCampaign;content:BaitlyCampaignRecipient[];counts:Record<string,number>;totalElements:number;responded:number}
export const baitlyCampaignsApi={
  templates:()=>apiClient.get<BaitlyCampaignTemplate[]>('/prospect-campaigns/templates'),
  saveTemplate:({id,...model}:{id?:number;name:string;contactType:string;subject:string;body:string})=>id?apiClient.put<BaitlyCampaignTemplate>(`/prospect-campaigns/templates/${id}`,model):apiClient.post<BaitlyCampaignTemplate>('/prospect-campaigns/templates',model),
  list:(page:number)=>apiClient.get<{content:BaitlyCampaign[];totalElements:number}>('/prospect-campaigns',{params:{page}}),
  detail:(id:number,page:number)=>apiClient.get<BaitlyCampaignDetail>(`/prospect-campaigns/${id}`,{params:{page}}),
  preview:(segment:BaitlyCampaignSegment,page:number)=>apiClient.post<BaitlyCampaignPreview>(`/prospect-campaigns/preview?page=${page}`,segment),
  create:(body:{requestId:string;name:string;templateId:number;segment:BaitlyCampaignSegment;language:string})=>apiClient.post<BaitlyCampaign>('/prospect-campaigns',body),
  transport:()=>apiClient.get<{available:boolean}>('/prospect-campaigns/transport'),
  dispatch:(id:number)=>apiClient.post<{accepted:number;unknown:number;skipped:number}>(`/prospect-campaigns/${id}/dispatch`),
  cancel:(id:number)=>apiClient.post<void>(`/prospect-campaigns/${id}/cancel`),
  respond:(id:number,response:{requestId:string;decision:string;message?:string})=>apiClient.post<void>(`/prospect-campaigns/recipients/${id}/responses`,response),
};

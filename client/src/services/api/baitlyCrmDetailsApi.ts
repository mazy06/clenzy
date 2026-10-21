import apiClient from '../apiClient';
export interface BaitlyCrmDetails {
  prospect_id:number;assigned_user_id?:number|null;assigned_user_name?:string|null;assigned_user_avatar_url?:string|null;assignee_unavailable?:boolean;
  company_name?:string|null;job_title?:string|null;specific_role?:string|null;region?:string|null;
  qualification:'TO_QUALIFY'|'QUALIFIED'|'UNQUALIFIED';score:number;updated_at?:string;
  last_exchange_on?:string|null;next_action?:string|null;next_action_on?:string|null;
}
export interface BaitlyCrmFollowUpWrite { lastExchangeOn:string|null;nextAction:string|null;nextActionOn:string|null }
export interface BaitlyCrmDetailsWrite {
  assignedUserId:number|null;companyName:string;jobTitle:string;specificRole:string;region:string;qualification:BaitlyCrmDetails['qualification'];
}
export const baitlyCrmDetailsApi={
  list:()=>apiClient.get<BaitlyCrmDetails[]>('/prospect-details'),
  assignees:()=>apiClient.get<Array<{id:number;name:string;profilePictureUrl?:string|null}>>('/prospect-details/assignees'),
  save:(id:number,details:BaitlyCrmDetailsWrite)=>apiClient.put<void>(`/prospect-details/${id}`,details),
  saveFollowUp:(id:number,followUp:BaitlyCrmFollowUpWrite)=>apiClient.put<void>(`/prospect-details/${id}/follow-up`,followUp),
};

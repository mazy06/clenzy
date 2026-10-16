import { apiClient, PaginatedResponse } from '../apiClient';
import { baitlyMediaList } from '../baitlyMedia';

export interface Intervention {
  id: number;
  title: string;
  description?: string;
  type: string;
  status: string;
  priority: string;
  propertyId?: number;
  requestorId?:number;
  propertyName?: string;
  propertyAddress?: string;
  assignedTechnicianId?: number;
  assignedTechnicianName?: string;
  assignedToId?:number;assignedToName?:string;assignedToType?:string;
  teamId?: number;
  teamName?: string;
  startTime?: string;
  endTime?: string;
  isUrgent: boolean;
  requiresFollowUp: boolean;
  materialsUsed?: string;
  technicianNotes?: string;
  customerFeedback?: string;
  customerRating?: number;
  beforePhotosUrls?: string[];
  afterPhotosUrls?: string[];
  validatedRooms?: string;
  estimatedCost?: number;
  currency?:string;
  followUpNotes?:string;
  /** Prix conseil plateforme (moteur ménage) snapshoté à la création — badge barème. */
  recommendedCost?: number;
  actualCost?: number;
  estimatedDurationHours?: number;
  paymentStatus?: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  stripeSessionId?: string;
  paidAt?: string;
  scheduledDate?: string;
  createdAt: string;
  updatedAt: string;
  version?:number;
}

export interface InterventionListParams {
  page?: number;
  size?: number;
  status?: string;
  type?: string;
  priority?: string;
  propertyId?: number;
  assignedTo?: number;
  teamId?: number;
  startDate?: string;
  endDate?: string;
  sort?: string;
}

export const interventionsApi = {
  async getAll(params?: InterventionListParams) {
    const page = await apiClient.get<PaginatedResponse<Intervention>>('/interventions', { params: params as Record<string, string> });
    return { ...page, content: page.content.map(normalizeIntervention) };
  },

  async getById(id: number) {
    return normalizeIntervention(await apiClient.get<Intervention>(`/interventions/${id}`));
  },

  create(data: Partial<Intervention>) {
    return apiClient.post<Intervention>('/interventions', data);
  },

  update(id: number, data: Partial<Intervention>) {
    return apiClient.put<Intervention>(`/interventions/${id}`, data);
  },

  delete(id: number) {
    return apiClient.delete(`/interventions/${id}`);
  },

  uploadPhotos(id: number, formData: FormData) {
    return apiClient.upload(`/interventions/${id}/photos`, formData);
  },

  updateCost(id: number, estimatedCost?: number, actualCost?: number) {
    const value=actualCost??estimatedCost;
    if(value==null||!Number.isFinite(value)||value<0)return Promise.reject({status:400,message:'Montant invalide'});
    return apiClient.put<Intervention>(`/interventions/${id}/amount`, {mode:'SET',value});
  },
  start:(id:number)=>apiClient.put<Intervention>(`/interventions/${id}/start`),
  complete:(id:number)=>apiClient.put<Intervention>(`/interventions/${id}/complete`),

  updateStatus(id: number, status: string) {
    return apiClient.put<Intervention>(`/interventions/${id}/status`, undefined,{params:{status}});
  },
  assign(id:number,teamId:number){return apiClient.put<Intervention>(`/interventions/${id}/assign`,undefined,{params:{teamId}});},
  managerReview(id:number,body:{decision:'approve'|'reject';feedback?:string;rating?:number;amount?:string;version:number}){
    return apiClient.post<Intervention>(`/mobile/missions/${id}/manager-review`,body).then(normalizeIntervention);
  },
};
export function normalizeIntervention(item: Intervention): Intervention {
  const team=item.assignedToType?.toUpperCase()==='TEAM';
  return { ...item,assignedTechnicianName:item.assignedTechnicianName??item.assignedToName,
    assignedTechnicianId:item.assignedTechnicianId??(!team?item.assignedToId:undefined),teamName:item.teamName??(team?item.assignedToName:undefined),teamId:item.teamId??(team?item.assignedToId:undefined),
    beforePhotosUrls: baitlyMediaList(item.beforePhotosUrls), afterPhotosUrls: baitlyMediaList(item.afterPhotosUrls) };
}

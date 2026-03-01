export interface ServiceRequest {
  id: number;
  title: string;
  description: string;
  propertyId: number;
  propertyName?: string;
  propertyAddress?: string;
  userId: number;
  userName?: string;
  serviceType: string;
  priority: string;
  status: string;
  estimatedDurationHours: number;
  desiredDate: string;
  assignedToId?: number;
  assignedToType?: 'user' | 'team';
  assignedToName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ServiceRequestFormData {
  title: string;
  description: string;
  propertyId: number;
  serviceType: string;
  priority: string;
  estimatedDurationHours: number;
  desiredDate: string;
  userId: number;
  assignedToId?: number;
  assignedToType?: 'user' | 'team';
}

import React from 'react';
import {
  CleaningServices,
  Build,
  Category,
} from '@mui/icons-material';
import { RequestStatus, REQUEST_STATUS_OPTIONS, Priority, PRIORITY_OPTIONS } from '../../types/statusEnums';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ServiceRequest {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  propertyId: number;
  propertyName: string;
  propertyAddress: string;
  propertyCity: string;
  requestorId: number;
  requestorName: string;
  assignedToId?: number;
  assignedToName?: string;
  assignedToType?: 'user' | 'team';
  estimatedDuration: number;
  dueDate: string;
  createdAt: string;
  approvedAt?: string; // Date d'approbation pour calculer le delai d'annulation
}

export interface AssignTeam {
  id: number;
  name: string;
}

export interface AssignUser {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
}

export interface ServiceRequestApiResponse {
  id: number;
  title: string;
  description: string;
  type?: string;
  serviceType?: string;
  status?: string;
  priority?: string;
  propertyId: number;
  property?: { name?: string; address?: string; city?: string };
  userId?: number;
  requestorId?: number;
  user?: { firstName: string; lastName: string };
  requestor?: { firstName: string; lastName: string };
  assignedToId?: number;
  assignedTo?: { firstName: string; lastName: string };
  assignedToType?: string;
  estimatedDurationHours?: number;
  estimatedDuration?: number;
  desiredDate?: string;
  dueDate?: string;
  createdAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Utilisation des enums partages pour les couleurs
export const statusColors = Object.fromEntries(
  REQUEST_STATUS_OPTIONS.map(option => [option.value, option.color])
) as Record<RequestStatus, string>;

export const priorityColors = Object.fromEntries(
  PRIORITY_OPTIONS.map(option => [option.value, option.color])
) as Record<Priority, string>;

export const typeIcons: Record<string, React.ReactElement> = {
  CLEANING: React.createElement(CleaningServices),
  EXPRESS_CLEANING: React.createElement(CleaningServices),
  DEEP_CLEANING: React.createElement(CleaningServices),
  WINDOW_CLEANING: React.createElement(CleaningServices),
  FLOOR_CLEANING: React.createElement(CleaningServices),
  KITCHEN_CLEANING: React.createElement(CleaningServices),
  BATHROOM_CLEANING: React.createElement(CleaningServices),
  PREVENTIVE_MAINTENANCE: React.createElement(Build),
  EMERGENCY_REPAIR: React.createElement(Build),
  ELECTRICAL_REPAIR: React.createElement(Build),
  PLUMBING_REPAIR: React.createElement(Build),
  HVAC_REPAIR: React.createElement(Build),
  APPLIANCE_REPAIR: React.createElement(Build),
  GARDENING: React.createElement(Build),
  EXTERIOR_CLEANING: React.createElement(CleaningServices),
  PEST_CONTROL: React.createElement(Build),
  DISINFECTION: React.createElement(CleaningServices),
  RESTORATION: React.createElement(Build),
  OTHER: React.createElement(Category),
};

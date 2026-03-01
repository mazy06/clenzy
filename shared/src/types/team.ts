export interface TeamMember {
  id: number;
  userId?: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  userName?: string;
  userEmail?: string;
  roleInTeam?: string;
}

export interface CoverageZone {
  id?: number;
  department: string;
  arrondissement?: string;
}

export interface Team {
  id: number;
  name: string;
  description: string;
  interventionType: string;
  memberCount: number;
  members?: TeamMember[];
  coverageZones?: CoverageZone[];
  isActive?: boolean;
  status?: 'active' | 'inactive' | 'maintenance';
  createdAt?: string;
  lastIntervention?: string;
  totalInterventions?: number;
  averageRating?: number;
}

export interface TeamFormData {
  name: string;
  description: string;
  interventionType: string;
  members: { userId: number; roleInTeam: string }[];
  coverageZones?: CoverageZone[];
}

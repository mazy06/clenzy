import { apiClient } from '../apiClient';

export interface Team {
  id: number;
  name: string;
  description?: string;
  coverageZone?: string;
  memberCount?:number;
  coverageZones?:{country?:string;department?:string;arrondissement?:string;city?:string}[];
  members?: TeamMember[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: number;
  userId: number;
  userName: string;
  role: string;
  firstName?:string;lastName?:string;
}

interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
}

export const teamsApi = {
  async getAll(): Promise<Team[]> {
    const page = await apiClient.get<PageResponse<Team>>('/teams?size=1000');
    return (page.content ?? []).map(normalizeTeam);
  },

  async getById(id: number) {
    return normalizeTeam(await apiClient.get<Team>(`/teams/${id}`));
  },
};
export function normalizeTeam(team:Team):Team {
  return {...team,coverageZone:team.coverageZone??team.coverageZones?.map(zone=>[zone.city,zone.department,zone.arrondissement,zone.country].filter(Boolean).join(' · ')).join(' / '),
    members:team.members?.map(member=>({...member,id:member.id??member.userId,userName:member.userName??[member.firstName,member.lastName].filter(Boolean).join(' ')}))};
}

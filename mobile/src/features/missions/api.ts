import { apiClient, type PaginatedResponse } from '@/api/apiClient';
import { demoWorkDetail, recordDemoEvidence, updateDemoWork } from './baitlyDemoWork';
export interface MobileCapabilities { canViewOwnerSpace: boolean; canQuote: boolean; canExecuteAssignedMission: boolean; canManagePrivateNetwork: boolean }
export interface MobileMission { estimatedCost?: number; currency?: string; id: number; title: string; description?: string; type: string; status: string;
  pausedAt?: string | null; pauseSeconds?: number;
  customerFeedback?:string;customerRating?:number;requiresFollowUp?:boolean;followUpNotes?:string;
  propertyLatitude?: number; propertyLongitude?: number;
  propertyId?: number; propertyName?: string; propertyAddress?: string; scheduledDate?: string; startTime?: string; endTime?: string; actualDurationMinutes?: number; estimatedDurationHours?: number; updatedAt?: string;
  notes?: string; completedSteps?: string; serviceItemCode?: string; assignmentResponse?: string; assignedToName?: string;
  beforePhotosUrls?: string; afterPhotosUrls?: string; paymentStatus?: string }
export interface MissionRoom { id: string; type: string; number: number }
export interface MobileWork { mission: MobileMission; canExecute: boolean; canReview?: boolean; executionMode: string; version: number; accessInstructions?: string; cleaningInstructions?: string;
  requiredSteps?: string[];validatedRoomIds?:string[]; startedAt?: string | null; endedAt?: string | null; pausedAt?: string | null; pauseSeconds?: number;
  propertyPhotos?: string[]; stepPhotoCounts?: Record<string, number>; rooms?: MissionRoom[];
  signatureStatus?: 'SIGNED' | 'CLIENT_ABSENT' | null; signerName?: string | null; technicianNotes?: string | null; materialsUsed?: string | null }
export interface MissionDiagnostic { finding: string; cause?: string; materials: { name: string; quantity: number }[] }
export interface MissionSignature { status: 'SIGNED' | 'CLIENT_ABSENT'; signerName?: string }
export function normalizeMobileWork(work: MobileWork): MobileWork {
  let completed: string[]=[];try{const parsed=JSON.parse(work.mission.completedSteps??'[]');if(Array.isArray(parsed))completed=parsed.filter((item):item is string=>typeof item==='string');}catch{/* Malformed legacy progress is not trusted. */}
  if(work.validatedRoomIds) {
    const validated=work.validatedRoomIds.filter(id=>work.rooms?.some(room=>room.id===id));
    completed=[...new Set([...completed,...validated.map(id=>`surfaces_${id}`)])];
    if(work.rooms?.length&&work.rooms.every(room=>validated.includes(room.id)))completed=[...new Set([...completed,'surfaces'])];
  }
  return { ...work, mission: { ...work.mission,
    completedSteps:JSON.stringify(completed),
    ...(work.startedAt !== undefined ? { startTime: work.startedAt ?? undefined } : {}),
    ...(work.endedAt !== undefined ? { endTime: work.endedAt ?? undefined } : {}),
    ...(work.pausedAt !== undefined ? { pausedAt: work.pausedAt, pauseSeconds: work.pauseSeconds ?? 0 } : {}),
  } };
}
export const workApi = {
  capabilities: (signal?: AbortSignal) => apiClient.get<MobileCapabilities>('/mobile/capabilities', { signal }),
  ownerList: (page: number, status?: string) => apiClient.get<PaginatedResponse<MobileMission>>('/mobile/owner-missions', { params: { page, status } }),
  list: (page: number, signal?: AbortSignal) => apiClient.get<PaginatedResponse<MobileMission>>('/mobile/missions', { params: { page }, signal }),
  detail: async (id: number, signal?: AbortSignal) => id < 0 ? JSON.parse(JSON.stringify(demoWorkDetail(id))) as MobileWork : normalizeMobileWork(await apiClient.get<MobileWork>(`/mobile/missions/${id}`, { signal })),
  action: async (id: number, action: string) => id < 0 ? updateDemoWork(id, action) : apiClient.post<MobileMission>(`/mobile/missions/${id}/${action}`),
  diagnostic: async (id: number, body: MissionDiagnostic) => id < 0 ? recordDemoEvidence(id, { technicianNotes: [body.cause && `[${body.cause}]`, body.finding].filter(Boolean).join(' '), materialsUsed: body.materials.map(m => `${m.name} × ${m.quantity}`).join(', ') || null })
    : apiClient.put<void>(`/mobile/missions/${id}/diagnostic`, body),
  signature: async (id: number, body: MissionSignature) => id < 0 ? recordDemoEvidence(id, { signatureStatus: body.status, signerName: body.status === 'SIGNED' ? body.signerName ?? null : null })
    : apiClient.put<void>(`/mobile/missions/${id}/signature`, body),
  report: async (id: number, notes: string, steps: string[], version: number) => id < 0 ? updateDemoWork(id, 'report', { notes, steps, version }) : apiClient.put<MobileMission>(`/mobile/missions/${id}/report`, { notes, completedSteps: JSON.stringify(steps), version }),
};

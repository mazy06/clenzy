import type { MobileMission } from './api';
export function missionSteps(mission: Pick<MobileMission, 'type'>, mode: string) {
  if (mode === 'REMOTE') return ['delivery', 'review'];
  // Mirrors BaitlyMissionWorkflow: every on-site mission ends with the client's signature.
  if (mission.type.includes('CLEANING')) return ['inspection', 'surfaces', 'sanitary', 'linen', 'inventory', 'restock', 'after_photos', 'signature'];
  if (mission.type.includes('MAINTENANCE') || mission.type.includes('TECHNICAL')) return ['inspection', 'diagnostic', 'work', 'test', 'after_photos', 'signature'];
  return ['inspection', 'work', 'after_photos', 'signature'];
}
export function stepPhotoPhase(step: string): 'before' | 'after' { return step === 'inspection' ? 'before' : 'after'; }
export function stepNeedsPhoto(step: string, type = 'CLEANING') { return type.includes('CLEANING') && ['inspection', 'after_photos'].includes(step); }
export function inspectionComplete(rooms: { id: string }[], counts: Record<string, number>) {
  return rooms.length > 0 && rooms.every(room => (counts[`inspection_${room.id}`] ?? 0) > 0);
}
export function parseStringList(value?: string): string[] {
  if (!value) return [];
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []; }
  catch { return []; }
}
export function canSubmitMission(notes: string, steps: string[], required: string[], pendingPhotos: number) {
  return required.every(step => steps.includes(step)) && pendingPhotos === 0;
}

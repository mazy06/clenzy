import { create } from 'zustand';
import { baitlyDataMode } from '@/config/baitlyDataMode';
import { useBaitlyDemoProfile } from '@/config/baitlyDemoProfileState';
import { planningDateKey } from '@/screens/manager/planningModel';
import { demoMissionsForProfile } from './baitlyDemoMissions';
import type { MobileMission, MobileWork } from './api';
import demoClients from '@/features/marketplace/baitlyDemoClients.json';

const records = new Map<string, MobileWork>();
export const useDemoWorkRevision = create<{ revision: number }>(() => ({ revision: 0 }));
export function addDemoStepPhoto(id: number, step: string) {
  const work = demoWorkDetail(id);
  if (!work.canExecute || work.mission.status !== 'IN_PROGRESS') throw { status: 403 };
  const counts = { ...work.stepPhotoCounts, [step]: (work.stepPhotoCounts?.[step] ?? 0) + 1 };
  if (step === 'signature') { records.set(`${useBaitlyDemoProfile.getState().key ?? 'account'}:${id}`, { ...work, stepPhotoCounts: counts }); return; }
  const after = !step.startsWith('inspection');
  const existing = JSON.parse((after ? work.mission.afterPhotosUrls : work.mission.beforePhotosUrls) ?? '[]') as string[];
  const image = work.propertyPhotos?.[(existing.length) % (work.propertyPhotos?.length || 1)] ?? 'cleaning';
  const mission = { ...work.mission, [after ? 'afterPhotosUrls' : 'beforePhotosUrls']: JSON.stringify([...existing, image]) };
  records.set(`${useBaitlyDemoProfile.getState().key ?? 'account'}:${id}`, { ...work, mission, stepPhotoCounts: counts });
  useDemoWorkRevision.setState(state => ({ revision: state.revision + 1 }));
}
export function demoWorkList(): MobileMission[] {
  return demoMissionsForProfile(planningDateKey(new Date()), useBaitlyDemoProfile.getState().key).map(item => demoWorkDetail(item.id).mission);
}
export function demoWorkDetail(id: number): MobileWork {
  if (id >= 0 || baitlyDataMode() !== 'demo') throw { status: 404 };
  const key = `${useBaitlyDemoProfile.getState().key ?? 'account'}:${id}`;
  let work = records.get(key);
  if (!work) {
    const item = demoMissionsForProfile(planningDateKey(new Date()), useBaitlyDemoProfile.getState().key).find(mission => mission.id === id);
    if (!item) throw { status: 404 };
    work = { mission: { id, title: item.title, description: item.description, type: item.type, status: item.status === 'SCHEDULED' ? 'PENDING' : item.status,
      propertyName: item.propertyName, assignedToName: item.assignedTechnicianName, scheduledDate: `${item.scheduledDate}T${item.startTime || '09:00'}:00`, assignmentResponse: 'ACCEPTED', estimatedDurationHours: 1,
      propertyLatitude: 31.6295 + (Math.abs(id) % 4) * 0.003, propertyLongitude: -7.9811,
      propertyAddress: 'Marrakech · Destination fictive de démonstration',
      startTime: item.status === 'IN_PROGRESS' ? new Date(Date.now() - 20 * 60_000).toISOString() : undefined },
      canReview: ['owner', 'concierge'].includes(useBaitlyDemoProfile.getState().key ?? ''),
      canExecute: !['owner', 'concierge'].includes(useBaitlyDemoProfile.getState().key ?? ''), executionMode: 'ON_SITE', version: 0,
      accessInstructions: 'Démo : boîte à clés à droite de la porte. Code fictif 1234. Remettre les clés après l’intervention.',
      propertyPhotos: demoClients.flatMap(client => client.properties).find(property => property.name.includes((item.propertyName ?? '').split(' · ')[0]))?.photos ?? demoClients[0].properties[0].photos,
      rooms: [...Array.from({ length: Math.abs(id) % 3 + 1 }, (_, index) => ({ id: `bedroom_${index + 1}`, type: 'bedroom', number: index + 1 })),
        { id: 'bathroom_1', type: 'bathroom', number: 1 }, { id: 'living_1', type: 'living', number: 1 }, { id: 'kitchen_1', type: 'kitchen', number: 1 }] };
    if (item.status === 'AWAITING_VALIDATION') work.mission = { ...work.mission, notes: item.description, beforePhotosUrls: JSON.stringify(work.propertyPhotos?.slice(0, 2) ?? ['cleaning']), afterPhotosUrls: JSON.stringify(work.propertyPhotos?.slice(0, 3) ?? ['cleaning']), endTime: new Date().toISOString() };
    records.set(key, work);
  }
  return work;
}
export function updateDemoWork(id: number, action: string, report?: { notes: string; steps: string[]; version: number }): MobileMission {
  const work = demoWorkDetail(id);
  if (!work.canExecute) throw { status: 403 };
  let mission = { ...work.mission };
  if (action === 'start' && ['PENDING', 'AWAITING_PAYMENT'].includes(mission.status)) { mission.status = 'IN_PROGRESS'; mission.startTime = new Date().toISOString(); }
  else if (action === 'report' && mission.status === 'IN_PROGRESS' && report?.version === work.version) {
    mission.notes = report.notes; mission.completedSteps = JSON.stringify(report.steps);
  } else if (action === 'submit' && mission.status === 'IN_PROGRESS' && mission.notes?.trim()) { mission.status = 'AWAITING_VALIDATION'; mission.endTime = new Date().toISOString(); }
  else throw { status: 409 };
  records.set(`${useBaitlyDemoProfile.getState().key ?? 'account'}:${id}`, { ...work, mission, version: work.version + 1 });
  useDemoWorkRevision.setState(state => ({ revision: state.revision + 1 }));
  return mission;
}

/** Demo counterpart of the diagnostic and signature endpoints: same running-mission rule. */
export function recordDemoEvidence(id: number, patch: Partial<MobileWork>) {
  const work = demoWorkDetail(id);
  if (!work.canExecute) throw { status: 403 };
  if (work.mission.status !== 'IN_PROGRESS') throw { status: 409 };
  records.set(`${useBaitlyDemoProfile.getState().key ?? 'account'}:${id}`, { ...work, ...patch });
  useDemoWorkRevision.setState(state => ({ revision: state.revision + 1 }));
}

export function reviewDemoWork(id: number, approve: boolean, reason: string) {
  const work = demoWorkDetail(id);
  if (!['owner', 'concierge'].includes(useBaitlyDemoProfile.getState().key ?? '')) throw { status: 403 };
  if (work.mission.status !== 'AWAITING_VALIDATION' || (!approve && !reason.trim())) throw { status: 409 };
  const mission = { ...work.mission, status: approve ? 'AWAITING_PAYMENT' : 'IN_PROGRESS', followUpNotes: approve ? undefined : reason.trim() };
  records.set(`${useBaitlyDemoProfile.getState().key ?? 'account'}:${id}`, { ...work, mission, version: work.version + 1 });
  useDemoWorkRevision.setState(state => ({ revision: state.revision + 1 }));
  return mission;
}

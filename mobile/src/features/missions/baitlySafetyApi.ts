import { apiClient } from '@/api/apiClient';
import { demoWorkDetail, useDemoWorkRevision } from './baitlyDemoWork';
import { useBaitlyDemoProfile } from '@/config/baitlyDemoProfileState';
export interface MissionSafetyState {
  reportedIssueId?: number;
  pausedAt?: string | null; pauseSeconds: number;
  contacts: { role: string; name: string; phone?: string }[];
  furniture: { id: number; name: string; catalogKey?: string; photoUrl?: string; room?: string }[];
  incidents: { id: number; title: string; description: string; status: string; date: string; photos?: string[]; cause?: string; room?: string; elementCategory?: string; elementCode?: string; elementName?: string }[];
}
export interface MissionDamage { cause: string; room: string; furnitureId?: number; detail?: string; elementName?: string; elementCategory?: string; elementCode?: string }
const demos = new Map<string, MissionSafetyState>();
function demo(id: number) {
  demoWorkDetail(id);
  const key = `${useBaitlyDemoProfile.getState().key}:${id}`;
  if (!demos.has(key)) demos.set(key, { pauseSeconds: 0, contacts: [
    { role: 'supervisor', name: 'Superviseur démo' }, { role: 'concierge', name: 'Conciergerie démo' }, { role: 'owner', name: 'Propriétaire démo' }],
    furniture: [{ id: -1, name: 'Canapé',room:'Salon' }, { id: -2, name: 'Table',room:'Salon' }, { id: -3, name: 'Lit',room:'Chambre' }, { id: -4, name: 'Lavabo',room:'Salle de bain' }], incidents: [] });
  return demos.get(key)!;
}
export const safetyApi = {
  detail: async (id: number): Promise<MissionSafetyState> => id < 0 ? JSON.parse(JSON.stringify(demo(id))) : apiClient.get(`/mobile/missions/${id}/safety`),
  change: async (id: number, action: 'pause' | 'resume' | 'damage', body?: MissionDamage): Promise<MissionSafetyState> => {
    if (id >= 0) return apiClient.post(`/mobile/missions/${id}/${action}`, body);
    const work = demoWorkDetail(id);
    if (!work.canExecute || work.mission.status !== 'IN_PROGRESS') throw { status: 403 };
    const state = demo(id);
    if (action === 'resume' && state.pausedAt) { state.pauseSeconds += Math.max(0, Math.floor((Date.now() - Date.parse(state.pausedAt)) / 1000)); state.pausedAt = null; }
    else if (action !== 'resume') {
      if (action === 'damage') {
        if (!body?.room || !body.cause) throw { status: 400 };
        const item = state.furniture.find(item => item.id === body.furnitureId)?.name ?? body.elementName ?? 'Autre élément';
        const causes:Record<string,string>={unknown:'À déterminer',wear:'Usure',breakage:'Casse',leak:'Fuite',missing:'Manquant'};
        const roomType=body.room.split('_')[0];const labels:Record<string,string>={bedroom:'Chambre',bathroom:'Salle de bain',living:'Salon',kitchen:'Cuisine'};
        const roomName=`${labels[roomType] ?? body.room}${['bedroom','bathroom'].includes(roomType)?` ${body.room.split('_')[1]}`:''}`;
        state.incidents.unshift({ id: -Date.now(), title: `Dégât : ${item}`, description: `${causes[body.cause]} · ${roomName}${body.detail ? ` · ${body.detail}` : ''}`, cause:body.cause,room:body.room,elementCategory:body.elementCategory,elementCode:body.elementCode,elementName:item,status: 'OPEN', date: new Date().toISOString() });
        state.reportedIssueId = state.incidents[0].id;
      }
      state.pausedAt ??= new Date().toISOString();
    }
    useDemoWorkRevision.setState(value => ({ revision: value.revision + 1 }));
    return JSON.parse(JSON.stringify(state));
  },
  attachPhoto: async (id: number, issueId: number, uri: string) => {
    if(id < 0) { const incident=demo(id).incidents.find(value=>value.id===issueId);if(!incident)throw {status:404};incident.photos=[...(incident.photos ?? []),uri];return; }
    const form=new FormData();form.append('photos',{uri,type:'image/jpeg',name:`baitly-damage-${issueId}-${uri.split('/').at(-1)?.replace(/[^a-zA-Z0-9.]/g,'').slice(-100) || 'photo.jpg'}`} as unknown as Blob);
    await apiClient.upload(`/mobile/missions/${id}/damage/${issueId}/photos`,form);
  },
  photos: async (id: number, issueId: number): Promise<string[]> => id<0 ? demo(id).incidents.find(value=>value.id===issueId)?.photos ?? [] : apiClient.get(`/mobile/missions/${id}/damage/${issueId}/photos`),
};

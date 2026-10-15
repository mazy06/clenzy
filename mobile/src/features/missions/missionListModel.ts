import type { MobileMission } from './api';
export type MissionGroup = 'running'|'upcoming'|'review'|'finished'|'cancelled';
export type MissionListRow = {kind:'heading';key:string;group:MissionGroup;count:number}|{kind:'mission';key:string;mission:MobileMission;group:MissionGroup};
export function missionGroup(status:string):MissionGroup{
  if(status==='IN_PROGRESS')return 'running';
  if(status==='AWAITING_VALIDATION')return 'review';
  if(status==='COMPLETED')return 'finished';
  if(status==='CANCELLED')return 'cancelled';
  return 'upcoming';
}
export function missionListRows(missions:MobileMission[]):MissionListRow[]{
  return (['running','upcoming','review','finished','cancelled'] as MissionGroup[]).flatMap(group=>{
    const items=missions.filter(item=>missionGroup(item.status)===group);
    return items.length?[{kind:'heading' as const,key:`group:${group}`,group,count:items.length},...items.map(mission=>({kind:'mission' as const,key:`mission:${mission.id}`,mission,group}))]:[];
  });
}

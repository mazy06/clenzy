import { apiClient } from '@/api/apiClient';
import { demoWorkDetail } from './baitlyDemoWork';
import { useBaitlyDemoProfile } from '@/config/baitlyDemoProfileState';
export interface MissionDoor {deviceId:number;name:string;status:string;code?:string|null;validFrom?:string;validUntil?:string}
const prepared=new Map<string,MissionDoor[]>();
function demo(id:number){demoWorkDetail(id);return `${useBaitlyDemoProfile.getState().key}:${id}`;}
export const missionDoorApi={
  list:async(id:number):Promise<MissionDoor[]>=>id<0?prepared.get(demo(id))??[{deviceId:-1,name:'Porte d’entrée · Démo',status:'NOT_PREPARED'}]:apiClient.get(`/mobile/missions/${id}/door-access`),
  prepare:async(id:number):Promise<MissionDoor[]>=>{
    if(id>=0)return apiClient.post(`/mobile/missions/${id}/door-access`);
    const key=demo(id);if(!prepared.has(key))prepared.set(key,[{deviceId:-1,name:'Porte d’entrée · Démo',status:'ACTIVE',code:'482915',validFrom:new Date(Date.now()-30*60000).toISOString(),validUntil:new Date(Date.now()+90*60000).toISOString()}]);return prepared.get(key)!;
  },
};

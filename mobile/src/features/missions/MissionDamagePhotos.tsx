import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { safetyApi } from './baitlySafetyApi';
import { MissionPropertyPhotos } from './MissionPropertyPhotos';
export function MissionDamagePhotos({id,issueId}:{id:number;issueId:number}) {
  const scope=useBaitlyScope();const query=useQuery({queryKey:[...scope,'mission-damage-photos',id,issueId],queryFn:()=>safetyApi.photos(id,issueId)});
  return <MissionPropertyPhotos photos={query.data ?? []} demo={id<0}/>;
}

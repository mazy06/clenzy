import React from 'react';
import { useQuery } from '@tanstack/react-query';
import PhotoGallery from '../../components/PhotoGallery';
import { baitlyMissionSafetyApi } from '../../services/api/baitlyMissionSafetyApi';
export function BaitlyIncidentPhotos({id,issueId}:{id:number;issueId:number}) {
  const query=useQuery({queryKey:['baitly-incident-photos',id,issueId],queryFn:()=>baitlyMissionSafetyApi.photos(id,issueId)});
  if(!query.data?.length)return null;
  return <PhotoGallery photos={query.data} columns={3}/>;
}

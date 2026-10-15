import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { BaitlyButton, BaitlyNotice, BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import { missionDoorApi } from './missionDoorApi';
export function MissionDoorAccess({id}:{id:number}){
  const {t,i18n}=useTranslation('mobileV1');const c=useBaitlyTheme();const scope=useBaitlyScope();const {isConnected}=useNetworkStatus();
  const query=useQuery({queryKey:[...scope,'mission-door-access',id],queryFn:()=>missionDoorApi.list(id),gcTime:0,retry:false,refetchOnMount:'always'});
  const [busy,setBusy]=useState(false);const [failed,setFailed]=useState(false);const flight=useRef(false);
  // Hide an expired PIN even when the arrival screen remains open.
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  async function prepare(){if(flight.current||id>=0&&!isConnected)return;flight.current=true;setBusy(true);setFailed(false);
    try{await missionDoorApi.prepare(id);await query.refetch();}catch{setFailed(true);await query.refetch();}finally{flight.current=false;setBusy(false);}}
  if(query.isPending)return null;
  if(query.isError)return <BaitlyNotice>{t('doorLoadFailed')}<BaitlyButton secondary title={t('verify')} onPress={()=>{void query.refetch();}}/></BaitlyNotice>;
  if(!query.data?.length)return null;
  return <View style={{padding:16,borderRadius:18,backgroundColor:c.surface,gap:12}}>
    <View style={{flexDirection:'row',gap:8,alignItems:'center'}}><Reicon name="key-outline" size={22} color={c.ink}/><BaitlyText style={{fontWeight:'600',flex:1}}>{t('doorMissionCode')}</BaitlyText></View>
    {query.data.map(door=>{const expired=door.validUntil&&Date.parse(door.validUntil)<=now;const status=expired?'EXPIRED':door.status;return <View key={door.deviceId} style={{gap:5}}>
      <BaitlyText muted variant="meta">{door.name}</BaitlyText>
      {status==='ACTIVE'&&door.code?<BaitlyText selectable style={{fontSize:30,lineHeight:40,fontWeight:'600',letterSpacing:4,fontVariant:['tabular-nums']}}>{door.code}</BaitlyText>:<BaitlyText muted variant="meta">{t(`doorStatus.${status}`)}</BaitlyText>}
      {door.validFrom&&door.validUntil?<BaitlyText muted variant="meta" style={{fontVariant:['tabular-nums']}}>{new Date(door.validFrom).toLocaleString(i18n.language,{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})} → {new Date(door.validUntil).toLocaleTimeString(i18n.language,{hour:'2-digit',minute:'2-digit'})}</BaitlyText>:null}
    </View>;})}
    {query.data.some(door=>door.status==='NOT_PREPARED')?<BaitlyButton secondary title={t('doorPrepare')} busy={busy} disabled={id>=0&&!isConnected||failed} onPress={()=>{void prepare();}}/>:query.data.some(door=>door.status==='PENDING')?<BaitlyButton secondary title={t('verify')} onPress={()=>{void query.refetch();}}/>:null}
    {failed?<BaitlyNotice error>{t('doorLoadFailed')}</BaitlyNotice>:null}
  </View>;
}

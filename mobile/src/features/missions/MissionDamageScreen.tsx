import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { BaitlyScreen, BaitlyButton, BaitlyLoading, BaitlyEmpty, BaitlyText } from '@/design-system/components';
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { workApi } from './api';
import { safetyApi } from './baitlySafetyApi';
import { MissionSafety, type MissionSafetyHandle } from './MissionSafety';
import { Alert, View } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaitlyHeader, BaitlyHeaderAction } from '@/design-system/BaitlyHeader';
import { useBaitlyTheme } from '@/design-system/theme';
export function MissionDamageScreen({ route, navigation }: NativeStackScreenProps<BaitlyStackParams,'MissionDamage'>) {
  const id = route.params.interventionId; const scope=useBaitlyScope(); const cache=useQueryClient(); const { t }=useTranslation('mobileV1'); const {isConnected}=useNetworkStatus();
  const colors=useBaitlyTheme();const [searchOpen,setSearchOpen]=useState(false);
  useEffect(()=>{navigation.setOptions({header:()=> <SafeAreaView edges={['top']} style={{backgroundColor:colors.background,paddingHorizontal:16}}><BaitlyHeader start={<BaitlyHeaderAction icon="chevron-back" label={t('back')} onPress={()=>navigation.goBack()}/>} end={<BaitlyHeaderAction icon="search" label={t('damageFindElement')} onPress={()=>setSearchOpen(value=>!value)}/>}/></SafeAreaView>});},[navigation,colors.background,t]);
  const work=useQuery({queryKey:[...scope,'mission',id],queryFn:()=>workApi.detail(id)});
  const safety=useQuery({queryKey:[...scope,'mission-safety',id],queryFn:()=>safetyApi.detail(id)});
  const form=useRef<MissionSafetyHandle>(null);const submitted=useRef(false);const [status,setStatus]=useState({ready:false,busy:false,committed:false,dirty:false});
  usePreventRemove(status.busy||status.dirty,({data})=>{
    if(submitted.current){navigation.dispatch(data.action);return;}
    if(status.busy)return;
    Alert.alert(t('damageTitle'),t('damageDiscard'),[{text:t('stay'),style:'cancel'},{text:t('leave'),style:'destructive',onPress:()=>navigation.dispatch(data.action)}]);
  });
  return <BaitlyScreen footer={safety.data&&work.data?<BaitlyButton title={t(status.committed?'damageSendPhotos':'damageAndPause')} busy={status.busy} disabled={!status.ready} onPress={()=>{void form.current?.send();}}/>:undefined}>
    <View style={{gap:4}}><BaitlyText style={{fontSize:22,lineHeight:28,fontWeight:'600'}}>{t('damageTitle')}</BaitlyText>
    {work.data?.mission.propertyName?<BaitlyText muted variant="meta">{work.data.mission.propertyName}</BaitlyText>:null}</View>
    {work.isPending || safety.isPending ? <BaitlyLoading/> : work.isError || safety.isError ? <BaitlyEmpty title={t('loadFailed')} retry={()=>{void work.refetch();void safety.refetch();}}/> : safety.data && work.data ?
      <MissionSafety ref={form} onStatus={setStatus} searchOpen={searchOpen} reportOnly id={id} rooms={work.data.rooms ?? []} state={safety.data} disabled={!work.data.canExecute || work.data.mission.status!=='IN_PROGRESS' || (id>=0&&!isConnected)}
        onChange={async()=>{await cache.invalidateQueries({queryKey:[...scope,'mission-safety',id]});await cache.invalidateQueries({queryKey:[...scope,'mission',id]});}} onSuccess={()=>{submitted.current=true;navigation.goBack();}} /> : null}
  </BaitlyScreen>;
}

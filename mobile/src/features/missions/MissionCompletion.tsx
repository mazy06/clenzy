import React, { useRef } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { BaitlyButton, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import type { MobileMission } from './api';
import { missionTiming, timerText } from './missionTimingModel';
export function MissionCompletion({mission, timing, photos, busy, automatic, onHome}:{mission:MobileMission;timing?:MobileMission;photos:number;busy:boolean;automatic:boolean;onHome:()=>void}) {
  const {t}=useTranslation('mobileV1');const c=useBaitlyTheme();const finishedAt=useRef(Date.now());
  const elapsed=missionTiming(timing ?? mission,finishedAt.current).elapsed;
  return <BaitlyScreen scroll={false} footer={<BaitlyButton title={t('missionBackHome')} disabled={busy} onPress={onHome}/>}>
    <View style={{flex:1,justifyContent:'center',paddingHorizontal:24,gap:24}}>
      <View style={{alignItems:'center',gap:12}}>
        <Image source={require('../../../assets/baitly/mission-steps/work-review.webp')} style={{width:136,height:136}} contentFit="contain" accessible={false}/>
        <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Reicon name="checkmark-circle" size={22} color={c.success}/><BaitlyText accessibilityRole="header" style={{fontSize:23,lineHeight:29,fontWeight:'600',textAlign:'center',flexShrink:1}}>{t(mission.status==='COMPLETED'?'missionApproved':'missionFinished')}</BaitlyText></View>
        <BaitlyText muted variant="meta" style={{textAlign:'center'}}>{t(`missionStatus.${mission.status}`)}</BaitlyText>
      </View>
      <View style={{gap:6,alignItems:'center'}}><BaitlyText style={{fontWeight:'600',textAlign:'center'}}>{mission.propertyName ?? mission.title}</BaitlyText>
        {mission.propertyName?<BaitlyText muted variant="meta" style={{textAlign:'center'}}>{mission.title}</BaitlyText>:null}
      </View>
      <View style={{flexDirection:'row',justifyContent:'center',gap:24}}>
        {elapsed!==undefined?<View style={{flexDirection:'row',gap:6,alignItems:'center'}}><Reicon name="time-outline" size={18} color={c.secondary}/><BaitlyText variant="meta" style={{fontVariant:['tabular-nums']}}>{timerText(elapsed)}</BaitlyText></View>:null}
        {photos>0?<View style={{flexDirection:'row',gap:6,alignItems:'center'}}><Reicon name="images-outline" size={18} color={c.secondary}/><BaitlyText variant="meta" style={{fontVariant:['tabular-nums']}}>{photos}</BaitlyText></View>:null}
      </View>
      {automatic?<BaitlyText muted variant="meta" style={{textAlign:'center'}} accessibilityLiveRegion="polite">{t('missionReturningHome')}</BaitlyText>:null}
    </View>
  </BaitlyScreen>;
}

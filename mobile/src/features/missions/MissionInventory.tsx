import React from 'react';
import { Pressable, View } from 'react-native';
import { BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import { FurnitureThumbnail } from './FurnitureThumbnail';
import type { MissionSafetyState } from './baitlySafetyApi';

export function MissionInventory({items,checked,disabled,onToggle}:{items:MissionSafetyState['furniture'];checked:string[];disabled:boolean;onToggle:(id:number)=>void}){
  const c=useBaitlyTheme();
  return <View style={{gap:8}}>{items.map(item=>{const done=checked.includes(`inventory_${item.id}`);return <Pressable key={item.id} accessibilityRole="checkbox" accessibilityLabel={item.name}
    accessibilityState={{checked:done,disabled}} disabled={disabled} onPress={()=>onToggle(item.id)}
    style={({pressed})=>({padding:12,borderRadius:16,flexDirection:'row',alignItems:'center',gap:12,backgroundColor:pressed||done?c.muted:c.surface})}>
    <FurnitureThumbnail name={item.name} catalogKey={item.catalogKey} photoUrl={item.photoUrl} size={52}/>
    <BaitlyText style={{flex:1}}>{item.name}</BaitlyText>
    <Reicon name={done?'checkbox-outline':'square-outline'} size={24} color={done?c.success:c.secondary}/>
  </Pressable>;})}</View>;
}

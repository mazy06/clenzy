import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import catalog from './baitlyFurnitureCatalog.json';
import { Reicon } from '@/icons';
import { useBaitlyTheme } from '@/design-system/theme';
import { baitlyInventorySheets as sheets } from './baitlyInventorySheets';
import { baitlyPrivateImageSource } from '@/api/baitlyMedia';
const normalize=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const demoAliases: Record<string,string>={canape:'sofa-two',table:'dining-table',lit:'double-bed',lavabo:'washbasin'};
const surfaces:Record<string,number>={wall:require('../../../assets/baitly/mission-safety/wall.png'),ceiling:require('../../../assets/baitly/mission-safety/ceiling.png'),floor:require('../../../assets/baitly/mission-safety/floor.png')};
export function FurnitureThumbnail({name,catalogKey,photoUrl,size=42}:{name:string;catalogKey?:string;photoUrl?:string;size?:number}){
  const c=useBaitlyTheme();const entry=catalog.find(value=>value.key===(catalogKey??demoAliases[normalize(name)]))??catalog.find(value=>value.names.some(label=>normalize(label)===normalize(name)));
  if(photoUrl)return <Image source={baitlyPrivateImageSource(photoUrl)} cachePolicy="none" contentFit="contain" style={{width:size,height:size}} accessible={false}/>;
  if(catalogKey&&surfaces[catalogKey])return <Image source={surfaces[catalogKey]} contentFit="contain" style={{width:size,height:size}} accessible={false}/>;
  if(!entry)return <Reicon name="cube-outline" size={size-8} color={c.secondary}/>;
  return <View style={{width:size,height:size,overflow:'hidden'}} accessible={false}><Image source={sheets[entry.sheet]} contentFit="fill" style={{position:'absolute',width:size*4,height:size*4,left:-(entry.slot%4)*size,top:-Math.floor(entry.slot/4)*size}}/></View>;
}

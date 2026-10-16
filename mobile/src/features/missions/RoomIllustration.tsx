import React from 'react';
import { Image } from 'expo-image';
const rooms:Record<string,number>={bedroom:require('../../../assets/baitly/mission-safety/bedroom.png'),bathroom:require('../../../assets/baitly/mission-safety/bathroom.png'),living:require('../../../assets/baitly/mission-safety/living.png'),kitchen:require('../../../assets/baitly/mission-safety/kitchen.png')};
export function RoomIllustration({type,size=52}:{type:string;size?:number}){
  return <Image source={rooms[type]} contentFit="contain" style={{width:size,height:size}} accessible={false}/>;
}

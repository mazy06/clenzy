import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BaitlyButton, BaitlyField, BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import { FurnitureThumbnail } from './FurnitureThumbnail';
import catalog from './baitlyFurnitureCatalog.json';
import type { MissionSafetyState } from './baitlySafetyApi';
import { catalogMatchesRoom, inventoryMatchesRoom } from './damageRoomModel';
export interface DamageElement { key: string; name: string; category: string; inventoryId?: number; catalogKey?: string; photoUrl?: string }
const categories=['inventory','appliance','furniture','electronics','surface','other'] as const;
const families:Record<string,string[]>={appliance:['large-appliances','small-appliances','coffee-drinks','laundry-cleaning','climate'],furniture:['seating','furniture','beds','storage','outdoor-furniture'],electronics:['electronics','lighting','safety-access'],other:['bathroom','fixtures','decor','textiles','kitchen-extras','utensils','cookware','tableware','tableware-details','leisure','baby','garden-pool','tools','accessibility-pets']};
export function DamageElementPicker({items,value,onChange,disabled,room,searchOpen}:{items:MissionSafetyState['furniture'];value:DamageElement;onChange:(value:DamageElement)=>void;disabled:boolean;room:string;searchOpen:boolean}) {
  const {t,i18n}=useTranslation('mobileV1');const c=useBaitlyTheme();const {width,fontScale}=useWindowDimensions();const [category,setCategory]=useState(items.length?'inventory':'appliance');const [search,setSearch]=useState('');const [limit,setLimit]=useState(6);const [gridWidth,setGridWidth]=useState(width-32);
  const columns=fontScale>1.3?2:3;
  useEffect(()=>setLimit(6),[category,room,search]);
  const options=useMemo(()=>{
    const locale=i18n.language.startsWith('ar')?2:i18n.language.startsWith('en')?1:0;
    const values:DamageElement[]=category==='inventory'?items.filter(item=>inventoryMatchesRoom(item,room)).map(item=>({key:`inventory:${item.id}`,name:item.name,inventoryId:item.id,catalogKey:item.catalogKey,photoUrl:item.photoUrl,category})):
      category==='surface'?['wall','ceiling','floor'].map(key=>({key,name:t(`damageSurface.${key}`),catalogKey:key,category})):
      catalog.filter(item=>families[category]?.includes(item.sheet)&&catalogMatchesRoom(item,room)).map(item=>({key:item.key,name:item.names[locale],catalogKey:item.key,category}));
    if(category==='other')values.unshift({key:'other',name:t('damageOther'),category:'other'});
    const words=search.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    return values.filter(item=>item.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(words));
  },[category,items,i18n.language,search,t,room]);
  return <View style={{gap:8}}>
    <BaitlyText style={{fontWeight:'600'}}>{t('damageFurniture')}</BaitlyText>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6}}>{categories.filter(key=>key!=='inventory'||items.length).map(key=><Pressable key={key} accessibilityRole="tab" accessibilityState={{selected:category===key,disabled}} disabled={disabled} onPress={()=>{setCategory(key);setSearch('');}} style={{paddingHorizontal:10,minHeight:38,justifyContent:'center',borderRadius:10,backgroundColor:category===key?c.ink:c.surface}}><BaitlyText variant="meta" style={{color:category===key?c.background:c.ink}}>{t(`damageCategory.${key}`)}</BaitlyText></Pressable>)}</ScrollView>
    {searchOpen?<BaitlyField label={t('damageFindElement')} value={search} onChangeText={setSearch} editable={!disabled}/>:null}
    <View onLayout={event=>setGridWidth(event.nativeEvent.layout.width)} style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
      {!room?<BaitlyText muted variant="meta">{t('damageChooseRoom')}</BaitlyText>:!options.length?<BaitlyText muted variant="meta">{t('damageNoElement')}</BaitlyText>:options.slice(0,limit).map(item=><Pressable key={item.key} accessibilityRole="radio" accessibilityLabel={item.name} accessibilityState={{selected:value.key===item.key,disabled}} disabled={disabled} onPress={()=>onChange(item)} style={({pressed})=>({width:(gridWidth-(columns-1)*8)/columns,minHeight:98,padding:8,gap:6,borderRadius:16,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:value.key===item.key?c.primary:c.border,backgroundColor:pressed||value.key===item.key?c.muted:c.surface})}>
        <View style={{width:42,height:42,alignItems:'center',justifyContent:'center',transform:[{scale:1.35}]}}><FurnitureThumbnail name={item.name} catalogKey={item.catalogKey} photoUrl={item.photoUrl}/></View><BaitlyText variant="meta" numberOfLines={2} style={{textAlign:'center',fontWeight:value.key===item.key?'600':'400'}}>{item.name}</BaitlyText>
        {value.key===item.key?<View style={{position:'absolute',top:5,right:5}}><Reicon name="checkmark-circle" size={16} color={c.ink}/></View>:null}
      </Pressable>)}
    </View>
    {room&&options.length>limit?<BaitlyButton secondary title={t('damageMoreElements',{count:options.length-limit})} disabled={disabled} onPress={()=>setLimit(value=>value+6)}/>:null}
    {value.key&&value.key!=='other'?<BaitlyText muted variant="meta">{value.name}</BaitlyText>:null}
  </View>;
}

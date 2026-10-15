import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Image as NativeImage, Linking, Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BaitlyButton, BaitlyField, BaitlyNotice, BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import { safetyApi, type MissionSafetyState } from './baitlySafetyApi';
import type { MissionRoom } from './api';
import { pickFromGallery, takePhoto } from '@/services/camera/cameraService';
import { Image } from 'expo-image';
import { DamageElementPicker, type DamageElement } from './DamageElementPicker';
import { RoomIllustration } from './RoomIllustration';
export interface MissionSafetyHandle { send: () => Promise<void> }
export const MissionSafety = forwardRef<MissionSafetyHandle, { id: number; rooms: MissionRoom[]; state: MissionSafetyState; disabled: boolean; onChange: () => Promise<unknown>; onReport?: () => void; reportOnly?: boolean; onSuccess?: () => void; searchOpen?: boolean; onStatus?: (value: { ready: boolean; busy: boolean; committed: boolean; dirty: boolean }) => void }>(function MissionSafety({ id, rooms, state, disabled, onChange, onReport, reportOnly = false, onSuccess, onStatus,searchOpen=false },ref) {
  const { t } = useTranslation('mobileV1'); const c = useBaitlyTheme();
  const [open, setOpen] = useState(reportOnly); const [cause, setCause] = useState('unknown'); const [room, setRoom] = useState('');
  const [element,setElement]=useState<DamageElement>({key:'',name:'',category:'other'});const [detail, setDetail] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]); const [committed, setCommitted] = useState(false);
  const issueId = useRef<number | undefined>(undefined);
  const [uncertain, setUncertain] = useState(false);
  const [noteOpen,setNoteOpen]=useState(false);
  const ready=!!room&&!!element.key&&!busy&&!disabled&&!uncertain;
  const contacts=state.contacts.filter(contact=>!!contact.phone?.trim());
  const dirty=!!room||!!detail||photos.length>0||cause!=='unknown'||!!element.key;
  useEffect(()=>{onStatus?.({ready,busy,committed,dirty});},[ready,busy,committed,dirty,onStatus]);
  useImperativeHandle(ref,()=>({send:()=>action('damage')}));
  async function photo(camera: boolean) {
    const result = await (camera ? takePhoto() : pickFromGallery());
    if (result) setPhotos(values => [...values, result.uri]);
  }
  async function action(kind: 'pause' | 'resume' | 'damage') {
    if (busy || disabled) return; setBusy(true); setError(false);
    try {
      if (kind !== 'damage' || !committed) { const result=await safetyApi.change(id, kind, { cause, room, furnitureId: element.inventoryId, detail, elementName:element.name,elementCategory:element.category,elementCode:element.key }); if(kind === 'damage') {issueId.current=result.reportedIssueId;setCommitted(true);} }
      if(kind === 'damage') {
        for(const uri of photos) {
          if(issueId.current===undefined) throw new Error('Missing issue reference');
          await safetyApi.attachPhoto(id,issueId.current,uri);
          setPhotos(values => values.filter(value => value !== uri));
        }
      }
      setOpen(false); await onChange(); if(kind === 'damage') onSuccess?.();
    }
    catch { setError(true); if(kind === 'damage' && !issueId.current) setUncertain(true); await onChange(); } finally { setBusy(false); }
  }
  function choices(values: { key: string; label: string }[], selected: string, select: (key: string) => void) {
    return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>{values.map(value => <Pressable key={value.key} accessibilityRole="radio" accessibilityState={{ selected: selected === value.key, disabled: busy || disabled || committed }} disabled={busy || disabled || committed}
      onPress={() => select(value.key)} style={({ pressed }) => ({ paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderRadius: 12, backgroundColor: selected === value.key ? c.ink : pressed ? c.muted : c.surface })}>
      <BaitlyText variant="meta" style={{ color: selected === value.key ? c.background : c.ink }}>{value.label}</BaitlyText></Pressable>)}</ScrollView>;
  }
  function tile(key:string,label:string,selected:boolean,onPress:()=>void,visual:React.ReactNode){
    return <Pressable key={key} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{selected,disabled:busy||disabled||committed}} disabled={busy||disabled||committed} onPress={onPress}
      style={({pressed})=>({width:98,minHeight:92,padding:8,gap:6,borderRadius:16,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:selected?c.primary:c.border,backgroundColor:selected||pressed?c.muted:c.surface})}>
      <View style={{width:52,height:52,alignItems:'center',justifyContent:'center',transform:[{scale:1.2}]}}>{visual}</View><BaitlyText variant="meta" style={{textAlign:'center',fontWeight:selected?'600':'400'}} numberOfLines={2}>{label}</BaitlyText>
      {selected?<View style={{position:'absolute',top:5,right:5}}><Reicon name="checkmark-circle" size={16} color={c.ink}/></View>:null}
    </Pressable>;
  }
  return <View style={{ gap: 16 }}>
    {!reportOnly ? <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ flex: 1 }}><BaitlyButton secondary title={t('damageTitle')} disabled={busy || disabled} onPress={() => onReport ? onReport() : setOpen(!open)} /></View>
      <View style={{ flex: 1 }}><BaitlyButton secondary title={t(state.pausedAt ? 'missionResume' : 'missionPause')} disabled={busy || disabled} onPress={() => { void action(state.pausedAt ? 'resume' : 'pause'); }} /></View>
    </View> : null}
    {state.pausedAt ? <BaitlyNotice>{t('missionPaused')}</BaitlyNotice> : null}
    {open ? <View style={{ gap: 16 }}>
      <View style={{gap:8}}><BaitlyText style={{fontWeight:'600'}}>{t('damageCause')}</BaitlyText>
      {choices(['unknown', 'wear', 'breakage', 'leak', 'missing'].map(key => ({ key, label: t(`damageCause.${key}`) })), cause, setCause)}</View>
      <View style={{gap:8}}><BaitlyText style={{fontWeight:'600'}}>{t('damageRoom')}</BaitlyText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{rooms.map(value=>tile(value.id,t(`inspectionRoom.${value.type}`,{number:value.number}),room===value.id,()=>{if(room!==value.id){setRoom(value.id);setElement({key:'',name:'',category:'other'});}},<RoomIllustration type={value.type}/>))}</ScrollView></View>
      <DamageElementPicker items={state.furniture} value={element} onChange={setElement} disabled={busy||disabled||committed} room={room} searchOpen={searchOpen}/>
      <View style={{gap:8}}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><BaitlyText style={{fontWeight:'600'}}>{t('executionPhotos')} · {photos.length}/10</BaitlyText><Pressable accessibilityRole="button" accessibilityLabel={t('executionGallery')} disabled={busy||photos.length>=10} onPress={()=>{void photo(false).catch(()=>setError(true));}} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><Reicon name="images-outline" size={23} color={c.ink}/></Pressable></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('executionCamera')} disabled={busy||photos.length>=10} onPress={()=>{void photo(true).catch(()=>setError(true));}} style={{width:92,height:92,alignItems:'center',justifyContent:'center',gap:6,borderWidth:1,borderStyle:'dashed',borderColor:c.secondary,borderRadius:16}}><Reicon name="camera-outline" size={28} color={c.ink}/><Reicon name="add" size={18} color={c.secondary}/></Pressable>
        {photos.map((uri,index)=><View key={`${uri}:${index}`}><Image source={{uri}} style={{width:92,height:92,borderRadius:16}} contentFit="cover"/><Pressable accessibilityRole="button" accessibilityLabel={t('removePhoto')} disabled={busy} onPress={()=>setPhotos(values=>values.filter((_,i)=>i!==index))} style={{position:'absolute',right:0,top:0,width:44,height:44,alignItems:'center',justifyContent:'center',backgroundColor:c.surface,borderRadius:12}}><Reicon name="close" size={18} color={c.ink}/></Pressable></View>)}
      </ScrollView>
      {id<0 ? <Pressable accessibilityRole="button" disabled={busy||photos.length>=10} onPress={()=>{const uri=NativeImage.resolveAssetSource(require('../../../assets/baitly/providers/maintenance.jpg')).uri;setPhotos(values=>[...values,uri]);}} style={{minHeight:44,justifyContent:'center'}}><BaitlyText muted variant="meta">+ {t('executionDemoPhoto')}</BaitlyText></Pressable>:null}
      </View>
      {noteOpen?<BaitlyField label={t('damageDetail')} value={detail} onChangeText={setDetail} maxLength={1000} editable={!busy&&!committed} multiline/>:<Pressable accessibilityRole="button" onPress={()=>setNoteOpen(true)} style={{minHeight:44,flexDirection:'row',gap:8,alignItems:'center'}}><Reicon name="chatbox-outline" size={19} color={c.secondary}/><BaitlyText muted variant="meta">{t('damageDetail')}</BaitlyText></Pressable>}
      {!reportOnly?<BaitlyButton title={t(committed ? 'damageSendPhotos' : 'damageAndPause')} disabled={!ready} busy={busy} onPress={() => { void action('damage'); }} />:null}
    </View> : null}
    {(open || state.pausedAt) && contacts.length ? <View style={{ gap: 6 }}>
      {contacts.map((contact, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={`${t(`missionContact.${contact.role}`)} ${contact.name}`} disabled={!contact.phone}
        onPress={() => { void Linking.openURL(`tel:${contact.phone!.replace(/[^+0-9]/g, '')}`).catch(() => setError(true)); }}
        style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 48, paddingHorizontal: 12, backgroundColor: c.surface, borderRadius: 12 }}>
        <Reicon name="call-outline" size={20} color={c.ink} /><View style={{ flex: 1 }}><BaitlyText>{t(`missionContact.${contact.role}`)}</BaitlyText><BaitlyText muted variant="meta">{contact.name}</BaitlyText></View>
        <BaitlyText muted variant="meta">{contact.phone ?? t('missionPhoneMissing')}</BaitlyText></Pressable>)}
    </View> : null}
    {error ? <BaitlyNotice error>{t('damageVerify')}</BaitlyNotice> : null}
  </View>;
});

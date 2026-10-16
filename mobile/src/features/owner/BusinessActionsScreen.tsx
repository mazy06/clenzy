import { baitlyPrivateImageSource } from '@/api/baitlyMedia';
import { Image } from 'expo-image';
import { PublicAvatar } from '@/features/marketplace/PublicAvatar';
import { MissionCard } from '@/features/missions/MissionCard';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import * as WebBrowser from 'expo-web-browser';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { apiClient, type PaginatedResponse } from '@/api/apiClient';
import { interventionsApi } from '@/api/endpoints/interventionsApi';
import { reviewsApi } from '@/api/endpoints/reviewsApi';
import { BaitlyButton, BaitlyEmpty, BaitlyField, BaitlyLoading, BaitlyNotice, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { canUseBaitlyDemo, useBaitlyDataMode } from '@/config/baitlyDataMode';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { demoWorkList } from '@/features/missions/baitlyDemoWork';
import { planningDateKey } from '@/screens/manager/planningModel';
import { baitlyDemoClients } from '@/features/marketplace/baitlyDemoClients';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';

export type BusinessActionKind = 'urgent' | 'today' | 'upcoming' | 'completion' | 'unpaid' | 'rating';
interface Item { id: string | number; title: string; subtitle?: string; detail?: string; reviewText?: string; response?: string | null; missionId?: number; payment?: boolean; paymentType?: string; canCollect?: boolean; referenceId?: number; status?: string; type?: string; date?: string; avatarUrl?: string | null; portraitIndex?: number }
export function BusinessActionsScreen({ route, navigation }: NativeStackScreenProps<BaitlyStackParams, 'BusinessActions'>) {
  const c = useBaitlyTheme();
  const kind = route.params.kind; const { t, i18n } = useTranslation('mobileV1'); const scope = useBaitlyScope();
  const mode = useBaitlyDataMode(state => state.mode); const demo = canUseBaitlyDemo() && mode === 'demo';
  const cache = useQueryClient(); const [selected, setSelected] = useState<string | number | null>(null); const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  const [sampleResponses, setSampleResponses] = useState<Record<string,string>>({});
  const key = [...scope, 'business-actions', kind];
  const money = (amount: number, currency: string) => { try { return new Intl.NumberFormat(i18n.language, { style: 'currency', currency }).format(amount); } catch { return '–'; } };
  const query = useInfiniteQuery({ queryKey: key, initialPageParam: 0, retry: false,
    queryFn: async ({ pageParam, signal }) => {
      let content: Item[]; let number = pageParam; let totalPages = 1;
      if (demo) {
        if (kind === 'rating') content = baitlyDemoClients.flatMap(client => client.properties).flatMap(property => property.guestReviews.map((review,index) => ({ id: -10000-index, title: review.name, subtitle: property.name, detail: `${review.rating} / 5`, reviewText: review.comment, portraitIndex: review.portraitIndex, date: review.date }))).slice(0, 12).map((item,index)=>({...item,id:-10000-index}));
        else if (kind === 'unpaid') content = demoWorkList().slice(0,3).map((mission,index)=>({id:mission.id,title:mission.title,subtitle:mission.propertyName,detail:money(420+index*180,'MAD'),missionId:mission.id,payment:true}));
        else content = demoWorkList().filter(item => kind === 'completion' ? item.status === 'COMPLETED' : kind === 'urgent' ? ['PENDING','IN_PROGRESS'].includes(item.status) : kind === 'upcoming' ? !['COMPLETED','CANCELLED','AWAITING_VALIDATION'].includes(item.status) : true).slice(0,kind === 'urgent'?2:undefined).map(item=>({id:item.id,title:item.title,subtitle:item.propertyName,detail:t(`missionStatus.${item.status}`),missionId:item.id,status:item.status,type:item.type,date:item.scheduledDate}));
      } else if (kind === 'rating') {
        const page = await reviewsApi.getAll({page:pageParam,size:20}); number = page.number; totalPages = page.totalPages;
        content = page.content.map(review=>({id:review.id,title:review.guestName,detail:`${review.rating} / 5`,reviewText:review.reviewText,response:review.hostResponse,avatarUrl:review.guestAvatarUrl,date:review.reviewDate}));
      } else if (kind === 'unpaid') {
        const page = await apiClient.get<PaginatedResponse<{ id:number; referenceId:number; description:string; propertyName:string; currency:string; amount:number; payableAmount?:number; canCollect:boolean; type:string }>>('/payments/history',{params:{page:pageParam,size:20,status:'PENDING'},signal}); number=page.number;totalPages=page.totalPages;
        content=page.content.map(payment=>({id:`${payment.type}:${payment.referenceId}`,title:payment.description,subtitle:payment.propertyName,detail:money(payment.payableAmount ?? payment.amount,payment.currency),missionId:payment.type==='INTERVENTION'?payment.referenceId:undefined,payment:true,paymentType:payment.type,canCollect:payment.canCollect,referenceId:payment.referenceId}));
      } else {
        const start=new Date(); const end=new Date(); if(kind==='upcoming')end.setDate(end.getDate()+7);
        const params={page:pageParam,size:20,priority:kind==='urgent'?'URGENT':undefined,status:kind==='completion'?'COMPLETED':undefined,
          startDate:kind==='today'||kind==='upcoming'?planningDateKey(start):undefined,endDate:kind==='today'||kind==='upcoming'?planningDateKey(end):undefined};
        const page=kind==='urgent'?await Promise.all(['PENDING','IN_PROGRESS'].map(status=>interventionsApi.getAll({...params,status}))).then(pages=>({...pages[0],content:pages.flatMap(page=>page.content),totalPages:Math.max(...pages.map(page=>page.totalPages))})):await interventionsApi.getAll(params); number=page.number;totalPages=page.totalPages;
        content=page.content.map(item=>({id:item.id,title:item.title,subtitle:item.propertyName,detail:t(`missionStatus.${item.status}`),missionId:item.id,status:item.status,type:item.type,date:item.scheduledDate}));
      }
      return {content,number,totalPages};
    }, getNextPageParam: page=>page.number+1<page.totalPages?page.number+1:undefined,
  });
  async function respond(id:string | number) {
    if(lock.current||!response.trim())return;lock.current=true;setBusy(true);setError('');
    try { if(demo)setSampleResponses(current=>({...current,[id]:response.trim()}));else { await reviewsApi.respond(Number(id),response.trim());await cache.invalidateQueries({queryKey:key}); } setSelected(null);setResponse(''); }
    catch {setError(t('sendFailed'));} finally {lock.current=false;setBusy(false);}
  }
  async function pay(item:Item) {
    if(demo) { navigation.navigate('Mission',{interventionId:item.missionId!}); return; }
    if(item.paymentType==='INTERVENTION') { navigation.navigate('PaymentCheckout',{interventionId:item.referenceId!}); return; }
    if(item.paymentType==='RESERVATION') { navigation.navigate('ReservationDetail',{reservationId:item.referenceId!,initialTab:'paiement'}); return; }
    if(item.paymentType!=='SERVICE_REQUEST'||lock.current||!item.canCollect)return;
    lock.current=true;setBusy(true);setError('');
    try { const session=await apiClient.post<{checkoutUrl:string}>(`/service-requests/${item.referenceId}/create-payment-session`); const url=new URL(session.checkoutUrl); if(url.protocol!=='https:')throw new Error('Invalid payment URL'); await WebBrowser.openBrowserAsync(url.toString()); await query.refetch(); }
    catch {setError(t('sendFailed'));}finally{lock.current=false;setBusy(false);}
  }
  return <BaitlyScreen title={t(`business.${kind}`)}>
    {demo?<BaitlyNotice>{t('homeDemo')}</BaitlyNotice>:null}
    {query.isPending?<BaitlyLoading/>:query.isError?<BaitlyEmpty title={t('loadFailed')} retry={()=>{void query.refetch();}}/>:null}
    {error?<BaitlyNotice error>{error}</BaitlyNotice>:null}
    {query.data?.pages.flatMap(page=>page.content).map(item => !item.payment && kind !== 'rating' ? <MissionCard key={item.id} title={item.title} property={item.subtitle} status={item.status ?? 'PENDING'} date={item.date} compact={kind === 'completion'} artwork={item.type?.includes('CLEAN') ? require('../../../assets/baitly/sectors/cleaning.webp') : item.type?.includes('LAUNDRY') ? require('../../../assets/baitly/sectors/sector-laundry.webp') : require('../../../assets/baitly/sectors/sector-maintenance.webp')} onPress={()=>navigation.navigate('Mission',{interventionId:item.missionId!})} /> : <View key={item.id} style={[styles.actionCard,{backgroundColor:c.surface,borderColor:c.border}]}>
      <View style={[styles.row,{flexDirection:i18n.dir()==='rtl'?'row-reverse':'row'}]}>
        {kind === 'rating' ? item.avatarUrl ? <Image source={baitlyPrivateImageSource(item.avatarUrl)} style={{width:44,height:44,borderRadius:22}} contentFit="cover" cachePolicy="none" accessible={false}/> : <PublicAvatar demo={demo} portraitIndex={item.portraitIndex} size={44}/> : <Image source={require('../../../assets/baitly/sectors/sector-accounting.webp')} style={styles.paymentImage} contentFit="contain" enforceEarlyResizing accessible={false}/>}
        <View style={{flex:1,gap:4}}><BaitlyText style={styles.title} numberOfLines={2}>{item.title}</BaitlyText>{item.subtitle?<BaitlyText muted variant="meta" numberOfLines={1}>{item.subtitle}</BaitlyText>:null}</View>
        {kind==='rating'?<View style={styles.rating}><Reicon name="star" size={14} color={c.warning}/><BaitlyText variant="meta" style={styles.numeric}>{item.detail}</BaitlyText></View>:null}
      </View>
      {item.payment?<BaitlyText style={styles.amount}>{item.detail}</BaitlyText>:item.date?<BaitlyText muted variant="meta">{item.date}</BaitlyText>:null}
      {item.reviewText?<BaitlyText>{item.reviewText}</BaitlyText>:null}
      {item.response||sampleResponses[item.id]?<BaitlyNotice>{sampleResponses[item.id]??item.response}</BaitlyNotice>:kind==='rating'?<BaitlyButton secondary title={t('business.reply')} onPress={()=>{setSelected(item.id);setResponse('');}}/>:null}
      {selected===item.id?<View style={{gap:10,paddingTop:8}}><BaitlyField label={t('business.reply')} value={response} onChangeText={setResponse} multiline maxLength={4000}/><BaitlyButton title={t('send')} busy={busy} disabled={!response.trim()} onPress={()=>{void respond(item.id);}}/><BaitlyButton secondary title={t('cancel')} disabled={busy} onPress={()=>{setSelected(null);setResponse('');}}/></View>:null}
      {item.payment && (demo || item.canCollect || item.paymentType==='RESERVATION') ? <BaitlyButton title={t(demo?'viewMission':'business.pay')} disabled={busy} busy={busy} onPress={()=>{void pay(item);}}/>:null}
    </View>)}
    {!query.isPending&&!query.isError&&!query.data?.pages.some(page=>page.content.length)?<BaitlyEmpty title={t('business.noActions')}/>:null}
    {query.hasNextPage?<BaitlyButton secondary title={t('loadMore')} busy={query.isFetchingNextPage} onPress={()=>{void query.fetchNextPage();}}/>:null}
  </BaitlyScreen>;
}

const styles=StyleSheet.create({actionCard:{padding:15,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,gap:12},row:{alignItems:'center',gap:10},title:{fontSize:17,lineHeight:23,fontWeight:'600'},paymentImage:{width:54,height:58},amount:{fontSize:26,lineHeight:33,fontWeight:'600',fontVariant:['tabular-nums']},rating:{flexDirection:'row',alignItems:'center',gap:4},numeric:{fontVariant:['tabular-nums']}});

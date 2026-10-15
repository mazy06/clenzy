import { MissionReviewRecap } from '@/features/missions/MissionReviewRecap';
import { AnomalyForm } from '@/features/missions/AnomalyForm';
import { Discussion } from '@/features/messages/Discussion';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CommonActions, usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { interventionsApi } from '@/api/endpoints/interventionsApi';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { workApi, type MobileMission, type MobileWork } from '@/features/missions/api';
import { missionSteps, stepNeedsPhoto, stepPhotoPhase, inspectionComplete, parseStringList, canSubmitMission } from '@/features/missions/domain';
import { InspectionRooms } from '@/features/missions/InspectionRooms';
import type { MissionRoom } from '@/features/missions/api';
import { MissionRestock, type MissionRestockHandle } from '@/features/missions/MissionRestock';
import { restockApi } from '@/features/missions/baitlyRestockApi';
import { needsRestock } from '@/features/missions/restockModel';
import { readMissionDraft, saveMissionDraft, retainDraftPhoto, removeDraftPhoto, clearMissionDraft, type DraftPhoto } from '@/features/missions/drafts';
import { pickFromGallery, takePhoto } from '@/services/camera/cameraService';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { BaitlyButton, BaitlyEmpty, BaitlyField, BaitlyLoading, BaitlyNotice, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { MissionStepPanel } from '@/features/missions/MissionExecution';
import { addDemoStepPhoto } from '@/features/missions/baitlyDemoWork';
import { MissionTimer } from '@/features/missions/MissionTimer';
import { Reicon } from '@/icons';
import { useBaitlyTheme } from '@/design-system/theme';
import { MissionArrival } from '@/features/missions/MissionArrival';
import { MissionFollowUp } from '@/features/missions/MissionFollowUp';
import { MissionDiagnostic, type MissionStepHandle } from '@/features/missions/MissionDiagnostic';
import { MissionSignature } from '@/features/missions/MissionSignature';
import { MissionPropertyPhotos } from '@/features/missions/MissionPropertyPhotos';
import { safetyApi } from '@/features/missions/baitlySafetyApi';
import { MissionSafety } from '@/features/missions/MissionSafety';
import { MissionRecap } from '@/features/missions/MissionRecap';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaitlyHeader, BaitlyHeaderAction } from '@/design-system/BaitlyHeader';
import { MissionCompletion } from '@/features/missions/MissionCompletion';
import { MissionInventory } from '@/features/missions/MissionInventory';
import { useMissionCompletionReturn } from '@/features/missions/useMissionCompletionReturn';

export function BaitlyMissionScreen({ route, navigation }: NativeStackScreenProps<BaitlyStackParams, 'Mission'>) {
  const { t, i18n } = useTranslation('mobileV1');
  const c = useBaitlyTheme();
  const scope = useBaitlyScope();
  const id = route.params.interventionId;
  const demo = id < 0;
  const cache = useQueryClient();
  const { isConnected } = useNetworkStatus();
  const query = useQuery({ queryKey: [...scope, 'mission', id], queryFn: ({ signal }) => workApi.detail(id, signal), retry: false,
    // A follower (owner, concierge) watches the assignee's progress: keep the state fresh without any action of theirs.
    refetchInterval: current => !demo && current.state.data && !current.state.data.canExecute && ['PENDING', 'IN_PROGRESS'].includes(current.state.data.mission.status) ? 30000 : false });
  const data = query.data?.mission;
  const safety = useQuery({ queryKey: [...scope, 'mission-safety', id], queryFn: () => safetyApi.detail(id), enabled: !!query.data?.canExecute, retry: false, refetchInterval: data?.status === 'IN_PROGRESS' ? 15000 : false });
  const timedMission = data ? { ...data, pausedAt: safety.data?.pausedAt, pauseSeconds: safety.data?.pauseSeconds } : undefined;
  const [completion,setCompletion]=useState<MobileMission>();
  const completionTiming=useRef<MobileMission | undefined>(undefined);
  useEffect(() => {
    const showTimer = !completion && data?.status==='IN_PROGRESS' && data.startTime;
    navigation.setOptions({ header: () => <SafeAreaView edges={['top']} style={{ backgroundColor: c.background, paddingHorizontal: 16 }}>
      <BaitlyHeader start={<BaitlyHeaderAction icon="chevron-back" label={t('back')} onPress={() => navigation.goBack()} />}
        end={showTimer && query.data?.canExecute ? <MissionTimer mission={timedMission!} compact /> : undefined} />
    </SafeAreaView> });
  }, [navigation, data, query.data?.canExecute, safety.data, c.background, t,completion]);
  const editable = query.data?.canExecute && data?.status === 'IN_PROGRESS' && !query.isError;
  const [notes, setNotes] = useState('');
  const [stage, setStage] = useState(0);
  const [restockReady, setRestockReady] = useState(false);
  const restockRef = useRef<MissionRestockHandle>(null);
  const [restockNeeded, setRestockNeeded] = useState<boolean | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [savedAt, setSavedAt] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [evidenceReady, setEvidenceReady] = useState(false);
  const evidenceRef = useRef<MissionStepHandle>(null);
  const returnHome=useCallback(()=>navigation.dispatch(CommonActions.reset({index:0,routes:[{name:'Home',state:{index:0,routes:[{name:'Today'}]}}]})),[navigation]);
  useMissionCompletionReturn(completion,busy,returnHome);
  const lock = useRef(false);
  const stockQuery = useQuery({ queryKey: [...scope, 'mission-stock', id], queryFn: () => restockApi.list(id), enabled: !!data?.type.includes('CLEANING'), retry: false });
  useEffect(() => {
    if (restockNeeded === null && stockQuery.data) setRestockNeeded(stockQuery.data.items.some(needsRestock) || parseStringList(data?.completedSteps).includes('restock'));
  }, [restockNeeded, stockQuery.data, data?.completedSteps]);
  const required = data ? query.data?.requiredSteps ?? missionSteps(data, query.data?.executionMode ?? 'ON_SITE').filter(step => step !== 'restock' || restockNeeded !== false) : [];
  useEffect(() => {
    if (restockNeeded === null || !initialized) return;
    const first = required.findIndex(step => !steps.includes(step)); setStage(first < 0 ? required.length : first);
  }, [restockNeeded]);
  const activeStep = required[stage];
  const phase = stepPhotoPhase(activeStep ?? '');
  const currentPhotos = photos.filter(photo => activeStep === 'after_photos' ? photo.phase === 'after' : photo.step === activeStep || (!photo.step && photo.phase === phase));
  const savedAfterPhotos = [...new Set(parseStringList(data?.afterPhotosUrls))];
  const savedBeforePhotos = [...new Set(parseStringList(data?.beforePhotosUrls))];
  const proofCount = activeStep === 'after_photos' ? Math.max(savedAfterPhotos.length, query.data?.stepPhotoCounts?.after_photos ?? 0) : query.data?.stepPhotoCounts?.[activeStep ?? ''] ?? 0;
  const roomInspection = activeStep === 'inspection' && data?.type.includes('CLEANING');
  const roomSurfaces = activeStep === 'surfaces' && data?.type.includes('CLEANING');
  const rooms = query.data?.rooms ?? [];
  const surfacesComplete = rooms.length > 0 && rooms.every(room => steps.includes(`surfaces_${room.id}`));
  const proofReady = activeStep === 'diagnostic' || activeStep === 'signature' ? evidenceReady : activeStep === 'restock' ? restockReady : activeStep==='inventory' ? !!safety.data && safety.data.furniture.every(item=>steps.includes(`inventory_${item.id}`)) : roomSurfaces ? surfacesComplete : roomInspection ? inspectionComplete(rooms, query.data?.stepPhotoCounts ?? {}) : !stepNeedsPhoto(activeStep ?? '', data?.type ?? '') || proofCount > 0;
  const photoLimitReached = photos.length >= 6 || (activeStep === 'inspection' && !roomInspection && proofCount + currentPhotos.length >= 1);
  useEffect(() => {
    let active = true;
    readMissionDraft(scope, id).then(draft => {
      if (!active) return;
      if (draft) { setNotes(!demo&&data?data.notes??'':draft.notes); setSteps(!demo&&data?parseStringList(data.completedSteps):draft.steps); setPhotos(draft.photos); setSavedAt(draft.savedAt); }
      else if (data) { setNotes(data.notes ?? ''); setSteps(parseStringList(data.completedSteps)); }
      const completed = !demo&&data?parseStringList(data.completedSteps):draft?.steps ?? parseStringList(data?.completedSteps);
      const first = required.findIndex(step => !completed.includes(step));
      setStage(first < 0 ? required.length : first);
      setInitialized(true);
    }).catch(() => { if (active) { setError(t('draftFailed')); setInitialized(true); } });
    return () => { active = false; };
  }, [id, scope[1], scope[2], Boolean(data)]);
  usePreventRemove(dirty || busy, ({ data: navigationData }) => {
    if(completion){navigation.dispatch(navigationData.action);return;}
    if (busy) return;
    Alert.alert(t('leaveDraft'), t('saveDraftHelp'), [{ text: t('stay'), style: 'cancel' },
      { text: t('leave'), style: 'destructive', onPress: () => navigationData.action && navigation.dispatch(navigationData.action) }]);
  });
  async function save() {
    await saveMissionDraft(scope, id, { notes, steps, photos, savedAt: new Date().toISOString() });
    setSavedAt(new Date().toISOString()); setDirty(false);
  }
  async function run(action: () => Promise<unknown>, requiresNetwork = true, refresh = true) {
    if (lock.current || (requiresNetwork && ((!demo && !isConnected) || uncertain || query.isError))) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); if (requiresNetwork && refresh) { await query.refetch(); await cache.invalidateQueries({ queryKey: [...scope, 'missions'] }); }
      else if(requiresNetwork) await cache.invalidateQueries({queryKey:[...scope,'missions'],refetchType:'none'});
    }
    catch (failure) {
      const status = (failure as { status?: number }).status;
      if (requiresNetwork && (!status || status >= 500 || status === 408)) setUncertain(true);
      if (status === 409) {
        const latest=await query.refetch();
        if(latest.data&&!latest.isError){const current=latest.data.mission;setNotes(current.notes??'');setSteps(parseStringList(current.completedSteps));setDirty(false);}
      }
      setError(t(status === 409 ? 'stateChanged' : requiresNetwork ? 'sendFailed' : 'draftFailed'));
    } finally { lock.current = false; setBusy(false); }
  }
  async function addPhoto(phase: 'before' | 'after', camera: boolean, room?: string) {
    if (photoLimitReached) return;
    const photo = await (camera ? takePhoto() : pickFromGallery());
    if (!photo) return;
    const uri = await retainDraftPhoto(photo.uri);
    const next = [...photos, { uri, phase, step: activeStep, room }];
    await saveMissionDraft(scope, id, { notes, steps, photos: next, savedAt: new Date().toISOString() });
    setPhotos(next); setDirty(false); setSavedAt(new Date().toISOString());
  }
  async function upload(photo: DraftPhoto) {
    const form = new FormData(); form.append('photoType', photo.phase);
    const evidence = photo.room ? `inspection_${photo.room}` : photo.step ?? (photo.phase === 'before' ? 'inspection' : 'after_photos');
    form.append('photos', { uri: photo.uri, type: 'image/jpeg', name: `baitly-${id}-step-${evidence}-${Date.now()}.jpg` } as unknown as Blob);
    if (demo) addDemoStepPhoto(id, evidence);
    else await interventionsApi.uploadPhotos(id, form);
    const next = photos.filter(p => p.uri !== photo.uri);
    await saveMissionDraft(scope, id, { notes, steps, photos: next, savedAt: new Date().toISOString() });
    setPhotos(next); await removeDraftPhoto(photo.uri); setDirty(false);
  }
  async function submit() {
    const summary = notes.trim() || required.map(step => t(`step.${step}`)).join(' · ');
    await workApi.report(id, summary, steps, query.data!.version);
    const receipt=await workApi.action(id, 'submit');
    if(!['AWAITING_VALIDATION','COMPLETED'].includes(receipt.status))throw {status:409};
    completionTiming.current=timedMission;
    cache.setQueryData<MobileWork>([...scope,'mission',id],current=>current?{...current,mission:receipt}:current);
    setCompletion(receipt);setDirty(false);setSavedAt('');
    await clearMissionDraft(scope, id).catch(()=>{ /* Server receipt remains authoritative if local cleanup fails. */ });
  }
  async function validateStep() {
    if (!activeStep || !proofReady || currentPhotos.length) return;
    if (activeStep === 'restock') {
      if (!restockRef.current) throw new Error('Restock not ready');
      await restockRef.current.save();
    }
    // Diagnostic and signature record their own evidence first; the server refuses the step without it.
    if (activeStep === 'diagnostic' || activeStep === 'signature') {
      if (!evidenceRef.current) throw new Error('Evidence not ready');
      await evidenceRef.current.save();
    }
    const next = [...new Set([...steps, activeStep])];
    await workApi.report(id, notes, next, query.data!.version);
    await saveMissionDraft(scope, id, { notes, steps: next, photos, savedAt: new Date().toISOString() });
    setSteps(next); setDirty(false); setStage(stage + 1);
  }
  function roomPhoto(room: MissionRoom) {
    Alert.alert(t(`inspectionRoom.${room.type}`, { number: room.number }), undefined, [
      { text: t('executionCamera'), onPress: () => { void run(() => addPhoto('before', true, room.id), false); } },
      { text: t('executionGallery'), onPress: () => { void run(() => addPhoto('before', false, room.id), false); } },
      ...(demo ? [{ text: t('executionDemoPhoto'), onPress: () => { void run(async () => { addDemoStepPhoto(id, `inspection_${room.id}`); }); } }] : []),
      { text: t('cancel'), style: 'cancel' },
    ]);
  }
  async function validateRoom(room: MissionRoom) {
    const key = `surfaces_${room.id}`;
    const next = steps.includes(key) ? steps.filter(step => step !== key && step !== 'surfaces') : [...steps, key];
    await workApi.report(id, notes, next, query.data!.version);
    await saveMissionDraft(scope, id, { notes, steps: next, photos, savedAt: new Date().toISOString() });
    setSteps(next); setDirty(false);
  }
  async function validateInventory(itemId:number) {
    const key=`inventory_${itemId}`;
    const next=steps.includes(key)?steps.filter(step=>step!==key&&step!=='inventory'):[...steps,key];
    await workApi.report(id,notes,next,query.data!.version);
    await saveMissionDraft(scope,id,{notes,steps:next,photos,savedAt:new Date().toISOString()});
    setSteps(next);setDirty(false);
  }
  const safetyBlocked = busy || uncertain || (!demo && !isConnected) || query.isFetching || query.isError;
  const blocked = safetyBlocked || !!safety.data?.pausedAt || (!!editable && (safety.isPending || safety.isError));
  const arrival = query.data?.canExecute && query.data.executionMode !== 'REMOTE' && data && ['PENDING', 'AWAITING_PAYMENT'].includes(data.status);
  const scheduled = data?.scheduledDate ? new Date(data.scheduledDate) : undefined;
  const validScheduled = scheduled && Number.isFinite(scheduled.getTime());
  const finishedMission=completion ?? (data&&['AWAITING_VALIDATION','COMPLETED'].includes(data.status)?data:undefined);
  if (query.data && (query.data.canReview || !query.data.canExecute) && ['AWAITING_VALIDATION', 'COMPLETED', 'AWAITING_PAYMENT'].includes(query.data.mission.status)) return <MissionReviewRecap work={query.data} demo={demo} onReviewed={() => { void query.refetch(); }} />;
  if (query.data && !query.data.canExecute) return <MissionFollowUp work={query.data} demo={demo} />;
  if(finishedMission)return <MissionCompletion mission={finishedMission} timing={completionTiming.current} photos={savedBeforePhotos.length+savedAfterPhotos.length} busy={busy} automatic={!!completion} onHome={returnHome}/>;
  return <BaitlyScreen scrollEnabled={!drawing}
    footer={editable ? <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('executionSave')} disabled={busy} onPress={() => { void run(save, false); }}
        style={{ width: 52, minHeight: 52, borderRadius: 16, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Reicon name="download-outline" size={23} color={c.ink} />
      </Pressable>
      <View style={{ flex: 1 }}>
      <BaitlyButton title={t(activeStep ? steps.includes(activeStep) ? 'executionContinue' : 'executionValidateStep' : 'missionFinish')} busy={busy}
        disabled={blocked || (activeStep ? !proofReady || currentPhotos.length > 0 : !canSubmitMission(notes, steps, required, photos.length))}
        onPress={() => activeStep ? steps.includes(activeStep) && !['restock', 'diagnostic', 'signature'].includes(activeStep) ? setStage(stage + 1) : void run(validateStep) : void run(submit,true,false)} />
      </View>
    </View> : arrival && data.assignmentResponse !== 'PENDING' ? <BaitlyButton title={t('arrivalStart')} busy={busy} disabled={blocked}
      onPress={() => { void run(() => workApi.action(id, 'start')); }} /> : undefined}>
    {!editable ? <View style={{ flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 12 }}>
      <View style={{ flex: 1, gap: 4 }}>
        {data ? <BaitlyText muted variant="meta">{t(`missionType.${data.type}`, { defaultValue: data.type })}</BaitlyText> : null}
        <BaitlyText variant="heading">{data?.title ?? t('mission')}</BaitlyText>
      </View>
      {validScheduled ? <View style={{ alignItems: 'flex-end', paddingTop: 20 }}>
        <BaitlyText variant="meta" style={{ fontVariant: ['tabular-nums'] }}>{scheduled.toLocaleDateString(i18n.language, { day: '2-digit', month: 'short' })}{data?.scheduledDate?.includes('T') ? ` · ${scheduled.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}` : ''}</BaitlyText>
      </View> : null}
    </View> : null}
    {query.isPending || !initialized ? <BaitlyLoading /> : null}
    {query.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void query.refetch(); }} /> : null}
    {error ? <BaitlyNotice error>{error}</BaitlyNotice> : null}
    {error === t('stateChanged') && data?.notes ? <BaitlyNotice>{t('serverReport')}
{data.notes}</BaitlyNotice> : null}
    {savedAt ? <BaitlyText muted variant="meta">{t('executionSaved')}</BaitlyText> : null}
    {!demo && !isConnected ? <BaitlyNotice>{t('onlineRequired')}</BaitlyNotice> : null}
    {demo && !editable ? <BaitlyText muted variant="meta">{t('homeDemo')}</BaitlyText> : null}
    {uncertain ? <><BaitlyNotice>{t('verifyBeforeRetry')}</BaitlyNotice>
      <BaitlyButton secondary title={t('verify')} disabled={busy || !isConnected} onPress={() => {
        void query.refetch().then(result => { if (!result.isError) { setUncertain(false); setError(''); } });
      }} /></> : null}
    {data && !query.isError ? <>
      {!editable ? <View style={{ gap: 2 }}>
      {data.propertyName ? <BaitlyText muted variant="meta">{data.propertyName}</BaitlyText> : null}
      {!editable && !['PENDING', 'AWAITING_PAYMENT'].includes(data.status) ? <BaitlyText muted variant="meta">{t(`missionStatus.${data.status}`)}</BaitlyText> : null}
      </View> : null}
      {arrival ? <MissionArrival mission={data} accessInstructions={query.data?.accessInstructions} cleaningInstructions={query.data?.cleaningInstructions} propertyPhotos={query.data?.propertyPhotos} /> : null}
      {!arrival && !editable && data.propertyAddress ? <BaitlyText>{data.propertyAddress}</BaitlyText> : null}
      {!arrival && !editable && data.description ? <BaitlyText>{data.description}</BaitlyText> : null}
      {!editable && data.notes ? <BaitlyText>{data.notes}</BaitlyText> : null}
      {query.data?.canExecute && data.assignmentResponse === 'PENDING' ? <>
        <BaitlyButton title={t('acceptMission')} disabled={blocked} onPress={() => { void run(() => workApi.action(id, 'accept')); }} />
        <BaitlyButton secondary title={t('declineMission')} disabled={blocked} onPress={() => Alert.alert(t('declineMission'), t('confirmDeclineMission'), [
          { text: t('cancel'), style: 'cancel' }, { text: t('confirm'), onPress: () => { void run(() => workApi.action(id, 'decline')); } }])} />
      </> : null}
      {!arrival && query.data?.canExecute && ['PENDING', 'AWAITING_PAYMENT'].includes(data.status) && data.assignmentResponse !== 'PENDING' ?
        <BaitlyButton title={t('startMission')} disabled={blocked} onPress={() => { void run(() => workApi.action(id, 'start')); }} /> : null}
      {!editable ? ['before', 'after'].filter(phase => parseStringList(phase === 'before' ? data.beforePhotosUrls : data.afterPhotosUrls).length > 0).map(phase => <View key={phase} style={{ gap: 8 }}>
        {parseStringList(phase === 'before' ? data.beforePhotosUrls : data.afterPhotosUrls).map(uri => <Image key={uri} source={{ uri }}
          style={{ width: '100%', height: 180, borderRadius: 8 }} contentFit="cover" accessibilityLabel={t(phase === 'before' ? 'beforePhotos' : 'afterPhotos')} />)}
      </View>) : null}
    </> : null}
    {initialized && (editable || (query.isError && savedAt)) ? <>
      {data?.requiresFollowUp&&data.followUpNotes?<BaitlyNotice>{data.followUpNotes}</BaitlyNotice>:null}
      {safety.isError ? <BaitlyNotice error>{t('loadFailed')}<BaitlyButton secondary title={t('verify')} onPress={() => { void safety.refetch(); }} /></BaitlyNotice> : null}
      {safety.data ? <MissionSafety id={id} rooms={rooms} state={safety.data} disabled={safetyBlocked} onReport={() => navigation.navigate('MissionDamage', { interventionId: id })} onChange={async () => { await safety.refetch(); await query.refetch(); }} /> : null}
      <View pointerEvents={safety.data?.pausedAt ? 'none' : 'auto'} style={{ opacity: safety.data?.pausedAt ? 0.45 : 1 }}>
      <MissionStepPanel required={required} checked={steps} stage={stage} onChange={setStage} />
      </View>
      {activeStep === 'after_photos' ? <>
        {savedBeforePhotos.length ? <View style={{ gap: 8 }}>
          <BaitlyText muted variant="meta">{t('beforePhotos')}</BaitlyText>
          <MissionPropertyPhotos photos={savedBeforePhotos} demo={demo} />
        </View> : null}
        {savedAfterPhotos.length ? <View style={{ gap: 8 }}>
          <BaitlyText muted variant="meta">{t('afterPhotos')}</BaitlyText>
          <MissionPropertyPhotos photos={savedAfterPhotos} demo={demo} />
        </View> : null}
      </> : null}
      {activeStep === 'diagnostic' && data ? <MissionDiagnostic key="diagnostic" ref={evidenceRef} id={id} notes={query.data?.technicianNotes} materials={query.data?.materialsUsed} disabled={blocked} onReady={setEvidenceReady} /> : null}
      {activeStep === 'signature' && data ? <MissionSignature key="signature" ref={evidenceRef} id={id} status={query.data?.signatureStatus} signerName={query.data?.signerName} disabled={blocked} onDrawing={setDrawing} onReady={setEvidenceReady} /> : null}
      {activeStep === 'restock' ? <MissionRestock ref={restockRef} id={id} onReady={setRestockReady} onDirty={setDirty} /> : null}
      {activeStep==='inventory' && safety.data?<MissionInventory items={safety.data.furniture} checked={steps} disabled={blocked} onToggle={itemId=>{void run(()=>validateInventory(itemId));}}/>:null}
      {!activeStep && timedMission ? <MissionRecap required={required} checked={steps} before={savedBeforePhotos} after={savedAfterPhotos} demo={demo} safety={safety.data} stock={stockQuery.data} mission={timedMission} /> : null}
      {roomInspection ? <InspectionRooms rooms={query.data?.rooms ?? []} counts={query.data?.stepPhotoCounts ?? {}} pending={currentPhotos.map(photo => photo.room ?? '')}
        disabled={blocked || photos.length >= 6} onPhoto={roomPhoto} /> : null}
      {roomSurfaces ? <InspectionRooms rooms={rooms} counts={Object.fromEntries(rooms.map(room => [`inspection_${room.id}`, steps.includes(`surfaces_${room.id}`) ? 1 : 0]))} pending={[]}
        validation disabled={blocked} onPhoto={room => { void run(() => validateRoom(room)); }} /> : null}
      {activeStep && activeStep !== 'restock' && activeStep !== 'signature' && !roomInspection && !roomSurfaces && query.data?.executionMode !== 'REMOTE' ? <View style={{ gap: 10 }}>
        <BaitlyText muted variant="meta">{t(stepNeedsPhoto(activeStep, data?.type) ? 'executionPhotoRequired' : 'executionPhotoOptional')}{proofCount ? ` · ${proofCount}` : ''}</BaitlyText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><BaitlyButton secondary title={t('executionCamera')} disabled={blocked || photoLimitReached} onPress={() => { void run(() => addPhoto(phase, true), false); }} /></View>
          <View style={{ flex: 1 }}><BaitlyButton secondary title={t('executionGallery')} disabled={blocked || photoLimitReached} onPress={() => { void run(() => addPhoto(phase, false), false); }} /></View>
        </View>
        {demo ? <BaitlyButton secondary title={t('executionDemoPhoto')} disabled={blocked || photoLimitReached} onPress={() => { void run(async () => { addDemoStepPhoto(id, activeStep); }); }} /> : null}
      </View> : null}
      {activeStep ? currentPhotos.map(photo => <View key={photo.uri} style={{ gap: 8 }}>
        <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 180, borderRadius: 8 }} />
        <BaitlyText muted>{t(photo.phase === 'before' ? 'beforePhotos' : 'afterPhotos')} · {t('photoPending')}</BaitlyText>
        <BaitlyButton title={t('uploadPhoto')} disabled={blocked} onPress={() => { void run(() => upload(photo)); }} />
        <BaitlyButton secondary title={t('removePhoto')} disabled={busy} onPress={() => { void run(async () => {
          const next = photos.filter(p => p.uri !== photo.uri);
          await saveMissionDraft(scope, id, { notes, steps, photos: next, savedAt: new Date().toISOString() });
          setPhotos(next); await removeDraftPhoto(photo.uri); setDirty(false);
        }, false); }} />
      </View>) : null}
    </> : null}
    {!demo ? <Discussion kind="mission" id={id} /> : null}
  </BaitlyScreen>;
}

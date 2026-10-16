import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { BaitlyButton, BaitlyNotice, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon, type IconName } from '@/icons';
import { baitlyMediaList } from '@/api/baitlyMedia';
import { paymentsApi } from '@/api/endpoints/paymentsApi';
import { formatMoney } from '@/features/marketplace/domain';
import { Discussion } from '@/features/messages/Discussion';
import type { MobileWork } from './api';
import { missionSteps, parseStringList } from './domain';
import { MissionTimer } from './MissionTimer';
import { MissionPropertyPhotos } from './MissionPropertyPhotos';
import { missionFollowUpProgress, missionFollowUpStages, type FollowUpStageState } from './missionFollowUpModel';

const stageIcon: Record<FollowUpStageState, IconName> = { done: 'checkmark-circle', current: 'time', todo: 'ellipse-outline', blocked: 'close-circle-outline' };

/**
 * Follow-up screen for the owner or the concierge: state, assignee and progress, read-only.
 * Starting, reporting and submitting belong to the assigned worker alone (enforced server-side).
 */
export function MissionFollowUp({ work, demo }: { work: MobileWork; demo: boolean }) {
  const { t, i18n } = useTranslation('mobileV1');
  const c = useBaitlyTheme();
  const mission = work.mission;
  const row = i18n.dir() === 'rtl' ? 'row-reverse' as const : 'row' as const;
  const when = (value?: string, withDay = true) => {
    const date = value ? new Date(value) : undefined;
    if (!date || !Number.isFinite(date.getTime())) return undefined;
    const time = value!.includes('T') ? date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }) : undefined;
    return [withDay ? date.toLocaleDateString(i18n.language, { day: '2-digit', month: 'short' }) : undefined, time].filter(Boolean).join(' · ');
  };
  const navigation = useNavigation<any>();
  // The server decides what is due (deposit deducted); the card only appears when it says so.
  const payable = useQuery({ queryKey: ['payment-payable', mission.id], queryFn: () => paymentsApi.getPayable(mission.id), retry: false,
    enabled: !demo && mission.paymentStatus !== 'PAID' && mission.status !== 'CANCELLED' });
  const due = payable.data?.payable ? formatMoney(payable.data.amount, payable.data.currency, i18n.language) : null;
  const stages = missionFollowUpStages(mission);
  const started = ['IN_PROGRESS', 'AWAITING_VALIDATION', 'COMPLETED'].includes(mission.status);
  const completed = parseStringList(mission.completedSteps);
  const required = work.requiredSteps ?? missionSteps(mission, work.executionMode);
  const progress = missionFollowUpProgress(required, completed);
  const tone = mission.status === 'IN_PROGRESS' ? { bg: c.warningSoft, fg: c.warning } : mission.status === 'COMPLETED' ? { bg: c.successSoft, fg: c.success }
    : mission.status === 'CANCELLED' ? { bg: c.dangerSoft, fg: c.danger } : { bg: c.muted, fg: c.ink };
  const statusLabel = mission.pausedAt ? t('missionPaused') : mission.status === 'PENDING' ? t('planningScheduled') : t(`missionStatus.${mission.status}`, { defaultValue: mission.status });
  const answer = mission.assignmentResponse === 'PENDING' ? 'followUp.answer.pending' : mission.assignmentResponse === 'DECLINED' ? 'followUp.answer.declined' : 'followUp.answer.accepted';
  return <BaitlyScreen>
    <View style={{ flexDirection: row, alignItems: 'flex-start', gap: 12 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <BaitlyText muted variant="meta">{t(`missionType.${mission.type}`, { defaultValue: mission.type })}</BaitlyText>
        <BaitlyText variant="heading" accessibilityRole="header">{mission.title}</BaitlyText>
      </View>
      <View style={[styles.pill, { backgroundColor: tone.bg }]}><BaitlyText variant="meta" style={{ color: tone.fg, fontWeight: '600' }}>{statusLabel}</BaitlyText></View>
    </View>
    {demo ? <BaitlyText muted variant="meta">{t('homeDemo')}</BaitlyText> : null}

    {due ? <View style={[styles.card, { backgroundColor: c.surface }]}>
      <View style={{ flexDirection: row, alignItems: 'center' }}>
        <BaitlyText style={{ flex: 1, fontWeight: '600' }}>{t('paymentDue')}</BaitlyText>
        <BaitlyText style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>{due}</BaitlyText>
      </View>
      <BaitlyButton icon="lock-closed-outline" title={t('paymentPay', { amount: due })} onPress={() => navigation.navigate('PaymentCheckout', { interventionId: mission.id })} />
    </View> : null}

    <View style={[styles.card, { backgroundColor: c.surface, flexDirection: row, alignItems: 'center' }]}>
      <View style={[styles.avatar, { backgroundColor: c.muted }]}><Reicon name="person-outline" size={22} color={c.ink} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <BaitlyText muted variant="meta">{t('followUp.assignee')}</BaitlyText>
        <BaitlyText style={{ fontWeight: '600' }}>{mission.assignedToName ?? t('planningUnassigned')}</BaitlyText>
        {mission.assignedToName && !started ? <BaitlyText muted variant="meta">{t(answer)}</BaitlyText> : null}
      </View>
    </View>

    {mission.status === 'IN_PROGRESS' && required.length ? <View style={[styles.card, { backgroundColor: c.surface, gap: 10 }]}>
      <View style={{ flexDirection: row, alignItems: 'center' }}>
        <BaitlyText style={{ flex: 1, fontWeight: '600' }}>{t('followUp.progress')}</BaitlyText>
        <BaitlyText muted variant="meta" style={{ fontVariant: ['tabular-nums'] }}>{progress.done}/{progress.total}</BaitlyText>
      </View>
      <View style={{ flexDirection: row, gap: 4 }}>{required.map(step => <View key={step} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: completed.includes(step) ? c.success : c.border }} />)}</View>
      <MissionTimer mission={mission} />
      {required.map(step => <View key={step} style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
        <Reicon name={completed.includes(step) ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={completed.includes(step) ? c.success : c.secondary} />
        <BaitlyText variant="meta" muted={!completed.includes(step)} style={{ flex: 1 }}>{t(`step.${step}`)}</BaitlyText>
      </View>)}
      {mission.pausedAt ? <BaitlyNotice>{t('followUp.paused')}</BaitlyNotice> : null}
    </View> : null}

    <View style={[styles.card, { backgroundColor: c.surface, gap: 0 }]}>
      <BaitlyText style={{ fontWeight: '600', paddingBottom: 6 }}>{t('followUp.timeline')}</BaitlyText>
      {stages.map((stage, index) => <View key={stage.key} style={{ flexDirection: row, gap: 12 }}>
        <View style={{ alignItems: 'center', width: 22 }}>
          <Reicon name={stageIcon[stage.state]} size={20} color={stage.state === 'done' ? c.success : stage.state === 'blocked' ? c.danger : stage.state === 'current' ? c.ink : c.secondary} />
          {index < stages.length - 1 ? <View style={{ flex: 1, width: 2, minHeight: 14, backgroundColor: stage.state === 'done' ? c.success : c.border }} /> : null}
        </View>
        <View style={{ flex: 1, flexDirection: row, gap: 8, paddingBottom: 14 }}>
          <BaitlyText muted={stage.state === 'todo'} style={{ flex: 1, fontWeight: stage.state === 'current' ? '600' : '400', color: stage.state === 'blocked' ? c.danger : undefined }}>{t(stage.label)}</BaitlyText>
          {stage.at ? <BaitlyText muted variant="meta" style={{ fontVariant: ['tabular-nums'] }}>{when(stage.at, stage.key === 'scheduled')}</BaitlyText> : null}
        </View>
      </View>)}
    </View>

    <View style={{ gap: 6 }}>
      {mission.propertyName ? <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}><Reicon name="home-outline" size={18} color={c.secondary} /><BaitlyText style={{ flex: 1 }}>{mission.propertyName}</BaitlyText></View> : null}
      {mission.propertyAddress ? <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}><Reicon name="location-outline" size={18} color={c.secondary} /><BaitlyText muted style={{ flex: 1 }}>{mission.propertyAddress}</BaitlyText></View> : null}
    </View>
    {mission.description ? <BaitlyText>{mission.description}</BaitlyText> : null}
    {mission.requiresFollowUp && mission.followUpNotes ? <BaitlyNotice>{mission.followUpNotes}</BaitlyNotice> : null}

    {[{ label: 'beforePhotos', photos: baitlyMediaList(mission.beforePhotosUrls) }, { label: 'afterPhotos', photos: baitlyMediaList(mission.afterPhotosUrls) }].filter(section => section.photos.length).map(section => <View key={section.label} style={{ gap: 8 }}>
      <BaitlyText style={{ fontWeight: '600' }}>{t(section.label)} · {section.photos.length}</BaitlyText>
      <MissionPropertyPhotos photos={section.photos} demo={demo} />
    </View>)}

    {mission.status !== 'COMPLETED' && mission.status !== 'CANCELLED' ? <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
      <Reicon name="information-circle-outline" size={18} color={c.secondary} />
      <BaitlyText muted variant="meta" style={{ flex: 1 }}>{t('followUp.workerOnly')}</BaitlyText>
    </View> : null}
    {!demo ? <Discussion kind="mission" id={mission.id} /> : null}
  </BaitlyScreen>;
}
const styles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginTop: 18 },
  card: { borderRadius: 18, padding: 14, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

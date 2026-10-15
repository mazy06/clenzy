import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import { Image } from 'expo-image';
const illustrations: Record<string, number> = {
  inspection: require('../../../assets/baitly/mission-steps/assignment.webp'),
  after_photos: require('../../../assets/baitly/mission-steps/work-review.webp'),
  diagnostic: require('../../../assets/baitly/sectors/sector-maintenance.webp'),
  work: require('../../../assets/baitly/navigation/baitly-missions.png'),
  test: require('../../../assets/baitly/mission-steps/assignment.webp'),
  surfaces: require('../../../assets/baitly/sectors/cleaning.webp'),
  sanitary: require('../../../assets/baitly/mission-steps/bathroom.webp'),
  linen: require('../../../assets/baitly/mission-steps/beds.webp'),
  inventory: require('../../../assets/baitly/mission-steps/assignment.webp'),
  restock: require('../../../assets/baitly/mission-steps/stock-order.webp'),
  finalCheck: require('../../../assets/baitly/mission-steps/work-review.webp'),
  signature: require('../../../assets/baitly/mission-steps/assignment.webp'),
};
export function MissionStepPanel({ required, stage, checked, onChange }: { required: string[]; stage: number; checked: string[]; onChange: (index: number) => void }) {
  const c = useBaitlyTheme(); const { t } = useTranslation('mobileV1');
  const firstPending = required.findIndex(step => !checked.includes(step));
  const unlocked = firstPending < 0 ? required.length : firstPending;
  const step = required[stage];
  return <View style={{ gap: 2 }}>
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[...required, 'report'].map((key, index) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={t(key === 'report' ? 'missionRecap' : `step.${key}`)}
        accessibilityState={{ selected: stage === index, disabled: index > unlocked }} disabled={index > unlocked} onPress={() => onChange(index)}
        style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}><View style={{ height: stage === index ? 6 : 4, borderRadius: 4, backgroundColor: checked.includes(key) ? c.success : stage === index ? c.ink : c.border }} /></Pressable>)}
    </View>
    <View style={styles.stageHeader}>
      <Image source={illustrations[step] ?? require('../../../assets/baitly/mission-steps/work-review.webp')} contentFit="contain" style={styles.stageImage} accessible={false} />
      <BaitlyText accessibilityRole="header" style={styles.stageTitle}>{t(step ? `step.${step}` : 'missionRecap')}</BaitlyText>
      <BaitlyText muted variant="meta" style={styles.stageNumber}>{stage + 1}/{required.length + 1}</BaitlyText>
    </View>
  </View>;
}

export function MissionExecutionTabs({ stage, onChange }: { stage: number; onChange: (stage: number) => void }) {
  const c = useBaitlyTheme(); const { t } = useTranslation('mobileV1');
  return <View style={styles.tabs}>{['executionTasks', 'executionPhotos', 'executionReport'].map((label, index) => <Pressable key={label}
    accessibilityRole="tab" accessibilityState={{ selected: stage === index }} onPress={() => onChange(index)}
    style={[styles.tab, { backgroundColor: stage === index ? c.ink : c.surface }]}>
    <BaitlyText variant="meta" style={{ color: stage === index ? c.background : c.secondary, textAlign: 'center', fontWeight: '600' }}>{index + 1}. {t(label)}</BaitlyText>
  </Pressable>)}</View>;
}
export function MissionChecklist({ required, checked, disabled, onToggle }: { required: string[]; checked: string[]; disabled: boolean; onToggle: (step: string) => void }) {
  const c = useBaitlyTheme(); const { t } = useTranslation('mobileV1');
  const count = required.filter(step => checked.includes(step)).length;
  return <View style={{ gap: 12 }}>
    <View style={styles.progress}><View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
      {required.map(step => <View key={step} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: checked.includes(step) ? c.success : c.border }} />)}
    </View><BaitlyText variant="meta" muted style={{ fontVariant: ['tabular-nums'] }}>{count}/{required.length}</BaitlyText></View>
    <View style={{ backgroundColor: c.surface, borderRadius: 22, overflow: 'hidden' }}>
    {required.map((step, index) => { const done = checked.includes(step); return <Pressable key={step} accessibilityRole="checkbox"
      accessibilityLabel={t(`step.${step}`)} accessibilityState={{ checked: done, disabled }} disabled={disabled} onPress={() => onToggle(step)}
      style={({ pressed }) => [styles.step, { backgroundColor: pressed || done ? c.muted : c.surface, borderBottomColor: c.border, borderBottomWidth: index === required.length - 1 ? 0 : StyleSheet.hairlineWidth }]}>
      <Image source={illustrations[step] ?? require('../../../assets/baitly/sectors/sector-maintenance.webp')} contentFit="contain" style={{ width: 46, height: 46 }} accessible={false} />
      <BaitlyText style={{ flex: 1, fontSize: 16, lineHeight: 22, fontWeight: done ? '400' : '500' }}>{t(`step.${step}`)}</BaitlyText>
      <View style={[styles.check, { backgroundColor: done ? c.success : c.background, borderWidth: done ? 0 : 1, borderColor: c.secondary }]}>{done ? <Reicon name="checkmark" size={19} color={c.background} /> : null}</View>
    </Pressable>; })}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  stageHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 4 },
  stageImage: { width: 44, height: 44, flexShrink: 0 },
  stageTitle: { flex: 1, fontSize: 19, lineHeight: 25, fontWeight: '600' },
  stageNumber: { fontVariant: ['tabular-nums'], flexShrink: 0 },
  tabs: { flexDirection: 'row', gap: 6 }, tab: { flex: 1, minHeight: 48, borderRadius: 14, padding: 8, justifyContent: 'center' },
  progress: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  step: { minHeight: 66, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});

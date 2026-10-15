import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BaitlyButton, BaitlyField, BaitlyText } from '@/design-system/components';
import { BaitlyChoices } from '@/design-system/primitives';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import { workApi } from './api';
import { DIAGNOSTIC_CAUSES, parseDiagnostic } from './diagnosticModel';

export interface MissionStepHandle { save: () => Promise<void> }
/** Technical diagnostic: what the worker finds, the likely cause and the parts needed. Saved by the step's main button. */
export const MissionDiagnostic = forwardRef<MissionStepHandle, {
  id: number; notes?: string | null; materials?: string | null; disabled: boolean; onReady: (ready: boolean) => void;
}>(function MissionDiagnostic({ id, notes, materials, disabled, onReady }, ref) {
  const { t, i18n } = useTranslation('mobileV1');
  const c = useBaitlyTheme();
  const row = i18n.dir() === 'rtl' ? 'row-reverse' as const : 'row' as const;
  const initial = parseDiagnostic(notes, materials);
  const [finding, setFinding] = useState(initial.finding);
  const [cause, setCause] = useState<string | undefined>(initial.cause);
  const [parts, setParts] = useState(initial.materials);
  useEffect(() => { onReady(!!finding.trim()); }, [finding, onReady]);
  // Errors propagate to the mission screen, which shows its own failure message.
  useImperativeHandle(ref, () => ({ save: () => workApi.diagnostic(id, { finding: finding.trim(), cause,
    materials: parts.filter(part => part.name.trim()).map(part => ({ name: part.name.trim(), quantity: part.quantity })) }) }));
  const update = (index: number, patch: Partial<{ name: string; quantity: number }>) => setParts(list => list.map((part, i) => i === index ? { ...part, ...patch } : part));
  return <View style={styles.root}>
    <BaitlyField label={t('diagnosticFinding')} value={finding} onChangeText={setFinding} multiline maxLength={2000} editable={!disabled}
      placeholder={t('diagnosticFindingHint')} />
    <BaitlyChoices layout="wrap" label={t('diagnosticCause')} value={cause} onChange={setCause} disabled={disabled}
      options={DIAGNOSTIC_CAUSES.map(key => ({ value: key, label: t(`diagnosticCause.${key}`) }))} />
    <View style={styles.parts}>
      <BaitlyText style={styles.label}>{t('diagnosticParts')}</BaitlyText>
      {parts.map((part, index) => <View key={index} style={[styles.part, { flexDirection: row, backgroundColor: c.surface }]}>
        <View style={styles.flex}><BaitlyField label={t('diagnosticPartName')} value={part.name} onChangeText={name => update(index, { name })} maxLength={120} editable={!disabled} /></View>
        <View style={[styles.stepper, { flexDirection: row }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('decrease')} disabled={disabled || part.quantity <= 1} onPress={() => update(index, { quantity: part.quantity - 1 })} style={[styles.stepButton, { backgroundColor: c.muted }]}><Reicon name="remove-circle-outline" size={20} color={c.ink} /></Pressable>
          <BaitlyText style={styles.quantity}>{part.quantity}</BaitlyText>
          <Pressable accessibilityRole="button" accessibilityLabel={t('increase')} disabled={disabled || part.quantity >= 999} onPress={() => update(index, { quantity: part.quantity + 1 })} style={[styles.stepButton, { backgroundColor: c.muted }]}><Reicon name="add-circle-outline" size={20} color={c.ink} /></Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('remove')} disabled={disabled} onPress={() => setParts(list => list.filter((_, i) => i !== index))} style={styles.stepButton}><Reicon name="trash-outline" size={20} color={c.danger} /></Pressable>
      </View>)}
      <BaitlyButton variant="ghost" icon="add-outline" title={t('diagnosticAddPart')} disabled={disabled || parts.length >= 30} onPress={() => setParts(list => [...list, { name: '', quantity: 1 }])} />
    </View>
  </View>;
});
const styles = StyleSheet.create({
  root: { gap: 16 }, flex: { flex: 1 }, parts: { gap: 8 }, label: { fontWeight: '600' },
  part: { alignItems: 'flex-end', gap: 8, padding: 10, borderRadius: 14 },
  stepper: { alignItems: 'center', gap: 6, paddingBottom: 4 },
  stepButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quantity: { minWidth: 28, textAlign: 'center', fontWeight: '600', fontVariant: ['tabular-nums'] },
});

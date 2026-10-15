import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Reicon, type IconName } from '@/icons';
import { BaitlyText, type BaitlyTone } from './components';
import { useBaitlyTheme } from './theme';

function useRow() {
  const { i18n } = useTranslation();
  return i18n.dir() === 'rtl' ? 'row-reverse' as const : 'row' as const;
}

/** Status label shared by every list and detail screen. `neutral` = nothing to do yet. */
export function BaitlyPill({ label, tone = 'neutral', icon }: { label: string; tone?: BaitlyTone | 'neutral'; icon?: IconName }) {
  const c = useBaitlyTheme();
  const [background, foreground] = { neutral: [c.muted, c.ink], info: [c.muted, c.ink], warning: [c.warningSoft, c.warning],
    success: [c.successSoft, c.success], error: [c.dangerSoft, c.danger] }[tone];
  return <View style={[styles.pill, { flexDirection: useRow(), backgroundColor: background }]}>
    {icon ? <Reicon name={icon} size={14} color={foreground} /> : null}
    <BaitlyText variant="meta" numberOfLines={1} style={{ color: foreground, fontWeight: '600', fontSize: 13, lineHeight: 18 }}>{label}</BaitlyText>
  </View>;
}

/** Titled surface grouping one topic of a screen. */
export function BaitlyCard({ title, action, children, padded = true }: React.PropsWithChildren<{ title?: string; action?: React.ReactNode; padded?: boolean }>) {
  const c = useBaitlyTheme();
  const row = useRow();
  return <View style={[styles.card, padded && styles.cardPadded, { backgroundColor: c.surface }]}>
    {title ? <View style={[styles.cardHeader, { flexDirection: row }, !padded && styles.cardHeaderInset]}>
      <BaitlyText accessibilityRole="header" style={styles.cardTitle}>{title}</BaitlyText>{action}
    </View> : null}
    {children}
  </View>;
}

/** Label on the start side, value on the end side: for facts the user scans, not reads. */
export function BaitlyInfoRow({ label, value, icon, strong = false, last = false }: { label: string; value?: string | null; icon?: IconName; strong?: boolean; last?: boolean }) {
  const c = useBaitlyTheme();
  if (!value) return null;
  return <View style={[styles.infoRow, { flexDirection: useRow(), borderBottomColor: last ? 'transparent' : c.border }]}>
    {icon ? <Reicon name={icon} size={18} color={c.secondary} /> : null}
    <BaitlyText muted variant="meta" style={styles.infoLabel}>{label}</BaitlyText>
    <BaitlyText selectable style={[styles.infoValue, strong && styles.infoStrong]}>{value}</BaitlyText>
  </View>;
}

export interface BaitlyChoice<T extends string | number> { value: T; label: string; detail?: string; icon?: IconName; image?: ImageSource | number }

/**
 * Single choice among a few visible options. `layout="scroll"` for short chips on one line
 * (days, time slots), `layout="list"` for options that need a second line (services, homes).
 */
export function BaitlyChoices<T extends string | number>({ options, value, onChange, layout = 'scroll', disabled = false, label }: {
  options: BaitlyChoice<T>[]; value: T | undefined | null; onChange: (value: T) => void; layout?: 'scroll' | 'wrap' | 'list'; disabled?: boolean; label?: string;
}) {
  const c = useBaitlyTheme();
  const row = useRow();
  const items = options.map(option => {
    const selected = option.value === value;
    const list = layout === 'list';
    return <Pressable key={String(option.value)} accessibilityRole="radio" accessibilityLabel={[option.label, option.detail].filter(Boolean).join(', ')}
      accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => onChange(option.value)}
      style={({ pressed }) => [list ? styles.choiceRow : styles.chip, { flexDirection: row,
        backgroundColor: selected ? list ? c.surface : c.ink : pressed ? c.muted : c.surface,
        borderColor: selected ? c.ink : c.border, opacity: disabled ? 0.5 : 1 }]}>
      {option.image ? <Image source={option.image} style={styles.choiceImage} contentFit="contain" accessible={false} />
        : option.icon ? <Reicon name={option.icon} size={list ? 22 : 16} color={selected && !list ? c.background : c.ink} /> : null}
      <View style={list ? styles.flex : undefined}>
        <BaitlyText style={[list ? styles.choiceTitle : styles.chipLabel, { color: selected && !list ? c.background : c.ink }]} numberOfLines={list ? 2 : 1}>{option.label}</BaitlyText>
        {option.detail ? <BaitlyText variant="meta" muted={!(selected && !list)} numberOfLines={2}
          style={[!list && styles.chipDetail, selected && !list ? { color: c.background } : undefined]}>{option.detail}</BaitlyText> : null}
      </View>
      {list ? <View style={[styles.radio, { borderColor: selected ? c.ink : c.secondary, backgroundColor: selected ? c.ink : 'transparent' }]}>
        {selected ? <Reicon name="checkmark" size={14} color={c.background} /> : null}
      </View> : null}
    </Pressable>;
  });
  return <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={label}>
    {label ? <BaitlyText style={styles.choicesLabel}>{label}</BaitlyText> : null}
    {layout === 'scroll' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { flexDirection: row }]}>{items}</ScrollView>
      : <View style={[layout === 'wrap' ? styles.wrap : styles.list, layout === 'wrap' && { flexDirection: row }]}>{items}</View>}
  </View>;
}

/** Two or three views of the same screen, switched in place. */
export function BaitlySegmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  const c = useBaitlyTheme();
  return <View accessibilityRole="tablist" style={[styles.segmented, { flexDirection: useRow(), backgroundColor: c.muted }]}>
    {options.map(option => {
      const selected = option.value === value;
      return <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(option.value)}
        style={[styles.segment, selected && { backgroundColor: c.surface }]}>
        <BaitlyText numberOfLines={1} style={{ fontSize: 15, fontWeight: selected ? '600' : '500', color: selected ? c.ink : c.secondary, textAlign: 'center' }}>{option.label}</BaitlyText>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pill: { alignSelf: 'flex-start', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  card: { borderRadius: 18, gap: 12 },
  cardPadded: { padding: 16 },
  cardHeader: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardHeaderInset: { paddingHorizontal: 16, paddingTop: 16 },
  cardTitle: { flex: 1, fontSize: 17, lineHeight: 23, fontWeight: '600' },
  infoRow: { alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  infoLabel: { flex: 1 },
  infoValue: { flexShrink: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  infoStrong: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  choices: { gap: 10 },
  choicesLabel: { fontWeight: '600' },
  chips: { gap: 8, paddingEnd: 4 },
  wrap: { flexWrap: 'wrap', gap: 8 },
  list: { gap: 8 },
  chip: { minHeight: 44, minWidth: 44, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  chipLabel: { fontSize: 15, lineHeight: 20, fontWeight: '600', textAlign: 'center', fontVariant: ['tabular-nums'] },
  chipDetail: { fontSize: 12, lineHeight: 16, textAlign: 'center' },
  choiceRow: { minHeight: 60, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', gap: 12 },
  choiceImage: { width: 40, height: 40 },
  choiceTitle: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  segmented: { padding: 4, borderRadius: 14, gap: 4 },
  segment: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
});

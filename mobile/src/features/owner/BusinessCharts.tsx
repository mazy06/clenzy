import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { useTranslation } from 'react-i18next';

export function BusinessGauge({ value, label }: { value: number; label: string }) {
  const c = useBaitlyTheme(); const progress = Math.max(0, Math.min(100, value)); const circumference = 2 * Math.PI * 18;
  return <View accessible accessibilityLabel={`${label} : ${value.toLocaleString()} %`}>
    <Svg width={46} height={46} viewBox="0 0 46 46" accessible={false}>
      <Circle cx={23} cy={23} r={18} fill="none" stroke={c.border} strokeWidth={5} />
      <Circle cx={23} cy={23} r={18} fill="none" stroke={c.primary} strokeWidth={5} strokeDasharray={`${circumference * progress / 100} ${circumference}`} rotation={-90} origin="23,23" strokeLinecap="round" />
    </Svg>
  </View>;
}

/** Shared zero baseline; negative margins extend left instead of pretending to be a positive share. */
export function BusinessBars({ title, rows, maximum }: { title: string; rows: { label: string; value: number; formatted: string }[]; maximum?: number }) {
  const c = useBaitlyTheme(); const { i18n } = useTranslation();
  const signed = rows.some(row => row.value < 0);
  const bound = maximum && maximum > 0 ? maximum : Math.max(...rows.map(row => Math.abs(row.value)), 0);
  return <View style={[styles.card, { backgroundColor: c.surface }]}>
    <BaitlyText variant="heading">{title}</BaitlyText>
    {rows.map((row, index) => {
      const width = bound > 0 ? Math.min(1, Math.abs(row.value) / bound) * (signed ? 50 : 100) : 0;
      return <View key={`${row.label}-${index}`} accessible accessibilityLabel={`${row.label} : ${row.formatted}`} style={{ gap: 7 }}>
        <View style={{ flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' : 'row', justifyContent: 'space-between', gap: 10 }}>
          <BaitlyText muted variant="meta" style={{ flex: 1 }}>{row.label}</BaitlyText><BaitlyText variant="meta" style={{ fontVariant: ['tabular-nums'], fontWeight: '600' }}>{row.formatted}</BaitlyText>
        </View>
        <View style={[styles.track, { backgroundColor: c.muted }]}>
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${signed ? row.value < 0 ? 50-width : 50 : 0}%`, width: `${width}%`, borderRadius: 4, backgroundColor: row.value < 0 ? c.danger : c.primary }} />
          {signed ? <View style={{ position: 'absolute', left: '50%', width: 1, top: -2, bottom: -2, backgroundColor: c.secondary }} /> : null}
        </View>
      </View>;
    })}
  </View>;
}
const styles = StyleSheet.create({ card: { padding: 16, borderRadius: 14, gap: 16 }, track: { height: 8, borderRadius: 4 } });

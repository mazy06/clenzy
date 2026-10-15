import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BaitlyAnimatedLogo } from '@/components/ui/BaitlyAnimatedLogo';
import { Reicon } from '@/icons';
import { useBaitlyTheme } from './theme';

export function BaitlyHeaderLogo() { return <BaitlyAnimatedLogo scale={0.6} />; }

/** Geometrically centered logo, independent of the actions on either side. */
export function BaitlyHeader({ start, end }: { start?: React.ReactNode; end?: React.ReactNode }) {
  const { i18n } = useTranslation();
  return <View style={[styles.header, { flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' : 'row' }]}>
    <View style={styles.side}>{start}</View>
    <View pointerEvents="none" style={styles.center}><BaitlyHeaderLogo /></View>
    <View style={styles.side}>{end}</View>
  </View>;
}

export function BaitlyHeaderAction({ icon, label, onPress }: {
  icon: React.ComponentProps<typeof Reicon>['name']; label: string; onPress: () => void;
}) {
  const colors = useBaitlyTheme();
  const [focused, setFocused] = React.useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [styles.action, { backgroundColor: pressed ? colors.muted : 'transparent', borderColor: focused ? colors.primary : 'transparent' }]}>
    <Reicon name={icon} size={22} color={colors.ink} />
  </Pressable>;
}
const styles = StyleSheet.create({
  header: { width: '100%', minHeight: 44, alignItems: 'center', justifyContent: 'space-between' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  side: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1 },
});

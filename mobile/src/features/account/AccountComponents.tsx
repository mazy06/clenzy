import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Reicon } from '@/icons';
import { BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';

export function AccountGroup({ title, children }: React.PropsWithChildren<{ title: string }>) {
  const colors = useBaitlyTheme();
  return <View style={styles.group}><BaitlyText variant="meta" style={styles.groupTitle}>{title}</BaitlyText>
    <View style={[styles.groupSurface, { backgroundColor: colors.surface }]}>{children}</View></View>;
}
export function AccountRow({ title, icon, detail, onPress, danger = false, last = false, busy = false, selected }: {
  title: string; icon: React.ComponentProps<typeof Reicon>['name']; detail?: string;
  onPress: () => void; danger?: boolean; last?: boolean; busy?: boolean; selected?: boolean;
}) {
  const colors = useBaitlyTheme();
  const { i18n } = useTranslation();
  const [focused, setFocused] = useState(false);
  const tint = danger ? colors.danger : colors.ink;
  // A row with `selected` is one option of an exclusive choice: radio, not navigation.
  const choice = selected !== undefined;
  return <Pressable accessibilityRole={choice ? 'radio' : 'button'} accessibilityLabel={detail ? `${title}, ${detail}` : title}
    accessibilityState={{ disabled: busy, busy, selected }} disabled={busy} onPress={onPress}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [styles.row, { flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' : 'row',
      backgroundColor: pressed ? colors.muted : 'transparent', opacity: busy ? 0.5 : 1,
      borderColor: focused ? colors.primary : 'transparent' }]}>
    <Reicon name={icon} size={21} color={tint} />
    <View style={[styles.rowBody, { borderBottomColor: last ? 'transparent' : colors.border }]}>
      <BaitlyText style={[styles.rowTitle, { color: tint }]}>{title}</BaitlyText>
      {detail ? <BaitlyText muted variant="meta" numberOfLines={1}>{detail}</BaitlyText> : null}
    </View>
    {choice ? <View style={[styles.radio, { borderColor: selected ? colors.ink : colors.secondary, backgroundColor: selected ? colors.ink : 'transparent' }]}>
      {selected ? <Reicon name="checkmark" size={14} color={colors.background} /> : null}
    </View> : <Reicon name={i18n.dir() === 'rtl' ? 'chevron-back' : 'chevron-forward'} size={17} color={colors.secondary} />}
  </Pressable>;
}
export const accountStyles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  avatar: { width: 66, height: 66, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 24, fontWeight: '600' }, identityBody: { flex: 1, gap: 3 },
  name: { fontSize: 23, lineHeight: 30, fontWeight: '600' },
  role: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  organization: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8 },
  admin: { minHeight: 112, borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  adminBody: { flex: 1, gap: 6 }, adminArt: { width: 72, height: 72 },
  logout: { minHeight: 48, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  footer: { gap: 6, paddingTop: 4, paddingBottom: 8 }, fields: { gap: 18 },
});
const styles = StyleSheet.create({
  group: { gap: 8 }, groupTitle: { fontWeight: '600', paddingStart: 4 },
  groupSurface: { borderRadius: 20, overflow: 'hidden' },
  row: { alignItems: 'center', paddingStart: 16, paddingEnd: 14, gap: 13, minHeight: 58, borderWidth: 1 },
  rowBody: { flex: 1, minHeight: 57, paddingVertical: 15, justifyContent: 'center', gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  rowTitle: { fontSize: 15, lineHeight: 22 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});

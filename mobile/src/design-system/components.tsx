import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps, TextProps, StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useBaitlyTheme } from './theme';
import { useHeaderHeight } from '@react-navigation/elements';
import { BaitlyHeader } from './BaitlyHeader';
import { Reicon, type IconName } from '@/icons';

export function BaitlyText({ variant = 'body', muted = false, style, ...props }: TextProps & {
  variant?: 'title' | 'heading' | 'body' | 'meta'; muted?: boolean;
}) {
  const c = useBaitlyTheme();
  const { i18n } = useTranslation();
  return <Text {...props} style={[styles[variant], { color: muted ? c.secondary : c.ink,
    textAlign: i18n.dir() === 'rtl' ? 'right' : 'left' }, style]} />;
}

export function BaitlyScreen({ title, subtitle, children, scroll = true, scrollEnabled = true, actions, header, headerStyle, showHeader = true, footer }: React.PropsWithChildren<{
  title?: string; subtitle?: string; scroll?: boolean; scrollEnabled?: boolean; actions?: React.ReactNode; header?: React.ReactNode; headerStyle?: StyleProp<ViewStyle>; showHeader?: boolean; footer?: React.ReactNode;
}>) {
  const c = useBaitlyTheme();
  const { i18n } = useTranslation();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  return <SafeAreaView edges={!showHeader ? [] : headerHeight ? ['left', 'right'] : ['top', 'left', 'right']} style={[styles.screen, { backgroundColor: c.background }]}>
    {showHeader && (header || !headerHeight) ? <View style={[styles.header, headerStyle]}>
      {header ?? <BaitlyHeader end={actions} />}
    </View> : null}
    {title && title !== 'Baitly' ? <View style={styles.screenTitle}>
      <BaitlyText variant="heading" accessibilityRole="header">{title}</BaitlyText>
      {subtitle ? <BaitlyText muted variant="meta">{subtitle}</BaitlyText> : null}
    </View> : null}
    <KeyboardAvoidingView style={styles.screen} keyboardVerticalOffset={headerHeight} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {scroll ? <ScrollView scrollEnabled={scrollEnabled} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>{children}</ScrollView> : children}
      {footer ? <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12) + 8, backgroundColor: c.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>{footer}</View> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export type BaitlyButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
/**
 * One shape for every action. `primary` = the single main action of a screen; `secondary` = an
 * alternative; `ghost` = a quiet text action (cancel, see more); `danger` = destructive.
 */
export function BaitlyButton({ title, onPress, secondary = false, variant, icon, disabled = false, busy = false, selected }: {
  title: string; onPress: () => void; secondary?: boolean; variant?: BaitlyButtonVariant; icon?: IconName; disabled?: boolean; busy?: boolean; selected?: boolean;
}) {
  const c = useBaitlyTheme();
  const { i18n } = useTranslation();
  const [focused, setFocused] = React.useState(false);
  const kind = variant ?? (secondary ? 'secondary' : 'primary');
  const background = kind === 'primary' ? c.primary : kind === 'secondary' ? c.muted : kind === 'danger' ? c.dangerSoft : 'transparent';
  const foreground = kind === 'primary' ? c.onPrimary : kind === 'danger' ? c.danger : c.ink;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: disabled || busy, busy, selected }}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [styles.button, kind === 'ghost' && styles.ghostButton,
      { flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' : 'row', borderWidth: 2, borderColor: focused ? kind === 'primary' ? c.onPrimary : c.primary : 'transparent',
        backgroundColor: pressed && kind === 'ghost' ? c.muted : background, opacity: disabled ? 0.45 : busy ? 0.7 : pressed && kind !== 'ghost' ? 0.82 : 1 }]}>
    {busy ? <ActivityIndicator size="small" color={foreground} /> : icon ? <Reicon name={icon} size={20} color={foreground} /> : null}
    <BaitlyText numberOfLines={2} style={{ color: foreground, fontWeight: '600', textAlign: 'center', flexShrink: 1 }}>{title}</BaitlyText>
  </Pressable>;
}

export function BaitlyField({ label, style, inputRef, ...props }: TextInputProps & { label: string; inputRef?: React.Ref<TextInput> }) {
  const c = useBaitlyTheme();
  const { i18n } = useTranslation();
  const [focused, setFocused] = React.useState(false);
  return <View style={styles.fieldGroup}><BaitlyText variant="meta">{label}</BaitlyText>
    <TextInput {...props} ref={inputRef} accessibilityLabel={label} placeholderTextColor={c.secondary}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }} onBlur={e => { setFocused(false); props.onBlur?.(e); }}
      style={[styles.field, { color: c.ink, backgroundColor: c.surface, borderColor: focused ? c.primary : c.secondary,
        textAlign: i18n.dir() === 'rtl' ? 'right' : 'left' }, props.multiline && styles.multiline, style]} />
  </View>;
}

export type BaitlyTone = 'info' | 'warning' | 'success' | 'error';
const toneIcon: Record<BaitlyTone, IconName> = { info: 'information-circle-outline', warning: 'warning-outline', success: 'checkmark-circle-outline', error: 'alert-circle-outline' };
/** A message about the screen state; the tone carries meaning beyond colour through its icon. */
export function BaitlyNotice({ children, error = false, tone }: React.PropsWithChildren<{ error?: boolean; tone?: BaitlyTone }>) {
  const c = useBaitlyTheme();
  const { i18n } = useTranslation();
  const kind = tone ?? (error ? 'error' : 'info');
  const colors = { info: [c.muted, c.ink], warning: [c.warningSoft, c.warning], success: [c.successSoft, c.success], error: [c.dangerSoft, c.danger] }[kind];
  return <View accessibilityRole={kind === 'error' ? 'alert' : undefined} style={[styles.notice, { backgroundColor: colors[0], flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' : 'row' }]}>
    <Reicon name={toneIcon[kind]} size={20} color={colors[1]} />
    {typeof children === 'string' || typeof children === 'number' || Array.isArray(children)
      ? <BaitlyText style={{ flex: 1, color: kind === 'info' ? c.ink : colors[1] }}>{children}</BaitlyText>
      : <View style={{ flex: 1, gap: 8 }}>{children}</View>}
  </View>;
}

export function BaitlyRow({ title, subtitle, detail, onPress }: {
  title: string; subtitle?: string | null; detail?: string | null; onPress?: () => void;
}) {
  const c = useBaitlyTheme();
  const content = <><BaitlyText variant="heading">{title}</BaitlyText>
    {subtitle ? <BaitlyText muted>{subtitle}</BaitlyText> : null}
    {detail ? <BaitlyText variant="meta" style={styles.numeric}>{detail}</BaitlyText> : null}</>;
  const rowStyle = [styles.row, { borderBottomColor: c.border }];
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => [rowStyle, pressed && { backgroundColor: c.muted }]}>{content}</Pressable> : <View style={rowStyle}>{content}</View>;
}

export function BaitlyLoading() {
  const c = useBaitlyTheme();
  const { t } = useTranslation('mobileV1');
  return <View accessibilityLabel={t('loading')} accessibilityState={{ busy: true }} style={styles.content}>
    {[0, 1, 2].map(key => <View key={key} style={[styles.skeleton, { backgroundColor: c.muted }]} />)}
  </View>;
}

/** Empty or failed state: says what happened and offers the one useful next step. */
export function BaitlyEmpty({ title, message, retry, icon, actionLabel, onAction }: {
  title: string; message?: string; retry?: () => void; icon?: IconName; actionLabel?: string; onAction?: () => void;
}) {
  const { t } = useTranslation('mobileV1');
  const c = useBaitlyTheme();
  return <View style={[styles.content, styles.empty]}>
    <View style={[styles.emptyIcon, { backgroundColor: c.muted }]}><Reicon name={icon ?? (retry ? 'alert-circle-outline' : 'folder-outline')} size={28} color={c.secondary} /></View>
    <BaitlyText variant="heading" style={styles.centered}>{title}</BaitlyText>
    {message ? <BaitlyText muted style={styles.centered}>{message}</BaitlyText> : null}
    {onAction && actionLabel ? <BaitlyButton title={actionLabel} onPress={onAction} /> : null}
    {retry ? <BaitlyButton title={t('retry')} icon="refresh-outline" onPress={retry} secondary /> : null}</View>;
}

export const baitlyStyles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  group: { gap: 12 },
});
const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 8 },
  screenTitle: { paddingHorizontal: 16, paddingBottom: 12, gap: 4 },
  headerText: { flex: 1, gap: 4 }, content: { padding: 16, paddingBottom: 32, gap: 16 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '600' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 }, meta: { fontSize: 14, lineHeight: 20 },
  numeric: { fontVariant: ['tabular-nums'] },
  button: { minHeight: 52, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 8 },
  ghostButton: { minHeight: 44 },
  fieldGroup: { gap: 6 }, field: { minHeight: 52, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 16 },
  multiline: { minHeight: 120, textAlignVertical: 'top' }, notice: { padding: 14, borderRadius: 14, gap: 10, alignItems: 'flex-start' },
  empty: { alignItems: 'center', paddingVertical: 32 }, emptyIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  centered: { textAlign: 'center' },
  row: { paddingVertical: 16, paddingHorizontal: 4, gap: 5, minHeight: 80, borderBottomWidth: 1 },
  skeleton: { height: 88, borderRadius: 14 },
});

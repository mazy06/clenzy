import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import { providerRating } from './domain';

export function BaitlyProviderRating({ average, count, compact = false }: {
  average?: number | null; count?: number; compact?: boolean;
}) {
  const { t, i18n } = useTranslation('mobileV1');
  const colors = useBaitlyTheme();
  const rating = providerRating(average, count);
  const reviewed = typeof count === 'number' && Number.isInteger(count) && count > 0;
  const number = rating == null ? '' : new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(rating);
  const label = reviewed ? t('providerReviewCount', { count }) : t('providerNoReviews');
  return <View accessible accessibilityLabel={rating == null ? label : `${number}/5, ${label}`}
    style={[styles.row, { flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' : 'row' }]}>
    <Reicon name={rating == null ? 'star-outline' : 'star'} size={compact ? 13 : 16} color={colors.ink} />
    {rating != null ? <BaitlyText style={[styles.score, compact && styles.compact]}>{number}</BaitlyText> : null}
    <BaitlyText muted style={[styles.label, compact && styles.compact]}>{compact && rating != null ? `(${count})` : label}</BaitlyText>
  </View>;
}
const styles = StyleSheet.create({
  row: { alignItems: 'center', gap: 4 },
  score: { fontSize: 15, lineHeight: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  label: { fontSize: 13, lineHeight: 20, fontVariant: ['tabular-nums'] },
  compact: { fontSize: 12, lineHeight: 17 },
});

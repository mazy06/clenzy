import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import type { CatalogReview } from './api';
import { PublicAvatar } from './PublicAvatar';

export function BaitlyDemoReview({ review, onOpenClient }: { review: CatalogReview; onOpenClient: (id: string) => void }) {
  const { t, i18n } = useTranslation('mobileV1');
  const colors = useBaitlyTheme();
  const row = { flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' as const : 'row' as const };
  const date = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${review.reviewedOn}T12:00:00Z`));
  return <View style={[styles.review, { borderBottomColor: colors.border }]}>
    <Pressable accessibilityRole={review.clientProfileId?'button':undefined} disabled={!review.clientProfileId} accessibilityLabel={t('viewClientProfile', { name: review.clientName })}
      onPress={() => {if(review.clientProfileId)onOpenClient(review.clientProfileId);}}
      style={({ pressed }) => [styles.header, row, { backgroundColor: pressed ? colors.muted : 'transparent' }]}>
      <PublicAvatar demo={review.demo} portraitIndex={review.portraitIndex} avatarUrl={review.avatarUrl} />
      <View style={styles.author}>
        <BaitlyText style={styles.name}>{review.clientName}</BaitlyText>
        <BaitlyText muted style={styles.meta}>{t(review.clientRole === 'OWNER' ? 'reviewOwner' : review.clientRole==='CONCIERGE'?'reviewConcierge':'reviewClient')}</BaitlyText>
      </View>
      <BaitlyText muted style={styles.date}>{date}</BaitlyText>
      {review.clientProfileId?<Reicon name={i18n.dir() === 'rtl' ? 'chevron-back' : 'chevron-forward'} color={colors.secondary} size={15} />:null}
    </Pressable>
    <View accessible accessibilityLabel={`${review.rating}/5`} style={[styles.stars, row]}>
      {[1, 2, 3, 4, 5].map(value => <Reicon key={value} name={value <= review.rating ? 'star' : 'star-outline'} size={14} color={colors.warning} />)}
    </View>
    {review.clientOrganization ? <BaitlyText muted style={styles.meta}>{review.clientOrganization}</BaitlyText> : null}
    <BaitlyText style={styles.feedback}>{review.feedback}</BaitlyText>
    <BaitlyText muted style={styles.meta}>{review.serviceLabel}</BaitlyText>
  </View>;
}
const styles = StyleSheet.create({
  review: { paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  header: { alignItems: 'center', gap: 9, minHeight: 44, borderRadius: 6 },
  author: { flex: 1, gap: 1 },
  name: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  meta: { fontSize: 12, lineHeight: 18 },
  date: { fontSize: 12, lineHeight: 18, maxWidth: '28%', fontVariant: ['tabular-nums'] },
  stars: { alignItems: 'center', gap: 3 },
  feedback: { fontSize: 14, lineHeight: 21 },
});

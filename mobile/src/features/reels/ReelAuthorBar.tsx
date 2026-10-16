import React from 'react';
import { Linking, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { BaitlyText } from '@/design-system/components';
import { PublicAvatar } from '@/features/marketplace/PublicAvatar';
import { baitlyMediaUrl } from '@/api/baitlyMedia';
import { Reicon } from '@/icons';
import type { Reel } from './api';

/** Author identity and existing public contact journeys, without exposing private account data. */
export function ReelAuthorBar({ reel, onLayout }: { reel: Reel; onLayout: (event: LayoutChangeEvent) => void }) {
  const { t, i18n } = useTranslation('mobileV1');
  const navigation = useNavigation<NativeStackNavigationProp<BaitlyStackParams>>();
  const insets = useSafeAreaInsets();
  const creator = reel.creator;
  const publicProfileId = creator?.publicProfileId;
  const providerId = creator?.providerId;
  const hasProfile = !!publicProfileId || providerId != null;
  const row = { flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' as const : 'row' as const };
  const name = creator?.name || reel.author.displayName;
  const role = creator?.role ? t(creator.role === 'CONCIERGE' ? 'reelAuthorConcierge'
    : creator.role === 'PROVIDER' ? 'reelAuthorProvider' : 'reelAuthorOwner') : null;
  const detail = [role, creator?.city, reel.author.instagramUsername ? `@${reel.author.instagramUsername}` : null].filter(Boolean).join(' · ');
  const openProfile = () => {
    if (publicProfileId) navigation.navigate('PublicClientProfile', { clientProfileId: publicProfileId });
    else if (providerId != null) navigation.navigate('Provider', { providerId });
    else void Linking.openURL(reel.permalink).catch(() => {});
  };
  const contactKind = publicProfileId && creator?.offersManagement ? 'management'
    : providerId != null ? 'services' : publicProfileId && creator?.seekingManagement ? 'offer' : null;
  const contact = () => {
    if (contactKind === 'services' && providerId != null) navigation.navigate('Provider', { providerId });
    else if (publicProfileId) navigation.navigate('PublicClientProfile', { clientProfileId: publicProfileId, contact: true });
  };
  return <View onLayout={onLayout} style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${t(hasProfile ? 'reelViewProfile' : 'reelOpenInstagram')} · ${name}`}
      onPress={openProfile} style={({ pressed }) => [styles.identity, row, pressed && styles.pressed]}>
      <PublicAvatar avatarUrl={baitlyMediaUrl(creator?.avatarUrl)} size={44} />
      <View style={styles.identityCopy}>
        <BaitlyText style={styles.name} numberOfLines={1}>{name}</BaitlyText>
        {detail ? <BaitlyText style={styles.detail} numberOfLines={2}>{detail}</BaitlyText> : null}
      </View>
      <Reicon name={i18n.dir() === 'rtl' ? 'chevron-back' : 'chevron-forward'} size={20} color="#CBD5DF" />
    </Pressable>
    {reel.caption.trim() ? <BaitlyText style={styles.caption} numberOfLines={2}>{reel.caption}</BaitlyText> : null}
    <View style={[styles.links, row]}>
      <Pressable accessibilityRole="button" onPress={openProfile}
        style={({ pressed }) => [styles.profileLink, row, pressed && styles.pressed]}>
        <BaitlyText style={styles.profileLabel}>{t(hasProfile ? 'reelViewProfile' : 'reelOpenInstagram')}</BaitlyText>
        <Reicon name="open-outline" size={16} color="#E8EEF5" />
      </Pressable>
      {contactKind ? <Pressable accessibilityRole="button" onPress={contact}
        style={({ pressed }) => [styles.contact, pressed && styles.pressed]}>
        <BaitlyText style={styles.contactLabel}>{t(contactKind === 'management' ? 'reelEntrustProperty'
          : contactKind === 'services' ? 'reelViewServices' : 'reelOfferManagement')}</BaitlyText>
      </Pressable> : null}
    </View>
    {reel.author.tiktokUrl || reel.author.youtubeUrl ? <View style={[styles.links, row]}>
      {([['TikTok', reel.author.tiktokUrl], ['YouTube', reel.author.youtubeUrl]] as const).map(([label, url]) => url ?
        <Pressable key={label} accessibilityRole="link" onPress={() => { void Linking.openURL(url).catch(() => {}); }}
          style={({ pressed }) => [styles.profileLink, pressed && styles.pressed]}>
          <BaitlyText style={styles.profileLabel}>{label}</BaitlyText>
        </Pressable> : null)}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', bottom: 0, start: 0, end: 0, backgroundColor: '#101820', paddingHorizontal: 20,
    paddingTop: 16, gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#34434F' },
  identity: { alignItems: 'center', gap: 12, minHeight: 48 }, identityCopy: { flex: 1, gap: 3 },
  name: { color: '#FBFCFD', fontSize: 16, lineHeight: 22, fontWeight: '600' },
  detail: { color: '#CBD5DF', fontSize: 12, lineHeight: 17 },
  caption: { color: '#E8EEF5', fontSize: 14, lineHeight: 20 },
  links: { flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 8 },
  profileLink: { alignItems: 'center', gap: 6, minHeight: 44 },
  profileLabel: { color: '#E8EEF5', fontSize: 13, lineHeight: 18, fontWeight: '500' },
  contact: { marginStart: 'auto', minHeight: 44, justifyContent: 'center', backgroundColor: '#E8EEF5',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  contactLabel: { color: '#1B2A35', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});

import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Reicon } from '@/icons';
import { useBaitlyTheme } from '@/design-system/theme';
import { BaitlyDemoAvatar } from './BaitlyDemoAvatar';

export function PublicAvatar({ demo, portraitIndex, avatarUrl, size = 40 }: { demo?: boolean; portraitIndex?: number; avatarUrl?: string | null; size?: number }) {
  const colors = useBaitlyTheme();
  if (demo && portraitIndex != null) return <BaitlyDemoAvatar index={portraitIndex} size={size} />;
  return <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}>
    {avatarUrl ? <Image source={avatarUrl} contentFit="cover" style={{ width: size, height: size }} /> : <Reicon name="person-outline" size={size / 2} color={colors.secondary} />}
  </View>;
}

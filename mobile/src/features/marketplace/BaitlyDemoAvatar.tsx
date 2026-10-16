import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
const portraits = require('../../../assets/baitly/providers/baitly-demo-review-portraits.png');

export function BaitlyDemoAvatar({ index, size = 40 }: { index: number; size?: number }) {
  if (!Number.isInteger(index) || index < 0 || index > 5) return null;
  return <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
    {/* Atlas geometry does not mirror with the interface direction. */}
    <Image source={portraits} accessible={false} contentFit="fill"
      style={[styles.atlas, { width: size * 3, height: size * 2, left: -(index % 3) * size, top: -Math.floor(index / 3) * size }]} />
  </View>;
}
const styles = StyleSheet.create({ atlas: { position: 'absolute' } });

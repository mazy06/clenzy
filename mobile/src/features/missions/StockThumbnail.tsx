import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { baitlyPrivateImageSource } from '@/api/baitlyMedia';
import catalog from './baitlyStockCatalog.json';
const sheets: Record<string, number> = {
  linen: require('../../../assets/baitly/stock/linen.webp'), 'kitchen-linen': require('../../../assets/baitly/stock/kitchen-linen.webp'),
  toiletries: require('../../../assets/baitly/stock/toiletries.webp'), cleaning: require('../../../assets/baitly/stock/cleaning.webp'),
  consumables: require('../../../assets/baitly/stock/consumables.webp'), 'laundry-dishes': require('../../../assets/baitly/stock/laundry-dishes.webp'),
  drinks: require('../../../assets/baitly/stock/drinks.webp'), beverages: require('../../../assets/baitly/stock/beverages.webp'),
  breakfast: require('../../../assets/baitly/stock/breakfast.webp'), pantry: require('../../../assets/baitly/stock/pantry.webp'),
  'fresh-food': require('../../../assets/baitly/stock/fresh-food.webp'), snacks: require('../../../assets/baitly/stock/snacks.webp'),
  'welcome-kits': require('../../../assets/baitly/stock/welcome-kits.webp'),
};
const normalize = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function StockThumbnail({ name, catalogKey, photoUrl, size = 64 }: { name: string; catalogKey?: string; photoUrl?: string; size?: number }) {
  const matches = catalog.filter(item => Object.values(item.names).some(value => normalize(value) === normalize(name)) || item.aliases?.some(value => normalize(value) === normalize(name)));
  const entry = catalog.find(item => item.key === catalogKey) ?? (matches.length === 1 ? matches[0] : undefined);
  if (photoUrl) return <Image source={baitlyPrivateImageSource(photoUrl)} cachePolicy="none" contentFit="contain" style={{ width: size, height: size }} accessible={false} />;
  const slot = entry?.image.slot ?? 15; const grid = entry && 'grid' in entry.image ? Number(entry.image.grid) : 4;
  return <View style={{ width: size, height: size, overflow: 'hidden' }} accessible={false}>
    <Image source={sheets[entry?.image.sheet ?? 'consumables']} contentFit="fill" style={{ position: 'absolute', width: size * grid, height: size * grid, left: -(slot % grid) * size, top: -Math.floor(slot / grid) * size }} />
  </View>;
}

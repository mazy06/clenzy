import React, { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { BaitlyButton, BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { stockPrice } from './restockModel';

export function QuantityCounter({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }) {
  const c = useBaitlyTheme(); const count = Number(value) || 0;
  return <View style={{ flex: 1, gap: 6 }}><BaitlyText muted variant="meta">{label}</BaitlyText>
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.muted, borderRadius: 14 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} −`} disabled={disabled || count <= 0} onPress={() => onChange(String(count - 1))} style={{ width: 44, height: 48, alignItems: 'center', justifyContent: 'center' }}><BaitlyText style={{ fontSize: 25 }}>−</BaitlyText></Pressable>
      <BaitlyText style={{ flex: 1, fontSize: 20, textAlign: 'center', fontWeight: '600', fontVariant: ['tabular-nums'] }}>{count}</BaitlyText>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} +`} disabled={disabled || count >= 10000} onPress={() => onChange(String(count + 1))} style={{ width: 44, height: 48, alignItems: 'center', justifyContent: 'center' }}><BaitlyText style={{ fontSize: 25 }}>+</BaitlyText></Pressable>
    </View>
  </View>;
}
export function RestockPricePad({ visible, value, currency, onClose, onConfirm }: { visible: boolean; value: string; currency: string; onClose: () => void; onConfirm: (price: string) => void }) {
  const c = useBaitlyTheme(); const { t } = useTranslation('mobileV1'); const [price, setPrice] = useState('');
  useEffect(() => { if (visible) setPrice(value); }, [visible, value]);
  const press = (key: string) => {
    if (key === '⌫') { setPrice(value => value.slice(0, -1)); return; }
    const next = key === '.' && !price ? '0.' : price + key;
    if (/^\d{0,6}(\.\d{0,2})?$/.test(next)) setPrice(next);
  };
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><SafeAreaProvider initialMetrics={initialWindowMetrics}>
    <View style={{ flex: 1, backgroundColor: 'rgba(27,42,53,0.35)', justifyContent: 'flex-end' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('cancel')} onPress={onClose} style={{ flex: 1 }} />
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: c.background, padding: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 12 }}>
        <BaitlyText muted variant="meta">{t('restockUnitPrice')} · {currency}</BaitlyText><BaitlyText style={{ fontSize: 32, fontVariant: ['tabular-nums'] }}>{price || '···'}</BaitlyText>
        {['123', '456', '789', '.0⌫'].map(row => <View key={row} style={{ flexDirection: 'row', gap: 8 }}>
          {[...row].map(key => <Pressable key={key} accessibilityRole="button" accessibilityLabel={key} onPress={() => press(key)} style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: c.surface, justifyContent: 'center', alignItems: 'center' }}><BaitlyText style={{ fontSize: 24 }}>{key}</BaitlyText></Pressable>)}
        </View>)}
        <BaitlyButton title={t('confirm')} disabled={stockPrice(price) === null} onPress={() => onConfirm(price)} />
      </SafeAreaView>
    </View></SafeAreaProvider></Modal>;
}

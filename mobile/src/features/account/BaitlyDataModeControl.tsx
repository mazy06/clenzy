import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { canUseBaitlyDemo, useBaitlyDataMode } from '@/config/baitlyDataMode';
import { BaitlyButton, BaitlyText } from '@/design-system/components';

/** Local development control only; session-scoped and never available in production. */
export function BaitlyDataModeControl() {
  const { t } = useTranslation('mobileV1');
  const mode = useBaitlyDataMode(s => s.mode);
  const setMode = useBaitlyDataMode(s => s.setMode);
  if (!canUseBaitlyDemo()) return null;
  return <View style={{ gap: 8 }}>
    <BaitlyText variant="meta" muted>{t(mode === 'demo' ? 'dataModeDemo' : 'dataModeReal')}</BaitlyText>
    <BaitlyButton secondary title={t(mode === 'demo' ? 'switchToReal' : 'switchToDemo')}
      onPress={() => setMode(mode === 'demo' ? 'real' : 'demo')} />
  </View>;
}

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Reicon } from '@/icons';
import { BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import type { MobileMission } from './api';
import { missionTiming, missionTimeWarning, timerText } from './missionTimingModel';

export function MissionTimer({ mission, compact = false }: { mission: MobileMission; compact?: boolean }) {
  const [now, setNow] = useState(Date.now()); const c = useBaitlyTheme(); const { t } = useTranslation('mobileV1');
  useEffect(() => {
    setNow(Date.now());
    if (mission.status !== 'IN_PROGRESS' || mission.pausedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [mission.status, mission.startTime, mission.pausedAt]);
  const { elapsed, remaining } = missionTiming(mission, now);
  const warning = missionTimeWarning(mission, now);
  if (elapsed === undefined) return null;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 4 : 10, paddingVertical: compact ? 0 : 8 }}>
    {!compact ? <Reicon name="time-outline" size={22} color={warning ? c.danger : c.secondary} /> : null}
    <BaitlyText accessibilityLabel={`${t('executionElapsed')} ${timerText(elapsed)}`} style={{ fontSize: compact ? 13 : 25, fontWeight: '600', fontVariant: ['tabular-nums'], color: warning ? c.danger : c.ink }}>{timerText(elapsed)}</BaitlyText>
    {!compact && remaining !== undefined ? <BaitlyText variant="meta" style={{ flex: 1, textAlign: 'right', color: remaining < 0 ? c.danger : c.secondary, fontVariant: ['tabular-nums'] }}>
      {remaining < 0 ? '+' : ''}{timerText(remaining)}{'\n'}{t(remaining < 0 ? 'executionOvertime' : 'executionRemaining')}
    </BaitlyText> : null}
  </View>;
}

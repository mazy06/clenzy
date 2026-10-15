import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BaitlyText } from '@/design-system/components';
import { Reicon } from '@/icons';
import { useBaitlyTheme } from '@/design-system/theme';
import { MissionPropertyPhotos } from './MissionPropertyPhotos';
import type { MissionSafetyState } from './baitlySafetyApi';
import type { RestockOverview } from './baitlyRestockApi';
import type { MobileMission } from './api';
import { MissionTimer } from './MissionTimer';
import { StockThumbnail } from './StockThumbnail';
import { MissionDamagePhotos } from './MissionDamagePhotos';
export function MissionRecap({ required, checked, before, after, demo, safety, stock, mission }: { required: string[]; checked: string[]; before: string[]; after: string[]; demo: boolean; safety?: MissionSafetyState; stock?: RestockOverview; mission: MobileMission }) {
  const { t, i18n } = useTranslation('mobileV1'); const c = useBaitlyTheme();
  return <View style={{ gap: 16 }}>
    <MissionTimer mission={mission} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>{required.map(step => <View key={step} style={{ width: '50%', paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 }}>
      <Reicon name={checked.includes(step) ? 'checkmark-circle-outline' : 'ellipse-outline'} size={20} color={checked.includes(step) ? c.success : c.secondary} /><BaitlyText variant="meta" style={{ flex: 1 }}>{t(`step.${step}`)}</BaitlyText></View>)}</View>
    {[{ label: 'beforePhotos', photos: before }, { label: 'afterPhotos', photos: after }].filter(section => section.photos.length).map(section => <View key={section.label} style={{ gap: 8 }}>
      <BaitlyText style={{ fontWeight: '600' }}>{t(section.label)} · {section.photos.length}</BaitlyText><MissionPropertyPhotos photos={section.photos} demo={demo} /></View>)}
    {stock?.history.flatMap(receipt => receipt.entries).filter(entry => entry.added > 0).map((entry, index) => {
      const item = stock.items.find(item => item.id === entry.itemId);
      return <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <StockThumbnail name={entry.name} catalogKey={item?.catalogKey} photoUrl={item?.photoUrl} size={44} />
        <View style={{ flex: 1, gap: 3 }}><BaitlyText variant="meta">{entry.name}</BaitlyText><BaitlyText muted variant="meta" style={{ fontVariant: ['tabular-nums'] }}>+{entry.added}{entry.unit ? ` ${entry.unit}` : ''}</BaitlyText></View>
        <BaitlyText variant="meta" style={{ fontVariant: ['tabular-nums'] }}>{new Intl.NumberFormat(i18n.language, { style: 'currency', currency: entry.currency }).format(entry.amount)}</BaitlyText></View>;
    })}
    {safety?.incidents.map(incident => <View key={incident.id} style={{ gap: 4 }}><BaitlyText style={{ fontWeight: '600' }}>{incident.title}</BaitlyText><BaitlyText muted variant="meta">{incident.description}</BaitlyText><MissionDamagePhotos id={mission.id} issueId={incident.id}/></View>)}
  </View>;
}

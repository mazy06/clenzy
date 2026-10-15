import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import type { MissionRoom } from './api';
import { RoomIllustration } from './RoomIllustration';

export function InspectionRooms({ rooms, counts, pending, disabled, onPhoto, validation = false }: {
  rooms: MissionRoom[]; counts: Record<string, number>; pending: string[]; disabled: boolean; onPhoto: (room: MissionRoom) => void; validation?: boolean;
}) {
  const c = useBaitlyTheme(); const { t } = useTranslation('mobileV1');
  const completed = rooms.filter(room => (counts[`inspection_${room.id}`] ?? 0) > 0).length;
  return <View style={{ gap: 8 }}>
    <BaitlyText muted variant="meta">{completed}/{rooms.length} · {t(validation ? 'executionRoomsValidated' : 'inspectionRoomPhotos')}</BaitlyText>
    {!rooms.length ? <BaitlyText muted>{t('inspectionMissingRooms')}</BaitlyText> : null}
    {rooms.map(room => { const done = (counts[`inspection_${room.id}`] ?? 0) > 0; const waiting = pending.includes(room.id);
      return <Pressable key={room.id} accessibilityRole={validation ? 'checkbox' : 'button'} accessibilityLabel={t(`inspectionRoom.${room.type}`, { number: room.number })}
        accessibilityState={{ checked: validation ? done : undefined, disabled: disabled || (!validation && (done || waiting)) }} disabled={disabled || (!validation && (done || waiting))} onPress={() => onPhoto(room)}
        style={({ pressed }) => ({ minHeight: 72, padding: 12, gap: 12, flexDirection: 'row', alignItems: 'center', borderRadius: 18, backgroundColor: pressed ? c.muted : c.surface })}>
        <RoomIllustration type={room.type} size={44}/>
        <View style={{ flex: 1 }}><BaitlyText>{t(`inspectionRoom.${room.type}`, { number: room.number })}</BaitlyText>
          {waiting ? <BaitlyText muted variant="meta">{t('photoPending')}</BaitlyText> : null}</View>
        {validation && !done ? <View style={{ width: 25, height: 25, borderWidth: 1, borderColor: c.secondary, borderRadius: 7 }} /> : <Reicon name={done ? 'checkmark-circle-outline' : 'camera-outline'} size={24} color={done ? c.success : c.ink} />}
      </Pressable>;
    })}
  </View>;
}

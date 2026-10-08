import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, RefreshCw } from '../../../icons/glyphs';
import { Button, Skeleton, Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { camerasApi } from '../../../services/api/camerasApi';
import { useTranslation } from '../../../hooks/useTranslation';
import CameraTile from '../cameras/CameraTile';
import type { ConnectedDevice } from '../types';

/** Only the selected camera is mounted. Playback always requires a deliberate action. */
export default function RoomCameraControls({ device }: { device: ConnectedDevice }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [active, setActive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const query = useQuery({ queryKey: ['cameras'], queryFn: () => camerasApi.getAll(), staleTime: 20_000 });
  const camera = query.data?.find(item => item.id === device.id);
  const refresh = async (play = false) => {
    if (refreshing) return;
    setRefreshing(true); setError(false); setActive(false);
    try {
      await camerasApi.refreshStream(device.id);
      const result = await query.refetch();
      if (result.isError) throw result.error;
      const updated = result.data?.find(item => item.id === device.id);
      setActive(play && !!updated?.online && !!updated.webrtcUrl);
      await queryClient.invalidateQueries({ queryKey: ['connected-objects'] });
    } catch { setError(true); }
    finally { setRefreshing(false); }
  };
  if (query.isLoading) return <Skeleton className="aspect-video w-full rounded-xl" />;
  if (query.isError || !camera) return <div className="bir-camera-empty" role="status">
    <img src="/images/connected-devices/baitly-camera.webp" alt="" width={64} height={64} />
    <p>{t('connectedRooms.inspector.cameraUnavailable')}</p>
    <Button variant="outline" size="sm" onClick={() => { void query.refetch(); }}>{t('common.retry')}</Button>
  </div>;
  return <div className="bir-camera-controls">
    <CameraTile compact camera={camera} active={active && camera.online} acting={refreshing} onToggle={() => {
      if (refreshing) return;
      if (active) setActive(false);
      else if (camera.brand?.toUpperCase() === 'TUYA') void refresh(true);
      else if (camera.webrtcUrl) setActive(true);
    }} />
    <div className="bir-camera-caption">
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={t('connectedRooms.inspector.cameraHint')}><Info size={14} /></Button></TooltipTrigger>
        <TooltipContent className="max-w-64">{t('connectedRooms.inspector.cameraHint')}</TooltipContent></Tooltip>
      <Button variant="ghost" size="sm" disabled={refreshing || query.isFetching} aria-label={t('connectedRooms.inspector.refreshVideo')}
        title={t('connectedRooms.inspector.refreshVideo')} onClick={() => { void refresh(); }}><RefreshCw size={14} />{t('common.refresh')}</Button>
    </div>
    {error && <p role="alert" className="bir-error">{t('connectedRooms.inspector.videoError')}</p>}
  </div>;
}

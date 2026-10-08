import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { thermostatsApi } from '../../../services/api/thermostatsApi';
import type { ConnectedDevice } from '../types';

/** Commands use the existing provider integration. A missing reading is never a zero. */
export default function RoomThermalControls({ device }: { device: ConnectedDevice }) {
  const { t, currentLanguage } = useTranslation();
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<'success' | 'error' | null>(null);
  const query = useQuery({ queryKey: ['room-thermostat', device.id], queryFn: () => thermostatsApi.getStatus(device.id), staleTime: 20_000 });
  const value = query.data;
  const canAdjust = !!value?.online && typeof value.targetTempC === 'number' && Number.isFinite(value.targetTempC) && !sending && !query.isFetching && !query.isError;
  const mode = ['cool', 'heat', 'off', 'eco'].includes(value?.mode ?? '') ? value!.mode! : 'unknown';
  const format = (n: number | null | undefined) => typeof n === 'number' && Number.isFinite(n) ? `${n.toLocaleString(currentLanguage, { maximumFractionDigits: 1 })} °C` : t('connectedRooms.notAvailable');
  const adjust = async (delta: number) => {
    if (!canAdjust || value?.targetTempC == null) return;
    setSending(true); setNotice(null);
    try {
      const updated = await thermostatsApi.setTarget(device.id, Math.round((value.targetTempC + delta) * 2) / 2);
      queryClient.setQueryData(['room-thermostat', device.id], updated);
      await queryClient.invalidateQueries({ queryKey: ['connected-objects'] });
      setNotice('success');
    } catch { setNotice('error'); }
    finally { setSending(false); }
  };
  return <div className="bir-thermal-controls">
    <div className="bir-thermal-reading"><div><span>{t('connectedRooms.measured')}</span><strong>{format(value?.currentTempC)}</strong></div>
      {(mode === 'heat' || mode === 'cool') && <img src={`/images/connected-devices/baitly-${mode === 'heat' ? 'sun' : 'snowflake'}.webp`} alt="" width={32} height={32} />}
      <span>{t(`connectedRooms.modes.${mode}`)}</span>
      <Button variant="ghost" size="icon" disabled={query.isFetching || sending} aria-label={t('connectedRooms.refresh')} onClick={() => { void query.refetch().then(() => queryClient.invalidateQueries({ queryKey: ['connected-objects'] })); }}><RefreshCw size={16} /></Button>
    </div>
    <div className="bir-thermal-target"><span>{t('connectedRooms.target')}</span>
      <Button variant="outline" size="icon" disabled={!canAdjust} aria-label={t('connectedObjects.thermostats.lower')} onClick={() => { void adjust(-0.5); }}><Minus size={16} /></Button>
      <strong aria-live="polite">{format(value?.targetTempC)}</strong>
      <Button variant="outline" size="icon" disabled={!canAdjust} aria-label={t('connectedObjects.thermostats.raise')} onClick={() => { void adjust(0.5); }}><Plus size={16} /></Button>
    </div>
    {query.isError && <p className="bir-error" role="alert">{t('connectedRooms.telemetryError')}</p>}
    {notice && <p className={notice === 'error' ? 'bir-error' : 'bir-command-status'} role={notice === 'error' ? 'alert' : 'status'}>{t(`connectedRooms.${notice === 'error' ? 'targetError' : 'targetSaved'}`)}</p>}
  </div>;
}

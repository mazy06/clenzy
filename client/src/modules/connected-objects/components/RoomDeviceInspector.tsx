import { Children, lazy, Suspense, useState } from 'react';
import { Battery, CheckCircle2, ChevronDown, CircleHelp, History, KeyRound, LockKeyhole, LockKeyholeOpen, Trash2, TriangleAlert, WifiOff } from '../../../icons/glyphs';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Skeleton } from '../../../components/ui';
import PageTabs from '../../../components/PageTabs';
import { useTranslation } from '../../../hooks/useTranslation';
import { useNotification } from '../../../hooks/useNotification';
import { DEVICE_KINDS, STATUS_TOKENS } from '../deviceRegistry';
import { deviceArtwork, deviceConnection } from '../roomModel';
import { isDeviceDeletable, type ConnectedDevice, type DeviceAction } from '../types';
import { useDeleteDevice } from '../useDeleteDevice';
import { useLockLiveStatus } from '../useLockLiveStatus';
import { useNoiseLiveStatus } from '../useNoiseLiveStatus';
import { useSensorLiveStatus } from '../useSensorLiveStatus';
import AccessCodeSection from './AccessCodeSection';
import RoomThermalControls from './RoomThermalControls';
import RoomCameraControls from './RoomCameraControls';
import './roomDeviceInspector.css';

const NoiseDetail = lazy(() => import('../device-details/NoiseDetail'));
const KeyboxDetail = lazy(() => import('../device-details/KeyboxDetail'));
const SensorDetail = lazy(() => import('../device-details/SensorDetail'));
const LockAccessCodeHistory = lazy(() => import('./LockAccessCodeHistory'));

export function DeviceState({ device }: { device: ConnectedDevice }) {
  const Icon = device.statusLevel === 'unknown' ? CircleHelp : device.statusLevel === 'offline' ? WifiOff
    : device.statusLevel === 'warning' || device.statusLevel === 'critical' ? TriangleAlert : CheckCircle2;
  return <span className="bir-state" style={{ color: STATUS_TOKENS[device.statusLevel].color }} title={device.statusLabel}>
    <Icon size={16} aria-hidden="true" /><span className="sr-only">{device.statusLabel}</span>
  </span>;
}

/** Commands still use the existing APIs and permissions; selecting a marker never operates a device. */
export default function RoomDeviceInspector({ device, acting, onAction, children }: {
  device: ConnectedDevice; acting: boolean; onAction: (uid: string, action: DeviceAction) => Promise<void> | void;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const { remove, removing } = useDeleteDevice();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockTab, setLockTab] = useState(0);
  const neverSynced = device.statusLevel === 'unknown';
  useLockLiveStatus(device.id, neverSynced && device.kind === 'lock');
  useNoiseLiveStatus(device.id, neverSynced && device.kind === 'noise');
  useSensorLiveStatus(device.id, neverSynced && ['climate', 'contact', 'motion', 'smoke'].includes(device.kind));
  const connection = deviceConnection(device);
  const state = (device.raw as { lockState?: string } | null)?.lockState?.toUpperCase();
  const knownLockState = state === 'LOCKED' || state === 'UNLOCKED';
  const execute = async (action: DeviceAction) => {
    setError(null);
    try { await onAction(device.uid, action); setConfirmUnlock(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('connectedRooms.actionError')); }
  };
  const deleteDevice = async () => {
    try { await remove(device); setConfirmDelete(false); }
    catch (cause) { notify.error(cause instanceof Error ? cause.message : t('connectedRooms.actionError')); }
  };
  return <section className="bir-inspector" aria-label={t('connectedRooms.deviceDetail')}>
    <header><img className="bir-inspector-art" src={deviceArtwork(device)} width={58} height={58} alt="" />
      <div><span className="bir-eyebrow">{t(DEVICE_KINDS[device.kind].singularKey)}</span><h3 dir="auto">{device.name}</h3></div>
      <DeviceState device={device} />
    </header>
    {device.kind !== 'camera' && <div className="bir-inspector-state-row"><p className="bir-device-status" style={{ color: STATUS_TOKENS[device.statusLevel].color }}>{device.statusLabel}</p>
      {device.kind === 'lock' && knownLockState && device.actions.includes(state === 'LOCKED' ? 'unlock' : 'lock') &&
        <Button disabled={acting || connection !== 'online'} onClick={() => state === 'LOCKED' ? setConfirmUnlock(true) : void execute('lock')}>
          {state === 'LOCKED' ? <LockKeyholeOpen size={16} /> : <LockKeyhole size={16} />}
          {t(acting ? 'connectedRooms.sending' : state === 'LOCKED' ? 'connectedRooms.unlock' : 'connectedRooms.lock')}
        </Button>}
    </div>}
    <div className={device.kind === 'camera' ? 'bir-camera-overview' : undefined}>
    {device.kind === 'camera' && <RoomCameraControls key={device.uid} device={device} />}
    <dl className="bir-inspector-facts">
      <div><dt>{t('connectedRooms.connection')}</dt><dd>{t(`connectedRooms.${connection}`)}</dd></div>
      <div><dt>{t('connectedRooms.provider')}</dt><dd>{device.provider === 'CLENZY_KEYVAULT' ? 'Baitly KeyVault' : device.provider === 'UNKNOWN' ? t('connectedRooms.notAvailable') : device.provider}</dd></div>
      {device.battery != null && <div><dt><Battery size={14} />{t('connectedRooms.battery')}</dt><dd>{device.battery} %</dd></div>}
    </dl>
    </div>
    {device.kind === 'thermostat' && <RoomThermalControls device={device} />}
    <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
      {device.kind === 'lock' && <div className="bir-lock-panel">
        <PageTabs options={[{ label: t('connectedObjects.lock.accessCode'), icon: <KeyRound size={16} /> }, { label: t('connectedObjects.lock.codeHistory'), icon: <History size={16} /> }]}
          value={lockTab} onChange={setLockTab} size="compact" trail={false} />
        {lockTab === 0 ? <div className="bir-access-codes"><AccessCodeSection deviceId={device.id} /></div> : <LockAccessCodeHistory deviceId={device.id} />}
      </div>}
      {device.kind === 'noise' && <div className="bir-embedded-detail"><NoiseDetail device={device} compact /></div>}
      {device.kind === 'keybox' && <div className="bir-embedded-detail"><KeyboxDetail device={device} /></div>}
      {['climate', 'contact', 'motion', 'smoke'].includes(device.kind) && <div className="bir-embedded-detail"><SensorDetail device={device} compact /></div>}
    </Suspense>
    {Children.toArray(children).length > 0 && <details className="bir-inspector-settings"><summary>{t('connectedRooms.inspector.sceneSettings')}<ChevronDown size={16} /></summary>{children}</details>}
    {isDeviceDeletable(device.kind) && <footer className="bir-inspector-footer"><Button variant="ghost" size="sm"
      disabled={removing || acting} onClick={() => setConfirmDelete(true)}><Trash2 size={15} />{t('connectedRooms.removeDevice')}</Button></footer>}
    {error && <p className="bir-error" role="alert">{error}</p>}
    <Dialog open={confirmUnlock} onOpenChange={value => { if (!acting) setConfirmUnlock(value); }}>
      <DialogContent><DialogHeader><DialogTitle>{t('connectedRooms.unlockTitle')}</DialogTitle>
        <DialogDescription>{t('connectedRooms.unlockDescription', { name: device.name, property: device.propertyName })}</DialogDescription></DialogHeader>
        {error && <p role="alert">{error}</p>}
        <DialogFooter><Button variant="outline" disabled={acting} onClick={() => setConfirmUnlock(false)}>{t('common.cancel')}</Button>
          <Button disabled={acting || connection !== 'online'} onClick={() => { void execute('unlock'); }}>{t('connectedRooms.unlock')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={confirmDelete} onOpenChange={value => { if (!removing) setConfirmDelete(value); }}>
      <DialogContent><DialogHeader><DialogTitle>{t('connectedRooms.removeDevice')}</DialogTitle>
        <DialogDescription>{t('connectedRooms.removeDescription', { name: device.name })}</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" disabled={removing} onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
          <Button variant="destructive" disabled={removing} onClick={() => { void deleteDevice(); }}>{t('common.delete')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}

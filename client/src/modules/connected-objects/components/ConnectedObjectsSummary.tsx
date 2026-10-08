import { useState } from 'react';
import { ArrowUpRight, CheckCircle2, Copy, Eye, EyeOff, Link2, Plus } from '../../../icons/glyphs';
import { Button } from '../../../components/ui';
import StatTileRow from '../../../components/baitly/StatTileRow';
import DashboardKpiDetail from '../../dashboard/DashboardKpiDetail';
import { useTranslation } from '../../../hooks/useTranslation';
import { useNotification } from '../../../hooks/useNotification';
import { buildDeviceRooms, deviceArtwork, deviceConnection } from '../roomModel';
import { usePropertyAccessCode } from '../usePropertyAccessCode';
import type { ConnectedDevice, PropertyDeviceGroup } from '../types';
import type { ProviderStatusDto } from '../../../services/api/devicesApi';
import '../../dashboard/dashboardKpis.css';
import './connectedObjectsSummary.css';

interface Props {
  group?: PropertyDeviceGroup;
  providers: ProviderStatusDto[];
  loading: boolean;
  onViewDevice: (uid: string) => void;
  onConnectNetatmo: () => Promise<void>;
  onManageServices: () => void;
}

/** The dashboard's disclosure is shared, including hover, keyboard and touch behaviour. */
export default function ConnectedObjectsSummary({ group, providers, loading, onViewDevice, onConnectNetatmo, onManageServices }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const access = usePropertyAccessCode(group?.propertyId ?? null);
  const devices = group?.devices ?? [];
  const code = access.data?.accessCode?.trim();
  const unknown = devices.filter(device => deviceConnection(device) === 'unknown').length;
  const metrics = [
    { key: 'configuredDevices', artwork: '/images/notifications/automation.webp', devices },
    { key: 'online', artwork: '/images/connected-devices/summary/baitly-wifi-online.webp', devices: devices.filter(device => deviceConnection(device) === 'online') },
    { key: 'offline', artwork: '/images/connected-devices/summary/baitly-wifi-offline.webp', devices: devices.filter(device => deviceConnection(device) === 'offline') },
    { key: 'attention', artwork: '/images/notifications/access-problem.webp', devices: devices.filter(device => ['warning', 'critical'].includes(device.statusLevel) || (device.battery != null && device.battery <= 20)) },
  ];
  const services = providers.some(provider => provider.provider === 'NETATMO') ? providers
    : [...providers, { provider: 'NETATMO', connected: false, deviceCount: 0, status: null }];
  const disclosure = (key: string) => ({ open: open === key, onOpenChange: (next: boolean) => setOpen(current => next ? key : current === key ? null : current) });
  const connect = async () => {
    if (connecting) return;
    setConnecting(true);
    try { await onConnectNetatmo(); } finally { setConnecting(false); }
  };

  return <section className="db-kpis bir-summary" aria-label={t('connectedRooms.propertySummary')} aria-busy={loading}>
    {group && <header className="bir-summary-property">
      <img src="/images/notifications/property.webp" alt="" width={30} height={30} />
      <h2 dir="auto">{group.propertyName}</h2>
      <span>{t('connectedRooms.configuredRoomCount', { count: buildDeviceRooms(devices).filter(room => room.id !== 'unassigned').length })}</span>
    </header>}
    <StatTileRow presentation="overview">
      {metrics.map(metric => <DashboardKpiDetail key={metric.key} label={t(`connectedRooms.${metric.key}`)} value={metric.devices.length}
        artwork={metric.artwork} loading={loading} {...disclosure(metric.key)}>
        <p className="bir-kpi-hint">{t(`connectedRooms.summary.${metric.key}Hint`)}</p>
        {metric.key === 'configuredDevices' && unknown > 0 && <p className="bir-kpi-hint">{t('connectedRooms.summary.unknownCount', { count: unknown })}</p>}
        <DeviceList devices={metric.devices} onSelect={uid => { setOpen(null); onViewDevice(uid); }} />
      </DashboardKpiDetail>)}
      <DashboardKpiDetail label={t('connectedRooms.summary.accessCode')} value={code ? '••••••' : '—'}
        artwork="/images/connected-devices/baitly-keybox.webp" loading={loading || (group?.propertyId != null && access.isLoading)} {...disclosure('access')}>
        {access.isError ? <p role="alert" className="bir-kpi-hint">{t('connectedRooms.summary.codeError')}</p>
          : code ? <AccessCodeDetails key={group?.propertyId} code={code} renewed={!!access.data?.accessCodeAutoRotate} />
            : <p className="bir-kpi-hint">{t('connectedRooms.summary.noCode')}</p>}
      </DashboardKpiDetail>
      <DashboardKpiDetail label={t('connectedRooms.summary.services')} value={providers.filter(provider => provider.connected).length}
        artwork="/images/hitl/channel-sync.webp" loading={loading} {...disclosure('services')}>
        <p className="bir-kpi-hint">{t('connectedRooms.summary.servicesHint')}</p>
        <ul className="bir-kpi-services">
          {services.map(provider => <li key={provider.provider}>
            <span className="bir-service-state" data-connected={provider.connected} title={t(`connectedRooms.summary.${provider.connected ? 'connected' : 'notConnected'}`)}>
              {provider.connected ? <CheckCircle2 size={18} aria-hidden="true" /> : <Link2 size={18} aria-hidden="true" />}
              <span className="sr-only">{t(`connectedRooms.summary.${provider.connected ? 'connected' : 'notConnected'}`)}</span>
            </span>
            <div><strong>{provider.provider === 'CLENZY_KEYVAULT' ? 'Baitly KeyVault' : provider.provider === 'NETATMO' ? 'Netatmo' : provider.provider}</strong>
              <span>{t('connectedRooms.summary.propertyDevices', { count: devices.filter(device => device.provider === provider.provider).length })}</span></div>
            {provider.provider === 'NETATMO' && !provider.connected && <Button size="sm" variant="outline" disabled={connecting}
              aria-label={t('connectedRooms.connectNetatmo')} onClick={() => { void connect(); }}>
              <Plus size={14} aria-hidden="true" />{t(`connectedRooms.summary.${connecting ? 'connecting' : 'connect'}`)}
            </Button>}
          </li>)}
        </ul>
        <Button variant="outline" size="sm" className="bir-kpi-manage" onClick={() => { setOpen(null); onManageServices(); }}>
          {t('connectedObjects.manageIntegrations')}<ArrowUpRight size={15} aria-hidden="true" />
        </Button>
      </DashboardKpiDetail>
    </StatTileRow>
  </section>;
}

function DeviceList({ devices, onSelect }: { devices: ConnectedDevice[]; onSelect: (uid: string) => void }) {
  const { t } = useTranslation();
  if (!devices.length) return <p className="bir-kpi-empty">{t('connectedRooms.summary.noDevices')}</p>;
  return <ul className="bir-kpi-devices">{devices.map(device => <li key={device.uid}>
    <button type="button" onClick={() => onSelect(device.uid)}>
      <img src={deviceArtwork(device)} alt="" width={36} height={36} />
      <div><strong>{device.name}</strong><span>{device.roomName || t('connectedRooms.unassigned')} · {device.statusLabel}</span></div>
      <ArrowUpRight size={14} aria-hidden="true" />
    </button>
  </li>)}</ul>;
}

function AccessCodeDetails({ code, renewed }: { code: string; renewed: boolean }) {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const [revealed, setRevealed] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); notify.success(t('accessCodes.keypadCopied')); }
    catch { notify.error(t('common.copyFailed')); }
  };
  return <>
    <p className="bir-kpi-hint">{t(renewed ? 'accessCodes.keypadTooltipRenewed' : 'accessCodes.keypadTooltip')}</p>
    <div className="bir-kpi-code" aria-live="polite"><span dir="ltr">{revealed ? code : '••••••'}</span>
      <Button variant="ghost" size="icon" aria-label={t(revealed ? 'accessCodes.hideKeypad' : 'accessCodes.showKeypad')}
        title={t(revealed ? 'accessCodes.hideKeypad' : 'accessCodes.showKeypad')} aria-pressed={revealed} onClick={() => setRevealed(value => !value)}>
        {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
      </Button>
    </div>
    <Button variant="outline" size="sm" className="bir-kpi-manage" onClick={() => { void copy(); }}>
      <Copy size={15} aria-hidden="true" />{t('connectedObjects.accessCode.copyKeypad')}
    </Button>
  </>;
}

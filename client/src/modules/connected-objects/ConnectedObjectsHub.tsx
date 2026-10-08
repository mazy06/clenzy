import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw, Settings2, Plug } from 'lucide-react';
import { Button, NativeSelect, NativeSelectOption, Skeleton } from '../../components/ui';
import PageHeader from '../../components/PageHeader';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotification } from '../../hooks/useNotification';
import { propertiesApi } from '../../services/api/propertiesApi';
import { netatmoApi } from '../../services/api/netatmoApi';
import { useConnectedObjects } from './useConnectedObjects';
import { useDeviceEventStream } from './useDeviceEventStream';
import { DEVICE_KINDS, DEVICE_KIND_ORDER } from './deviceRegistry';
import type { DeviceAction, PropertyDeviceGroup } from './types';
import ConnectedRoomExplorer, { type AddRoomDeviceContext } from './components/ConnectedRoomExplorer';
import AddDeviceWizard from './components/AddDeviceWizard';
import ConnectedObjectsSummary from './components/ConnectedObjectsSummary';
import './connectedRooms.css';

export default function ConnectedObjectsHub({ embedded = false, propertyId }: { embedded?: boolean; propertyId?: number } = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { notify } = useNotification();
  const { groups, devices, providers, loading, error, act, actingUid, refetch } = useConnectedObjects();
  const propertiesQuery = useQuery({ queryKey: ['co-properties'], queryFn: () => propertiesApi.getAll(), staleTime: 60_000 });
  const selectedProperty = params.get('property');
  const selectedUid = params.get('device');
  const kindFilter = DEVICE_KIND_ORDER.find(kind => kind === params.get('kind')) ?? '';
  const selectDevice = (uid: string | null) => setParams(current => {
    const next = new URLSearchParams(current);
    if (uid) {
      next.set('device', uid); next.delete('kind');
      const device = devices.find(item => item.uid === uid);
      if (device) next.set('property', String(device.propertyId ?? 'none'));
    }
    else next.delete('device');
    return next;
  }, { replace: true });
  const [adding, setAdding] = useState<AddRoomDeviceContext | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  useDeviceEventStream(true);

  // Unequipped properties remain available. IDs, never display names, define the device boundary.
  const availableGroups = useMemo(() => {
    const result: PropertyDeviceGroup[] = [...groups];
    for (const property of propertiesQuery.data ?? []) if (!result.some(group => group.propertyId === property.id)) {
      result.push({ propertyId: property.id, propertyName: property.name, devices: [] });
    }
    return result.sort((a, b) => a.propertyId == null ? 1 : b.propertyId == null ? -1 : a.propertyName.localeCompare(b.propertyName));
  }, [groups, propertiesQuery.data]);
  const linkedDevice = devices.find(device => device.uid === selectedUid);
  const group = propertyId != null ? availableGroups.find(item => item.propertyId === propertyId)
    : linkedDevice ? availableGroups.find(item => item.propertyId === linkedDevice.propertyId)
    : availableGroups.find(item => String(item.propertyId ?? 'none') === selectedProperty) ?? availableGroups[0];
  const property = propertiesQuery.data?.find(item => item.id === group?.propertyId);
  const refresh = async () => { setRefreshing(true); try { await Promise.all([refetch(), propertiesQuery.refetch()]); } finally { setRefreshing(false); } };
  const onAction = async (uid: string, action: DeviceAction) => {
    if (action === 'lock' || action === 'unlock') { await act(uid, action); return; }
    selectDevice(uid);
  };
  const connectNetatmo = async () => {
    try {
      const result = await netatmoApi.connect();
      if (result.authorization_url) window.location.href = result.authorization_url;
      else if (result.status === 'already_connected') await refresh();
    } catch { notify.info(t('connectedObjects.netatmo.notEnabled'), 6000); }
  };
  const actions = <div className="bir-header-controls">
    {propertyId == null && <NativeSelect aria-label={t('connectedRooms.chooseProperty')} value={group ? String(group.propertyId ?? 'none') : ''}
      onChange={event => setParams({ property: event.target.value }, { replace: true })}>
      {!availableGroups.length && <NativeSelectOption value="">{t('connectedRooms.chooseProperty')}</NativeSelectOption>}
      {availableGroups.map(item => <NativeSelectOption key={item.propertyId ?? 'none'} value={String(item.propertyId ?? 'none')}>{item.propertyName}</NativeSelectOption>)}
    </NativeSelect>}
    <NativeSelect aria-label={t('connectedRooms.filterKind')} value={kindFilter} onChange={event => setParams(current => {
      const next = new URLSearchParams(current); next.delete('device');
      if (event.target.value) next.set('kind', event.target.value); else next.delete('kind');
      return next;
    }, { replace: true })}>
      <NativeSelectOption value="">{t('connectedRooms.allDevices')}</NativeSelectOption>
      {DEVICE_KIND_ORDER.map(kind => <NativeSelectOption key={kind} value={kind}>{t(DEVICE_KINDS[kind].labelKey)}</NativeSelectOption>)}
    </NativeSelect>
    <Button size="icon" variant="ghost" aria-label={t('common.refresh')} title={t('common.refresh')} disabled={refreshing} onClick={() => { void refresh(); }}><RefreshCw size={17} /></Button>
    <Button size="icon" variant="ghost" aria-label={t('connectedObjects.manageIntegrations')} title={t('connectedObjects.manageIntegrations')} onClick={() => navigate('/settings?tab=integrations')}><Settings2 size={17} /></Button>
    <Button size="sm" onClick={() => setAdding({ propertyId: group?.propertyId ?? null })}><Plus size={17} />{t('connectedObjects.addDevice')}</Button>
  </div>;
  const headerActions = usePageHeaderActions(embedded ? actions : null);
  return <div className="bir-page">
    {embedded ? headerActions : <PageHeader title={propertyId != null ? group?.propertyName ?? t('connectedObjects.title') : t('connectedObjects.title')}
      iconBadge={<Plug />} showBackButton={false} actions={actions} />}
    <ConnectedObjectsSummary key={`summary-${group?.propertyId ?? 'none'}`} group={group} providers={providers} loading={loading}
      onViewDevice={uid => { void onAction(uid, 'view'); }} onConnectNetatmo={connectNetatmo}
      onManageServices={() => navigate('/settings?tab=integrations')} />
    {error && <p role="alert" className="bir-error">{t('connectedRooms.loadError')} <Button variant="outline" onClick={() => { void refresh(); }}>{t('common.retry')}</Button></p>}
    {loading || (!group && propertiesQuery.isLoading) ? <Skeleton className="h-[540px] w-full rounded-2xl" aria-label={t('common.loading')} />
      : group ? <ConnectedRoomExplorer key={group.propertyId ?? 'none'} group={group} property={property} kindFilter={kindFilter} actingUid={actingUid} onAction={onAction} onAdd={setAdding}
        selectedDeviceUid={selectedUid} onDeviceSelect={selectDevice} />
        : <div className="bir-empty-room"><img src="/images/notifications/property.webp" width={80} height={80} alt="" /><h2>{t('connectedObjects.empty.title')}</h2>
          <p>{t('connectedRooms.noPropertyHint')}</p><Button onClick={() => setAdding({ propertyId: null })}><Plus size={16} />{t('connectedObjects.addDevice')}</Button></div>}
    {adding && <AddDeviceWizard open onClose={() => setAdding(null)} onAdded={() => { void refetch(); }} defaultPropertyId={adding.propertyId} defaultRoomName={adding.roomName} />}
  </div>;
}

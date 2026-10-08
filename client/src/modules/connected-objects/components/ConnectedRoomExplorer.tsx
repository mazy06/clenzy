import { useId, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CircleHelp, MapPin, MoveHorizontal, Plus, Save, Wifi, WifiOff } from '../../../icons/glyphs';
import { Button, NativeSelect, NativeSelectOption, Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { useUserPreference } from '../../../hooks/useUserPreference';
import { useTranslation } from '../../../hooks/useTranslation';
import { useViewportFill } from '../../../hooks/useViewportFill';
import { DEVICE_KINDS } from '../deviceRegistry';
import { BEDROOM_ARTWORK, bedroomArtworkForName, buildDeviceRooms, completePropertyRooms, contactTarget, defaultThermalArtwork, deviceArtwork, deviceConnection, measuredTemperature, openingState, openingVariant, roomArtwork, roomDeviceGroups, sceneHasWindow, thermalMode, type DeviceRoom, type RoomArtwork, type BedroomArtwork, type ContactTarget, type ThermalArtwork, type OpeningVariant } from '../roomModel';
import { normalizePlacement, sceneDevicePlacement, scenePlacementKey, type SceneDevicePlacement, type SceneLayoutPreferences } from '../roomSceneLayout';
import type { ConnectedDevice, DeviceAction, DeviceKind, PropertyDeviceGroup } from '../types';
import RoomDeviceInspector, { DeviceState } from './RoomDeviceInspector';
import RoomSceneDevice from './RoomSceneDevice';
import RoomPlacementEditor from './RoomPlacementEditor';
import '../connectedRooms.css';

export interface AddRoomDeviceContext { propertyId: number | null; roomName?: string }

/** Artwork is illustrative; device presence, rooms and states come exclusively from the server. */
export default function ConnectedRoomExplorer({ group, property, kindFilter, actingUid, onAction, onAdd, selectedDeviceUid, onDeviceSelect }: {
  group: PropertyDeviceGroup; kindFilter: DeviceKind | ''; actingUid: string | null;
  property?: { bedroomCount: number; bathroomCount: number; hasExterior?: boolean };
  onAction: (uid: string, action: DeviceAction) => Promise<void> | void;
  onAdd: (context: AddRoomDeviceContext) => void;
  selectedDeviceUid?: string | null;
  onDeviceSelect?: (uid: string | null) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const actualRooms = useMemo(() => buildDeviceRooms(group.devices), [group.devices]);
  const rooms = useMemo(() => group.propertyId == null ? actualRooms : completePropertyRooms(actualRooms, property,
    (scene, index) => `${t(`connectedRooms.rooms.${scene}`)}${index ? ` ${index}` : ''}`), [actualRooms, property, group.propertyId, t]);
  const [artPreferences, setArtPreferences, { isLoaded }] = useUserPreference<Record<string, BedroomArtwork>>(`connectedRooms.artwork.${group.propertyId ?? 'none'}`, {});
  const [contactPreferences, setContactPreferences, contactMeta] = useUserPreference<Record<string, ContactTarget>>(`connectedRooms.contacts.${group.propertyId ?? 'none'}`, {});
  const [thermalPreferences, setThermalPreferences, thermalMeta] = useUserPreference<Record<string, ThermalArtwork>>(`connectedRooms.thermal.${group.propertyId ?? 'none'}`, {});
  const [placements, , placementMeta] = useUserPreference<SceneLayoutPreferences>(`connectedRooms.placements.${group.propertyId ?? 'none'}`, {});
  // Unsaved edits stay local; only explicit Save writes this visual preference to the backend.
  const [draft, setDraft] = useState<Record<string, SceneDevicePlacement | null> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const editing = draft !== null;
  const thermalFor = (device: ConnectedDevice) => thermalPreferences[device.uid] ?? defaultThermalArtwork(device);
  const artworkFor = (candidate: DeviceRoom): RoomArtwork | null => {
    if (candidate.scene !== 'bedroom') return candidate.scene;
    const preference = artPreferences?.[candidate.id];
    return preference && BEDROOM_ARTWORK.includes(preference) ? preference : bedroomArtworkForName(candidate.name);
  };
  const [roomSelection, setRoomSelection] = useState<{ id: string; filter: DeviceKind | '' } | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const linkedRoom = selectedDeviceUid ? rooms.find(candidate => candidate.devices.some(device => device.uid === selectedDeviceUid)) : undefined;
  const room = linkedRoom ?? rooms.find(candidate => candidate.id === roomSelection?.id && roomSelection.filter === kindFilter)
    ?? (kindFilter ? rooms.find(candidate => candidate.devices.some(device => device.kind === kindFilter)) : undefined) ?? rooms[0];
  const roomDevices = room?.devices.filter(device => !kindFilter || device.kind === kindFilter) ?? [];
  const selected = roomDevices.find(device => device.uid === (selectedDeviceUid ?? deviceId)) ?? roomDevices[0];
  const chooseDevice = (uid: string) => { setDeviceId(uid); onDeviceSelect?.(uid); };
  const deviceGroups = roomDeviceGroups(roomDevices, contactPreferences, thermalPreferences);
  const [workspaceRef, height] = useViewportFill<HTMLDivElement>({ minHeight: 460 });
  const roomName = room?.name || t('connectedRooms.unassigned');
  const artwork = room ? artworkFor(room) : null;
  const variant = artwork ? openingVariant(artwork, room?.devices ?? [], contactPreferences) : '';
  const entries = artwork && room ? deviceGroups.flatMap(([slot, devices]) => devices.map((device, index) => {
    const key = scenePlacementKey(room.id, artwork, variant, device.uid, slot);
    const fallback = sceneDevicePlacement(artwork, slot, variant, index);
    const saved = draft && Object.prototype.hasOwnProperty.call(draft, key) ? draft[key] : placements?.[key];
    return { key, device, slot, placement: normalizePlacement(saved, fallback) };
  })) : [];
  const selectedEntry = entries.find(entry => entry.device.uid === selected?.uid);
  const changePlacement = (key: string, value: SceneDevicePlacement | null) => {
    if (!saving) setDraft(current => current === null ? null : { ...current, [key]: value });
  };
  const savePlacements = async () => {
    if (!draft || saving || !placementMeta.isLoaded) return;
    setSaving(true); setSaveError(false);
    const next = { ...placements };
    for (const [key, value] of Object.entries(draft)) {
      if (value === null) delete next[key]; else next[key] = value;
    }
    try { await placementMeta.save(next); setDraft(null); }
    catch { setSaveError(true); }
    finally { setSaving(false); }
  };
  const currentIndex = rooms.findIndex(candidate => candidate.id === room?.id);
  const chooseRoom = (next: DeviceRoom) => { setRoomSelection({ id: next.id, filter: kindFilter }); setDeviceId(null); onDeviceSelect?.(null); };
  const addToRoom = () => onAdd({ propertyId: group.propertyId, roomName: room?.name || undefined });
  return <div className="bir-workspace" ref={workspaceRef} style={{ height }}>
    <header className="bir-workspace-heading">
      <div className="bir-room-heading">
        <div className="bir-room-title"><h2 dir="auto">{roomName}</h2>
        {artwork && <div className="bir-opening-status" aria-live="polite">
          {(['door', ...(sceneHasWindow(artwork) ? ['window'] : [])] as const).map(target => <span key={target}>
            {t(`connectedRooms.openings.${target}`)} : {t(`connectedRooms.openings.${openingState(room?.devices ?? [], target as ContactTarget, contactPreferences)}`)}
          </span>)}
        </div>}

        </div>
        <div className="bir-room-arrows">
        {room?.scene === 'bedroom' && <label className="bir-bedroom-art"><span>{t('connectedRooms.bedroomIllustration')}</span>
          <NativeSelect aria-label={t('connectedRooms.bedroomIllustration')} disabled={!isLoaded} value={artwork ?? 'bedroom'}
            onChange={event => setArtPreferences({ ...artPreferences, [room.id]: event.target.value as BedroomArtwork })}>
            {BEDROOM_ARTWORK.map(value => <NativeSelectOption key={value} value={value}>{t(`connectedRooms.beds.${value}`)}</NativeSelectOption>)}
          </NativeSelect>
        </label>}
          <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={t('connectedRooms.illustrationHint')}><CircleHelp size={16} /></Button></TooltipTrigger>
            <TooltipContent className="max-w-xs">{t('connectedRooms.illustrationHint')} {t('connectedRooms.sensorHint')}</TooltipContent>
          </Tooltip>
          {!editing && artwork && roomDevices.length > 0 && <Button variant="outline" size="sm" disabled={!placementMeta.isLoaded} onClick={() => { setDraft({}); setSaveError(false); }}><MoveHorizontal size={16} />{t('connectedRooms.placement.edit')}</Button>}
          {editing && <>
            <span className="bir-layout-hint">{t('connectedRooms.placement.visualOnly')}</span>
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => { setDraft(null); setSaveError(false); }}>{t('common.cancel')}</Button>
            <Button size="sm" disabled={saving || !Object.keys(draft).length} onClick={() => { void savePlacements(); }}><Save size={15} />{t(saving ? 'connectedRooms.placement.saving' : 'common.save')}</Button>
          </>}
          <Button size="icon" variant="outline" aria-label={t('connectedRooms.previousRoom')} disabled={currentIndex <= 0} onClick={() => chooseRoom(rooms[currentIndex - 1])}><ArrowLeft size={17} className="cn-rtl-flip" /></Button>
          <Button size="icon" variant="outline" aria-label={t('connectedRooms.nextRoom')} disabled={currentIndex >= rooms.length - 1} onClick={() => chooseRoom(rooms[currentIndex + 1])}><ArrowRight size={17} className="cn-rtl-flip" /></Button>
        </div>
      </div>
      {saveError && <p className="bir-error" role="alert">{t('connectedRooms.placement.saveError')}</p>}

    </header>
    <div className="bir-columns">
      <section className="bir-visual" aria-label={t('connectedRooms.explore')}>
        <div className="bir-stage">
          {room?.scene && artwork ? <RoomSceneCanvas key={`${artwork}:${variant}`} scene={artwork} variant={variant} roomName={roomName}>
            <div role="group" aria-label={t('connectedRooms.markers')}>
              {entries.map(({ key, device, slot, placement }) => {
                const mode = thermalMode(device);
                const temperature = deviceConnection(device) === 'online' ? measuredTemperature(device) : null;
                return <RoomSceneDevice key={key} scene={artwork} slot={slot} placement={placement} selected={device.uid === selected?.uid}
                  editing={editing && !saving} state={device.statusLevel} controls={`${id}-devices`}
                  label={`${t(DEVICE_KINDS[device.kind].labelKey)} · ${device.name} · ${device.statusLabel}`}
                  onSelect={() => chooseDevice(device.uid)} onChange={value => changePlacement(key, value)}>
                  {slot === 'split' && (mode === 'cool' || mode === 'heat') && <img className="bir-mode-symbol" src={`/images/connected-devices/baitly-${mode === 'cool' ? 'snowflake' : 'sun'}.webp`} alt={t(`connectedRooms.modes.${mode}`)} width={32} height={32} />}
                  {temperature != null && <span className="bir-hotspot-reading">{temperature.toLocaleString(undefined, { maximumFractionDigits: 1 })} °C</span>}
                </RoomSceneDevice>;
              })}
            </div>
          </RoomSceneCanvas> : <div className="bir-unassigned"><MapPin size={32} /><h3>{t('connectedRooms.noIllustration')}</h3><p>{t(room?.id === 'unassigned' ? 'connectedRooms.unassignedHint' : 'connectedRooms.customRoomHint')}</p></div>}
        </div>


        <nav className="bir-room-nav" aria-label={t('connectedRooms.chooseRoom')}>
          {rooms.map(candidate => <button type="button" key={candidate.id} aria-current={candidate.id === room?.id ? 'true' : undefined}
            onClick={() => chooseRoom(candidate)} title={candidate.name || t('connectedRooms.unassigned')}>
            {artworkFor(candidate) ? <img src={`/images/connected-rooms/baitly-${artworkFor(candidate)}-thumb.webp`} width={92} height={69} alt="" loading="lazy" decoding="async" /> : <span className="bir-room-placeholder"><MapPin size={24} /></span>}
            <span dir="auto">{candidate.name || t('connectedRooms.unassigned')}</span><small>{candidate.devices.length}</small>
          </button>)}
        </nav>
      </section>
      <aside className="bir-side" id={`${id}-devices`} aria-label={t('connectedRooms.roomDevices')}>
        <header className="bir-side-heading"><h3>{t('connectedRooms.roomDevices')} <span>{roomDevices.length}</span></h3>
          {group.propertyId != null && <Button size="icon" variant="ghost" aria-label={t('connectedRooms.addHere')} title={t('connectedRooms.addHere')} onClick={addToRoom}><Plus size={18} /></Button>}
        </header>
        {roomDevices.length ? <>
          <div className="bir-device-list" role="group" aria-label={t('connectedRooms.selectDevice')}>
            {roomDevices.map(device => <button type="button" key={device.uid} aria-pressed={selected?.uid === device.uid} onClick={() => chooseDevice(device.uid)}>
              <img className="bir-list-symbol" src={deviceArtwork(device, thermalFor(device))} alt="" width={38} height={38} /><span className="bir-list-name"><strong dir="auto">{device.name}</strong><span>{device.provider === 'CLENZY_KEYVAULT' ? 'Baitly KeyVault' : device.provider}</span></span>
              <DeviceState device={device} />
            </button>)}
          </div>
          {editing && selectedEntry && <RoomPlacementEditor name={selectedEntry.device.name} slot={selectedEntry.slot} value={selectedEntry.placement} disabled={saving}
            onChange={value => changePlacement(selectedEntry.key, value)} onReset={() => changePlacement(selectedEntry.key, null)} />}
          {selected && !editing && <RoomDeviceInspector key={selected.uid} device={selected} acting={actingUid === selected.uid} onAction={onAction}>
            {selected.kind === 'contact' && <label className="bir-device-preference">{t('connectedRooms.contactIllustration')}
              <NativeSelect aria-label={t('connectedRooms.contactIllustration')} disabled={!contactMeta.isLoaded} value={contactTarget(selected, contactPreferences)} onChange={event => setContactPreferences({ ...contactPreferences, [selected.uid]: event.target.value as ContactTarget })}>
                {(['unknown', 'door', 'window'] as const).map(value => <NativeSelectOption key={value} value={value}>{t(`connectedRooms.openings.${value}`)}</NativeSelectOption>)}
              </NativeSelect>
            </label>}
            {selected.kind === 'thermostat' && <label className="bir-device-preference">{t('connectedRooms.thermalIllustration')}
              <NativeSelect aria-label={t('connectedRooms.thermalIllustration')} disabled={!thermalMeta.isLoaded} value={thermalFor(selected)} onChange={event => setThermalPreferences({ ...thermalPreferences, [selected.uid]: event.target.value as ThermalArtwork })}>
                <NativeSelectOption value="thermostat">{t('connectedRooms.thermostat')}</NativeSelectOption><NativeSelectOption value="split">{t('connectedRooms.split')}</NativeSelectOption>
              </NativeSelect>
            </label>}
          </RoomDeviceInspector>}
        </> : <div className="bir-empty-room"><img src="/images/notifications/automation.webp" alt="" width={72} height={72} />
          <h3>{t(kindFilter && (room?.devices.length ?? 0) > 0 ? 'connectedRooms.noMatchingDevice' : 'connectedRooms.emptyRoom')}</h3>
          <p>{t(kindFilter ? 'connectedRooms.filterHint' : 'connectedRooms.emptyRoomHint')}</p>
          {group.propertyId != null && !kindFilter && <Button variant="outline" onClick={addToRoom}><Plus size={16} />{t('connectedRooms.addHere')}</Button>}
        </div>}
        <footer className="bir-room-health"><Wifi size={14} />{t('connectedRooms.onlineCount', { count: roomDevices.filter(device => deviceConnection(device) === 'online').length })}
          {roomDevices.some(device => deviceConnection(device) === 'offline') && <><WifiOff size={14} /><span>{t('connectedRooms.offlineCount', { count: roomDevices.filter(device => deviceConnection(device) === 'offline').length })}</span></>}
        </footer>
      </aside>
    </div>
  </div>;
}

function RoomSceneCanvas({ scene, variant, roomName, children }: { scene: RoomArtwork; variant: OpeningVariant; roomName: string; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const { t } = useTranslation();
  return <div className="bir-canvas" data-ready={ready}>
    {!failed && <img src={roomArtwork(scene, variant)} alt={t('connectedRooms.roomAlt', { room: roomName })} width={1448} height={1086}
      decoding="async" onLoad={() => setReady(true)} onError={() => setFailed(true)} />}
    {failed ? <p className="bir-image-error" role="status">{t('connectedRooms.imageError')}</p> : ready && children}
  </div>;
}

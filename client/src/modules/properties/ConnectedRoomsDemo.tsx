import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  Activity, Camera, DoorClosed, DoorOpen, Droplets, Key, LockKeyhole, LockKeyholeOpen,
  PanelsTopLeft, ShieldCheck, Thermometer, TriangleAlert, Volume2, Wifi,
} from '../../icons/glyphs';
import { StageCard } from '../../components/baitly/FirstUseStage';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import { ROOM_SCENES, roomArtwork, type OpeningVariant, type RoomDeviceSlot, type RoomScene } from '../connected-objects/roomModel';
import { sceneDevicePlacement, sceneDeviceSprite, spriteBounds } from '../connected-objects/roomSceneLayout';

/**
 * Objets connectés — scène d'accueil.
 *
 * On montre les VRAIES pièces de la page Objets connectés : les maquettes
 * isométriques générées (`/images/connected-rooms`), leurs variantes porte /
 * fenêtre ouvertes et les appareils posés aux points d'ancrage déjà calibrés
 * (`roomSceneLayout`). Rien n'est redessiné : l'aperçu est la page elle-même,
 * sans compte ni appareil.
 *
 * Les étapes du rail sont des pièces ; chacune met en avant un appareil. Les
 * sept pièces restent explorables dans la bande de vignettes. Tout est local :
 * aucune commande n'est envoyée à un appareil.
 */

export interface RoomsDemoProps {
  scene: number;
  onSelect: (scene: number) => void;
}

/** Une étape du rail = une pièce, un appareil mis en avant. */
export const ROOM_STORIES: { room: RoomScene; focus: RoomDeviceSlot; windowOpen?: boolean }[] = [
  { room: 'entrance', focus: 'lock' },
  { room: 'living', focus: 'noise' },
  { room: 'bedroom', focus: 'window-contact', windowOpen: true },
  { room: 'kitchen', focus: 'smoke' },
];

const ROOM_DEVICES: Record<RoomScene, RoomDeviceSlot[]> = {
  entrance: ['lock', 'keybox', 'camera'],
  living: ['noise', 'thermostat', 'motion'],
  bedroom: ['door-contact', 'window-contact', 'smoke'],
  kitchen: ['smoke', 'climate', 'window-contact'],
  bathroom: ['climate', 'noise', 'motion'],
  hallway: ['motion', 'smoke', 'door-contact'],
  outdoor: ['camera', 'motion', 'keybox'],
};

/** Variantes réellement livrées par pièce (voir `public/images/connected-rooms`). */
const OPENINGS: Record<RoomScene, { door: boolean; window: boolean }> = {
  entrance: { door: true, window: false },
  hallway: { door: true, window: false },
  outdoor: { door: true, window: false },
  living: { door: true, window: true },
  bedroom: { door: true, window: true },
  kitchen: { door: true, window: true },
  bathroom: { door: true, window: true },
};

interface Opening { door: boolean; window: boolean }

function variantFor(room: RoomScene, open: Opening): OpeningVariant {
  const door = open.door && OPENINGS[room].door;
  const window = open.window && OPENINGS[room].window;
  return door && window ? 'both-open' : door ? 'door-open' : window ? 'window-open' : '';
}

/** Les appareils sont minuscules à l'échelle de la page réelle : on les grossit pour la vitrine. */
const SPRITE_SCALE = 1.9;

const KIND_OF_SLOT = (slot: RoomDeviceSlot) => (slot === 'door-contact' || slot === 'window-contact' ? 'contact' : slot === 'split' ? 'thermostat' : slot);

const SLOT_ICON: Partial<Record<RoomDeviceSlot, ReactNode>> = {
  lock: <LockKeyhole />, keybox: <Key />, camera: <Camera />, noise: <Volume2 />, thermostat: <Thermometer />,
  climate: <Droplets />, motion: <Activity />, smoke: <ShieldCheck />, 'door-contact': <DoorClosed />, 'window-contact': <PanelsTopLeft />,
};

/** Mesures d'illustration — jamais une donnée du compte. */
const READINGS: Partial<Record<RoomDeviceSlot, string>> = { lock: '86 %', noise: '44 dB', thermostat: '22 °C', climate: '48 %' };

function DeviceSprite({ room, slot, label, focused, alert, pressed, onClick }: {
  room: RoomScene; slot: RoomDeviceSlot; label: string; focused: boolean; alert: boolean; pressed?: boolean; onClick: () => void;
}) {
  const placement = sceneDevicePlacement(room, slot);
  const sprite = sceneDeviceSprite(slot, placement.pose, room);
  const bounds = spriteBounds[sprite];
  const style = {
    left: `${placement.x}%`,
    top: `${placement.y}%`,
    width: `${placement.width * SPRITE_SCALE}%`,
    aspectRatio: `${bounds.viewBox[2]} / ${bounds.viewBox[3]}`,
  } as CSSProperties;
  return (
    <button type="button" className="ns-room-dev" style={style} data-anchor={placement.anchor} data-focus={focused || undefined} data-alert={alert || undefined}
      aria-label={label} title={label} aria-pressed={pressed} onClick={onClick}>
      <svg viewBox={bounds.viewBox.join(' ')} aria-hidden focusable="false" className="ns-room-art">
        <image href={`/images/connected-devices/scene/baitly-${sprite}.webp`} width={bounds.width} height={bounds.height} />
      </svg>
      <span className="ns-room-ring" aria-hidden />
    </button>
  );
}

export default function ConnectedRoomsDemo({ scene, onSelect }: RoomsDemoProps) {
  const { t } = useTranslation();
  const story = ROOM_STORIES[scene] ?? ROOM_STORIES[0];
  // Une pièce choisie à la main ne vaut que pour l'étape où elle l'a été.
  const [picked, setPicked] = useState<{ scene: number; room: RoomScene } | null>(null);
  const [opened, setOpened] = useState<Partial<Record<RoomScene, Opening>>>({});
  const [focusSlot, setFocusSlot] = useState<{ scene: number; slot: RoomDeviceSlot } | null>(null);

  const room = picked && picked.scene === scene ? picked.room : story.room;
  const focus = focusSlot && focusSlot.scene === scene ? focusSlot.slot : story.focus;
  const open: Opening = opened[room] ?? { door: false, window: story.room === room && !!story.windowOpen };
  const variant = variantFor(room, open);
  const slots = ROOM_DEVICES[room];
  const roomName = t(`connectedRooms.rooms.${room}`);
  const kindLabel = (slot: RoomDeviceSlot) => t(`connectedObjects.kinds.${KIND_OF_SLOT(slot)}.singular`);

  const toggle = (slot: RoomDeviceSlot) => {
    if (slot === 'lock' || slot === 'door-contact') setOpened({ ...opened, [room]: { ...open, door: !open.door } });
    else if (slot === 'window-contact') setOpened({ ...opened, [room]: { ...open, window: !open.window } });
  };
  const select = (slot: RoomDeviceSlot) => {
    setFocusSlot({ scene, slot });
    toggle(slot);
    onSelect(scene);
  };

  const stateOf = (slot: RoomDeviceSlot) => {
    if (slot === 'lock') return { icon: open.door ? <LockKeyholeOpen /> : <LockKeyhole />, alert: false, reading: READINGS.lock };
    if (slot === 'door-contact') return { icon: open.door ? <DoorOpen /> : <DoorClosed />, alert: open.door, reading: t(`connectedRooms.openings.${open.door ? 'open' : 'closed'}`) };
    if (slot === 'window-contact') return { icon: <PanelsTopLeft />, alert: open.window, reading: t(`connectedRooms.openings.${open.window ? 'open' : 'closed'}`) };
    return { icon: SLOT_ICON[slot], alert: false, reading: READINGS[slot] };
  };
  const alerting = slots.some((slot) => stateOf(slot).alert);

  return (
    <StageCard
      icon={<Wifi />}
      title={roomName}
      aside={alerting
        ? <span className="ns-chip ns-pulse" data-tone="alert" aria-hidden><TriangleAlert />{t(`connectedRooms.openings.open`)}</span>
        : <span className="ns-chip" aria-hidden><Wifi />{slots.length}</span>}
      className="ns-room-card"
    >
      <div className="ns-room-canvas" data-room={room}>
        <span className="ns-room-glow" aria-hidden />
        <img key={`${room}-${variant}`} className="ns-swap" src={roomArtwork(room, variant)} alt="" width={1448} height={1086} decoding="async" draggable={false} />
        {slots.map((slot) => (
          <DeviceSprite key={`${room}-${slot}`} room={room} slot={slot} label={kindLabel(slot)}
            focused={focus === slot} alert={stateOf(slot).alert}
            pressed={slot === 'lock' || slot === 'door-contact' ? open.door : slot === 'window-contact' ? open.window : undefined}
            onClick={() => select(slot)} />
        ))}
      </div>

      <div className="ns-room-readings" role="group" aria-label={roomName}>
        {slots.map((slot) => {
          const state = stateOf(slot);
          return (
            <button key={slot} type="button" className="ns-chip ns-room-reading" data-focus={focus === slot || undefined} data-tone={state.alert ? 'alert' : undefined}
              aria-label={kindLabel(slot)} title={kindLabel(slot)} onClick={() => select(slot)}>
              {state.icon}{state.reading}
            </button>
          );
        })}
      </div>

      <div className="ns-room-thumbs" role="group" aria-label={t('connectedObjects.title')}>
        {ROOM_SCENES.map((candidate) => (
          <button key={candidate} type="button" className={cn('ns-room-thumb')} aria-pressed={candidate === room} aria-label={t(`connectedRooms.rooms.${candidate}`)} title={t(`connectedRooms.rooms.${candidate}`)}
            onClick={() => { setPicked({ scene, room: candidate }); setFocusSlot(null); onSelect(scene); }}>
            <img src={`/images/connected-rooms/baitly-${candidate}-thumb.webp`} alt="" width={92} height={69} loading="lazy" decoding="async" draggable={false} />
          </button>
        ))}
      </div>
    </StageCard>
  );
}

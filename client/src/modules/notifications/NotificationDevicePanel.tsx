import React from 'react';
import { Badge, Skeleton } from '../../components/ui';
import BatteryGauge, { batteryTone, type BatteryTone } from '../../components/baitly/BatteryGauge';
import GuestAvatar from '../../components/baitly/GuestAvatar';
import SmartLockMark from '../../components/baitly/SmartLockMark';
import {
  smartLockApi,
  type SmartLockAccessCodeHistoryDto,
  type SmartLockDeviceDto,
} from '../../services/api/smartLockApi';
import { reservationsApi, type Reservation } from '../../services/api';
import { guestPhotoSrc } from '../../services/api/guestsApi';
import { MapTile, ObservationBand } from './NotificationFieldParts';
import { PropertyIdentity, PropertyLine, useNotificationProperty } from './NotificationPropertyPanel';
import { FACT_ICON } from './notificationMeta';
import { Lock, LockOpen, VpnKey, WifiOff } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { Notification } from '../../services/api';

/**
 * Gestes de la constellation qui portent sur une SERRURE.
 *
 * <p>Le seul aujourd'hui. La liste existe quand meme, parce que `deviceId`
 * designe « un objet connecte » et pas « une serrure » : le jour ou un scan de
 * capteur de bruit posera le meme fait, la fiche irait chercher une serrure
 * portant ce numero — au mieux une erreur, au pire la mauvaise porte. Un
 * nouveau geste sur serrure s'ajoute ICI.</p>
 */
const LOCK_ACTION_TYPES = new Set(['LOCK_BATTERY_REPLACE']);

/**
 * Serrure designee par une notification, ou `null`.
 *
 * L'identifiant vient des faits, jamais du titre : « Batterie serrure a 12 % —
 * Serrure porte d'entree » est du texte pour l'humain, pas une adresse.
 */
export function deviceIdOf(notification: Notification): number | null {
  const actionType = notification.metadata?.actionType;
  if (typeof actionType !== 'string' || !LOCK_ACTION_TYPES.has(actionType)) return null;

  const raw = notification.metadata?.deviceId;
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
  return null;
}

export interface DeviceDossier {
  device: SmartLockDeviceDto | null;
  history: SmartLockAccessCodeHistoryDto | null;
  /** Sejour en cours sur le logement, quand la serrure en signale un. */
  reservation: Reservation | null;
}

/**
 * Charge la serrure, l'etat de ses codes, puis le sejour en cours s'il existe.
 *
 * <p>Le niveau de batterie n'est PAS relu dans l'intitule de la carte
 * (« a 12 % ») : le repecher dans du texte serait une promesse fragile. On va
 * chercher l'etat, qui a en plus le merite d'etre A JOUR — des piles remplacees
 * hier ne laissent pas une fiche annoncer 12 %.</p>
 *
 * <p>Le sejour en cours n'est pas un ornement sur une alerte de pile : une
 * serrure qui lache avec un voyageur derriere la porte n'a pas la meme urgence
 * qu'une serrure de logement vide. Il se connait en deux vagues, la serrure
 * disant d'abord s'il y en a un.</p>
 *
 * <p>Chaque piece manquante se rend en silence : la fiche reste lisible avec ce
 * qu'elle a.</p>
 */
export function useNotificationDevice(deviceId: number | null) {
  const [dossier, setDossier] = React.useState<DeviceDossier | null>(null);
  const [loading, setLoading] = React.useState(deviceId !== null);

  React.useEffect(() => {
    if (deviceId === null) {
      setDossier(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    void (async () => {
      const [deviceResult, historyResult] = await Promise.allSettled([
        smartLockApi.getById(deviceId),
        smartLockApi.getAccessCodeHistory(deviceId),
      ]);
      if (!active) return;

      const device = deviceResult.status === 'fulfilled' ? deviceResult.value : null;
      const history = historyResult.status === 'fulfilled' ? historyResult.value : null;

      const stayId = history?.ongoingStay?.reservationId ?? null;
      const reservation = stayId === null ? null
        : await reservationsApi.getById(stayId).catch(() => null);
      if (!active) return;

      setDossier(device ? { device, history, reservation } : null);
      setLoading(false);
    })();

    return () => { active = false; };
  }, [deviceId]);

  return { dossier, loading };
}

/** Attente : la forme du panneau, pas un tourniquet centre. */
export function NotificationDeviceSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-12 shrink-0 rounded-lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-2 self-center">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-52" />
        </div>
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-[120px] min-w-0 flex-1 rounded-lg" />
        <Skeleton className="h-[120px] w-[240px] shrink-0 rounded-lg" />
      </div>
      <Skeleton className="h-[52px] w-full" />
    </div>
  );
}

/** Marques de serrures : le nom tel qu'il s'ecrit, pas la constante en base. */
const BRAND_LABEL: Record<string, string> = {
  TUYA: 'Tuya',
  NUKI: 'Nuki',
  TTLOCK: 'TTLock',
  YALE: 'Yale',
  SIMULATION: 'Simulation',
};

const TONE_BADGE: Record<BatteryTone, 'destructive' | 'warning' | 'success'> = {
  critical: 'destructive',
  low: 'warning',
  ok: 'success',
};

/** Teinte de signal de la serrure : celle de l'etat de sa pile. */
const TONE_SIGNAL: Record<BatteryTone, string> = {
  critical: 'var(--bui-destructive)',
  low: 'var(--bui-warning)',
  ok: 'var(--bui-success)',
};

/**
 * L'objet connecte lui-meme, dans la fiche d'une alerte de maintenance.
 *
 * <p>« Batterie serrure a 12 % » se lit, mais ne se VOIT pas : douze pour cent
 * de quoi, sur quelle porte, dans quel logement ? Ici la pile a une silhouette
 * et un niveau, la serrure un visage, et la teinte — diode, arcs, remplissage —
 * dit la gravite une seule fois, partout au meme endroit.</p>
 *
 * <p>Le message de la carte reste affiche en dessous : il nomme le geste
 * (« Planifier » cree l'intervention), ce que ce panneau ne dit pas.</p>
 */
/** Intitule de champ a l'interieur du panneau. */
function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

function formatDay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  } catch {
    return iso;
  }
}

/**
 * Le dossier d'une serrure qui va lacher.
 *
 * <p>« Batterie serrure a 12 % » se lit, mais ne se VOIT pas : douze pour cent
 * de quoi, sur quelle porte, dans quel logement — et surtout, y a-t-il quelqu'un
 * derriere cette porte ? La fiche reunit ce qu'il fallait quatre ecrans pour
 * rassembler : le logement et son adresse, le chemin pour s'y rendre, l'etat
 * exact de l'objet, et le sejour en cours.</p>
 *
 * <p>La teinte — diode, arcs, remplissage, pastille — dit la gravite une seule
 * fois, partout au meme endroit.</p>
 */
export default function NotificationDevicePanel({
  dossier,
  observation,
  observedAt,
}: {
  dossier: DeviceDossier;
  /** Motif de l'evenement — ce que le panneau ne dit pas de lui-meme. */
  observation?: string;
  observedAt?: string;
}) {
  const { t } = useTranslation();
  const { device, history, reservation } = dossier;
  const { property } = useNotificationProperty(device?.propertyId ?? null);

  const level = device?.batteryLevel ?? null;
  const tone = level != null ? batteryTone(level) : 'ok';
  const locked = (device?.lockState ?? '').toUpperCase() === 'LOCKED';
  const ongoing = history?.ongoingStay ?? null;

  // L'adresse COMPLETE, pas la ville : on va s'y rendre pour changer des piles.
  const address = [property?.address, property?.postalCode, property?.city]
    .filter(Boolean).join(', ');

  const toneLabel = {
    critical: t('notifications.detail.device.batteryCritical', 'Batterie critique'),
    low: t('notifications.detail.device.batteryLow', 'Batterie faible'),
    ok: t('notifications.detail.device.batteryOk', 'Batterie suffisante'),
  }[tone];

  const guestName = reservation?.guestName?.trim()
    || t('notifications.detail.lockCode.guest', 'Voyageur');

  return (
    <section className="@container flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
      {/* Le logement a gauche, le chemin pour s'y rendre a droite : changer des
          piles est un DEPLACEMENT, la carte n'est pas une decoration — elle se
          lit avec l'adresse, pas deux rangees plus bas. */}
      <div className="grid gap-4 @[36rem]:grid-cols-[minmax(0,1fr)_auto] @[36rem]:items-center">
        <PropertyIdentity
          property={property}
          name={property?.name ?? device?.propertyName ?? ''}
          address={address || undefined}
          extra={device?.roomName && (
            <PropertyLine icon={FACT_ICON.property}>{device.roomName}</PropertyLine>
          )}
        />

        {address && <MapTile property={property} address={address} />}
      </div>

      {/* Rangee 2 : l'objet, et qui est derriere la porte. Les deux faits qui
          decident de l'urgence se lisent d'un seul regard. */}
      <div className="grid gap-4 border-t border-border pt-3.5 @[36rem]:grid-cols-2 @[36rem]:items-start">
        <div>
          <Caption>{t('notifications.detail.lockCode.device', 'La serrure')}</Caption>
          <div className="mt-2 flex items-center gap-4">
            <SmartLockMark signal={TONE_SIGNAL[tone]} width={64} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-medium text-foreground">{device?.name}</p>
                <p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">
                  {BRAND_LABEL[device?.brand ?? ''] ?? device?.brand}
                </p>
              </div>

              {level != null ? (
                <BatteryGauge level={level} />
              ) : (
                <p className="m-0 text-sm text-muted-foreground">
                  {t('notifications.detail.device.batteryUnknown', 'Niveau de batterie inconnu')}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                {level != null && <Badge variant={TONE_BADGE[tone]}>{toneLabel}</Badge>}
                {/* Une serrure deja injoignable ne se replanifiera pas toute
                    seule : c'est un fait qui change l'urgence, pas un detail
                    technique. */}
                {device?.online === false && (
                  <Badge variant="outline">
                    <WifiOff size={12} strokeWidth={2} />
                    {t('notifications.detail.device.offline', 'Hors ligne')}
                  </Badge>
                )}
                <Badge variant={locked ? 'success' : 'warning'}>
                  {locked
                    ? <Lock size={12} strokeWidth={2} />
                    : <LockOpen size={12} strokeWidth={2} />}
                  {locked
                    ? t('notifications.detail.lockCode.locked', 'Verrouillée')
                    : t('notifications.detail.lockCode.unlocked', 'Déverrouillée')}
                </Badge>
                {/* Une serrure qui genere elle-meme ses codes cesse de le faire
                    avec ses piles : le mode change ce qu'on perd a la panne. */}
                {device?.accessCodeMode === 'LOCK_GENERATED' && (
                  <Badge variant="outline">
                    <VpnKey size={12} strokeWidth={2} />
                    {t('connectedObjects.codeMode.lock', 'La serrure génère le code')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Qui est derriere la porte. Une serrure qui lache sur un logement vide
            se replanifie ; avec un voyageur dedans, elle ne se replanifie pas. */}
        <div>
          <Caption>{t('notifications.detail.lockCode.stay', 'Séjour en cours')}</Caption>
          <div className="mt-2">
            {ongoing ? (
                <div className="flex items-start gap-3">
                  <GuestAvatar
                    name={guestName}
                    photoUrl={guestPhotoSrc(reservation?.guestAvatarUrl)}
                    size={36}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground">
                      <span className="font-medium">{guestName}</span>
                      <span aria-hidden>·</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatDay(ongoing.checkIn)} → {formatDay(ongoing.checkOut)}
                      </span>
                    </p>
                    <p className="m-0 text-xs text-warning-ink">
                      {t('notifications.detail.device.stayAtRisk',
                        'Un voyageur est sur place : une panne de pile le laisserait dehors.')}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="m-0 text-sm text-muted-foreground">
                  {t('notifications.detail.device.noStay',
                    "Le logement est vide : l'intervention peut être planifiée sans gêner personne.")}
                </p>
              )}
          </div>
        </div>
      </div>

      {/* Le motif CLOT le dossier : la fiche se lit d'un seul tenant — quel
          logement, quelle serrure, qui est dedans, et pourquoi on en parle. */}
      <ObservationBand text={observation} at={observedAt} />
    </section>
  );
}

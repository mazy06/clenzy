import React from 'react';
import { Badge, Button, Skeleton, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import { Check, ContentCopy, Lock, LockOpen, Person, VpnKey, WifiOff } from '../../icons';
import SmartLockMark from '../../components/baitly/SmartLockMark';
import BatteryGauge, { batteryTone, type BatteryTone } from '../../components/baitly/BatteryGauge';
import ChannelTag from '../../components/baitly/ChannelTag';
import GuestAvatar from '../../components/baitly/GuestAvatar';
import { guestPhotoSrc } from '../../services/api/guestsApi';
import { PropertyIdentity, useNotificationProperty } from './NotificationPropertyPanel';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';
import {
  smartLockApi,
  type SmartLockAccessCodeHistoryDto,
  type SmartLockDeviceDto,
} from '../../services/api/smartLockApi';
import { reservationsApi, type Reservation } from '../../services/api';
import type { Notification } from '../../services/api';

/**
 * Dossier d'une rotation manuelle de code de serrure.
 *
 * <p>« Serrure porte d'entrée : un nouveau code a été posé à la main » annonçait
 * un code que la fiche ne montrait pas, sur une serrure qu'elle ne décrivait
 * pas, dans un logement peut-être occupé — trois questions immédiates, trois
 * écrans à ouvrir. La fiche les réunit : le logement et son image, le code en
 * vigueur, l'objet et son état, et le séjour en cours s'il y en a un.</p>
 *
 * <p><b>Le code est relu, jamais recopié depuis le message.</b> Même règle que
 * {@link ./NotificationAccessCodePanel} : celui du message est celui de
 * l'instant de l'évènement, une rotation suivante le périme sans que la
 * notification ne bouge. C'est aussi pourquoi le secret ne transite pas par les
 * faits — seule la SERRURE y entre, et tout le reste se déduit d'elle.</p>
 *
 * <p>À distinguer de {@code NotificationDevicePanel}, qui montre l'ÉTAT d'une
 * serrure pour une alerte de pile. Ici le sujet est le code ; l'état de la
 * serrure n'est qu'un des faits qui l'entourent.</p>
 */

/** Serrure dont le code vient de tourner à la main, ou `null`. */
export function lockCodeDeviceIdOf(notification: Notification): number | null {
  if (notification.notificationKey !== 'SMART_LOCK_CODE_ROTATED_MANUALLY') return null;

  const raw = notification.metadata?.deviceId;
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
  return null;
}

export interface LockCodeDossier {
  device: SmartLockDeviceDto | null;
  history: SmartLockAccessCodeHistoryDto | null;
  /** Séjour en cours sur le logement, quand la serrure en signale un. */
  reservation: Reservation | null;
}

/**
 * Charge la serrure, son code en vigueur, puis le séjour en cours s'il existe.
 *
 * <p>Deux vagues : le séjour ne se connaît qu'une fois la serrure interrogée
 * (c'est elle qui dit s'il y en a un). Chaque pièce manquante se rend
 * silencieusement — la fiche reste lisible avec ce qu'elle a.</p>
 */
export function useNotificationLockCode(deviceId: number | null) {
  const [dossier, setDossier] = React.useState<LockCodeDossier | null>(null);
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

      setDossier({ device, history, reservation });
      setLoading(false);
    })();

    return () => { active = false; };
  }, [deviceId]);

  return { dossier, loading };
}

/** Attente : la forme du panneau, pas un tourniquet centré. */
export function NotificationLockCodeSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-12 shrink-0 rounded-lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-2 self-center">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <Skeleton className="h-[68px] w-full rounded-lg" />
      <Skeleton className="h-[86px] w-full" />
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/** Séparateur de section : un filet, pas une carte de plus. */
function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-3.5">
      <Caption>{title}</Caption>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** Copie le code, et le DIT — la confirmation appartient au bouton pressé. */
function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Presse-papiers refusé : le code reste sélectionnable à la main, on ne
      // fabrique pas de fausse réussite.
      setCopied(false);
    }
  };

  const label = copied
    ? t('notifications.detail.accessCode.copied', 'Copié')
    : t('notifications.detail.accessCode.copy', 'Copier le code');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onClick={() => void copy()}
          className={cn('shrink-0', copied ? 'text-success' : 'text-muted-foreground')}
        >
          {copied ? <Check size={16} strokeWidth={2} /> : <ContentCopy size={16} strokeWidth={1.75} />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const BRAND_LABEL: Record<string, string> = {
  TUYA: 'Tuya', NUKI: 'Nuki', TTLOCK: 'TTLock', YALE: 'Yale', SIMULATION: 'Simulation',
};

const TONE_SIGNAL: Record<BatteryTone, string> = {
  critical: 'var(--bui-destructive)',
  low: 'var(--bui-warning)',
  ok: 'var(--bui-success)',
};

function formatMoment(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  } catch {
    return iso;
  }
}

export default function NotificationLockCodePanel({
  dossier,
  propertyName,
  actor,
  observation,
}: {
  dossier: LockCodeDossier;
  propertyName?: string | null;
  /** Qui a régénéré le code. `null` pour un geste automatique. */
  actor?: string | null;
  /** Motif de l'évènement — ce que le panneau ne dit pas de lui-même. */
  observation?: string;
}) {
  const { t } = useTranslation();
  const { device, history, reservation } = dossier;
  const { property } = useNotificationProperty(device?.propertyId ?? null);

  const code = history?.current?.code?.trim();
  const validUntil = history?.current?.validUntil;
  const ongoing = history?.ongoingStay ?? null;
  const tone = device?.batteryLevel != null ? batteryTone(device.batteryLevel) : 'ok';
  const guestName = reservation?.guestName?.trim()
    || t('notifications.detail.lockCode.guest', 'Voyageur');
  const locked = (device?.lockState ?? '').toUpperCase() === 'LOCKED';

  // Ce que la rotation a remplacé : le code précédent, révoqué à l'instant même.
  const replaced = history?.past?.find((past) => past.status === 'REVOKED') ?? null;

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
      {/* Le logement et le code se lisent ensemble — « quel logement, quel
          code » est UNE question. Empilés, le code se retrouvait seul sur toute
          la largeur avec un vide à sa droite. Ils se replient l'un sous l'autre
          sous 640 px, où deux colonnes couperaient le code. */}
      <div className="grid gap-4 sm:grid-cols-2 sm:items-center">
        <PropertyIdentity
          property={property}
          name={property?.name ?? device?.propertyName ?? propertyName ?? ''}
        />

        {/* Le code : le sujet de la fiche, seul sur sa surface, à l'échelle où on
            le lit d'un coup d'œil en tenant un téléphone de l'autre main. */}
        {code ? (
          <div className="flex items-center gap-3 rounded-lg bg-card px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <Caption>{t('notifications.detail.lockCode.current', 'Code en vigueur')}</Caption>
              <p className="m-0 mt-1 truncate font-mono text-2xl leading-none font-semibold tracking-[0.18em] tabular-nums text-foreground">
                {code}
              </p>
              {validUntil && (
                <p className="m-0 mt-1.5 text-xs text-muted-foreground">
                  {t('notifications.detail.lockCode.validUntil', 'Valide jusqu’au')} {formatMoment(validUntil)}
                </p>
              )}
            </div>
            <CopyButton value={code} />
          </div>
        ) : (
          <p className="m-0 rounded-lg bg-card px-3.5 py-3 text-sm text-muted-foreground">
            {t('notifications.detail.lockCode.unknown',
              "Aucun code n'est en vigueur sur cette serrure : il a été révoqué depuis.")}
          </p>
        )}
      </div>

      {/* Qui a fait le geste. Un accès physique qui change de main sans qu'on
          sache qui l'a changé ne se relève pas. */}
      {actor && (
        <Section title={t('notifications.detail.lockCode.actor', 'Régénéré par')}>
          <p className="m-0 flex items-center gap-2 text-sm font-medium text-foreground">
            <span className="inline-flex shrink-0 text-muted-foreground">
              <Person size={14} strokeWidth={1.75} />
            </span>
            {actor}
          </p>
        </Section>
      )}

      {/* L'objet et l'occupant se lisent ensemble : « sur quelle porte, et qui
          est derrière ». Repliés l'un sous l'autre sous 640 px. */}
      <div className="grid gap-4 sm:grid-cols-2">
      {/* L'objet : sur quelle porte ce code ouvre, et dans quel état elle est. */}
      {device && (
        <Section title={t('notifications.detail.lockCode.device', 'La serrure')}>
          <div className="flex items-center gap-4">
            <SmartLockMark signal={TONE_SIGNAL[tone]} width={54} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-medium text-foreground">{device.name}</p>
                <p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">
                  {[device.roomName, BRAND_LABEL[device.brand] ?? device.brand].filter(Boolean).join(' · ')}
                </p>
              </div>
              {device.batteryLevel != null && <BatteryGauge level={device.batteryLevel} />}
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={locked ? 'success' : 'warning'}>
                  {locked
                    ? <Lock size={12} strokeWidth={2} />
                    : <LockOpen size={12} strokeWidth={2} />}
                  {locked
                    ? t('notifications.detail.lockCode.locked', 'Verrouillée')
                    : t('notifications.detail.lockCode.unlocked', 'Déverrouillée')}
                </Badge>
                {device.online === false && (
                  <Badge variant="outline">
                    <WifiOff size={12} strokeWidth={2} />
                    {t('notifications.detail.device.offline', 'Hors ligne')}
                  </Badge>
                )}
                <Badge variant="outline">
                  <VpnKey size={12} strokeWidth={2} />
                  {device.accessCodeMode === 'LOCK_GENERATED'
                    ? t('connectedObjects.codeMode.lock', 'La serrure génère le code')
                    : t('connectedObjects.codeMode.pms', 'Le PMS génère et pousse le code')}
                </Badge>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Qui est derrière la porte — la question qui décide s'il reste quelque
          chose à faire à la main. Le voyageur a un visage : à côté d'une serrure
          dessinée, une ligne de texte seule ne se voyait plus. */}
      <Section title={t('notifications.detail.lockCode.stay', 'Séjour en cours')}>
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
                {reservation?.source && <ChannelTag channel={reservation.source} />}
              </p>
              <p className="m-0 text-xs text-muted-foreground">
                {t('notifications.detail.lockCode.guestNotified',
                  'Son ancien code ne fonctionne plus. Le nouveau lui a été envoyé automatiquement.')}
              </p>
            </div>
          </div>
        ) : (
          <p className="m-0 text-sm text-muted-foreground">
            {t('notifications.detail.lockCode.noStay',
              "Le logement est vide : personne n'utilisait le code révoqué.")}
          </p>
        )}
      </Section>
      </div>

      {/* Ce que la rotation a remplacé : sans cette ligne, on ne sait pas si le
          geste a coupé un code qui servait, ni depuis quand. */}
      {replaced && (
        <Section title={t('notifications.detail.lockCode.replaced', 'Code remplacé')}>
          <p className="m-0 text-sm text-muted-foreground">
            {t('notifications.detail.lockCode.replacedLine', 'En service depuis le')}{' '}
            <span className="tabular-nums">{formatMoment(replaced.createdAt)}</span>
            {replaced.revokedAt && (
              <>
                , {t('notifications.detail.lockCode.revokedAt', 'révoqué le')}{' '}
                <span className="tabular-nums">{formatMoment(replaced.revokedAt)}</span>
              </>
            )}
            .
          </p>
        </Section>
      )}

      {/* Le motif CLÔT le dossier plutôt que de flotter au-dessus : la fiche se
          lit d'un seul tenant. Le texte vient de l'émetteur et n'est pas
          découpé ici. */}
      {observation?.trim() && (
        <Section title={t('notifications.detail.stay.observed', 'Ce qui a été observé')}>
          <p className="m-0 text-sm leading-relaxed text-pretty whitespace-pre-line text-foreground">
            {observation}
          </p>
        </Section>
      )}
    </section>
  );
}

import React from 'react';
import { Badge, Progress, Skeleton } from '../../components/ui';
import GuestAvatar from '../../components/baitly/GuestAvatar';
import { Money } from '../../components/baitly/Money';
import {
  Build,
  ContentCopy,
  LocationOn,
  OpenInNew,
  Schedule,
  VpnKey,
  Warning,
} from '../../icons';
import { sizedIcon } from '../../config/navigationIcons';
import { cn } from '../../utils/cn';
import { toApiMediaUrl } from '../../utils/mediaUrl';
import { useTranslation } from '../../hooks/useTranslation';
import { useThemeMode } from '../../hooks/useThemeMode';
import { getInterventionTypeLabel } from '../../utils/statusUtils';
import { interventionsApi } from '../../services/api/interventionsApi';
import type { InterventionDetailsData } from '../interventions/interventionUtils';
import { PropertyIdentity, PropertyLine, useNotificationProperty } from './NotificationPropertyPanel';
import { formatFactDate } from './notificationMeta';
import type { Property } from '../../services/api/propertiesApi';
import type { Notification } from '../../services/api';

/**
 * Le DOSSIER d'une intervention, dans la fiche d'une notification terrain.
 *
 * <p>« L'intervention "[TEST] Degat des eaux - urgence" a ete demarree. » : un
 * intitule entre guillemets, et c'est tout. Or celui qui recoit cette
 * notification a besoin de savoir OU c'est, comment y entrer, ce qu'il y a a
 * faire, si ca presse, qui s'en charge, pour combien et pour combien de temps.
 * Tout existait deja sur la fiche de l'intervention — a un ecran de distance,
 * et deux clics de plus quand on est sur le terrain.</p>
 *
 * <p>Trois sources, chargees ensemble : l'intervention pour sa nature et ses
 * chiffres, le logement pour sa vignette et ses coordonnees, les instructions
 * d'arrivee pour le code d'acces et les indications. Aucune n'est bloquante —
 * ce qui manque disparait, le reste s'affiche.</p>
 *
 * <p>L'urgence ouvre le panneau en BANNIERE plutot qu'en pastille : elle ne
 * qualifie pas un champ, elle qualifie tout ce qui suit.</p>
 */

/** Intervention designee par une notification, ou `null`. */
export function interventionIdOf(notification: Notification): number | null {
  const raw = notification.metadata?.interventionId;
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
  return null;
}

export interface InterventionDossier {
  intervention: InterventionDetailsData;
  property: Property | null;
}

/** Consignes d'acces du logement — le logement les rapporte deja. */
type AccessInstructions = NonNullable<Property['checkInInstructions']>;

/**
 * Charge l'intervention, puis son logement.
 *
 * <p>Deux requetes, pas trois : le logement rapporte DEJA ses consignes
 * d'arrivee — code de porte, stationnement, acces —, et c'est la meme source
 * que celle de l'ecran Interventions.</p>
 *
 * <p>Un echec de l'intervention laisse `dossier` a `null` et la fiche retombe
 * sur son message. Le logement est accessoire : son absence coute une vignette
 * et un encart d'acces, pas le panneau.</p>
 */
export function useNotificationIntervention(interventionId: number | null) {
  const [intervention, setIntervention] = React.useState<InterventionDetailsData | null>(null);
  const [loading, setLoading] = React.useState(interventionId !== null);

  React.useEffect(() => {
    if (interventionId === null) {
      setIntervention(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    interventionsApi
      .getById(interventionId)
      .then((loaded) => { if (active) setIntervention(loaded); })
      .catch(() => { if (active) setIntervention(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [interventionId]);

  const { property } = useNotificationProperty(intervention?.propertyId ?? null);

  return {
    dossier: intervention ? { intervention, property } : null,
    loading,
  };
}

/** Attente : la forme du panneau, pas un tourniquet centre. */
export function NotificationInterventionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-[66px] w-[88px] shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </div>
  );
}

/** Intitule de champ a l'interieur du panneau. */
function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/**
 * Teinte d'une priorite. Quatre valeurs (`LOW`, `NORMAL`, `HIGH`, `CRITICAL`) et
 * rien d'autre : une valeur inconnue ne fabrique pas de banniere plutot que
 * d'en inventer la couleur.
 */
const PRIORITY_TONE: Record<string, { band: string; ink: string; badge: 'success' | 'info' | 'warning' | 'destructive' }> = {
  LOW: { band: 'bg-success-soft', ink: 'text-success-ink', badge: 'success' },
  NORMAL: { band: 'bg-info-soft', ink: 'text-info-ink', badge: 'info' },
  HIGH: { band: 'bg-warning-soft', ink: 'text-warning-ink', badge: 'warning' },
  CRITICAL: { band: 'bg-destructive-soft', ink: 'text-destructive-ink', badge: 'destructive' },
};

/** Photos d'une intervention : tableau, chaine separee par virgules, ou rien. */
function photoList(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const urls = typeof raw === 'string' ? raw.split(',') : raw;
  return urls.map((url) => url.trim()).filter(Boolean);
}

/** Duree en minutes, rendue « 2 h 30 » plutot qu'en decimales. */
function formatDuration(minutes: number, t: (key: string, fallback: string) => string): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest} ${t('notifications.detail.intervention.minutes', 'min')}`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

/**
 * Vignette de carte cliquable — l'adresse, et le chemin pour y aller.
 *
 * <p>Une image statique, pas une carte interactive : on ne navigue pas dans une
 * fiche de notification, on l'ouvre dans l'application de cartes du telephone.
 * Sans coordonnees ou sans jeton, la tuile retombe sur un reperage sobre —
 * le LIEN, lui, marche toujours : il part sur l'adresse en toutes lettres.</p>
 */
function MapTile({ property, address }: { property: Property | null; address: string }) {
  const { t } = useTranslation();
  const { isDark } = useThemeMode();
  const [failed, setFailed] = React.useState(false);

  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
  const lat = property?.latitude;
  const lon = property?.longitude;
  const hasCoords = typeof lat === 'number' && typeof lon === 'number';

  const href = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  const style = isDark ? 'dark-v11' : 'streets-v12';
  const preview = token && hasCoords
    ? `https://api.mapbox.com/styles/v1/mapbox/${style}/static/pin-s+5453D6(${lon},${lat})/${lon},${lat},13,0/240x120@2x?access_token=${token}`
    : null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={t('notifications.detail.intervention.openMap', 'Ouvrir dans Maps')}
      className="group/map relative block h-[120px] w-[240px] shrink-0 overflow-hidden rounded-lg border border-border bg-field"
    >
      {preview && !failed ? (
        <img
          src={preview}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          {sizedIcon(<LocationOn />, 24, 1.5)}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-card/90 px-2.5 py-1.5 text-xs font-medium text-foreground">
        <span className="inline-flex shrink-0 text-muted-foreground">
          {sizedIcon(<OpenInNew />, 13, 1.75)}
        </span>
        <span className="truncate">{t('notifications.detail.intervention.openMap', 'Ouvrir dans Maps')}</span>
      </span>
    </a>
  );
}

/** Copie le code d'acces, et le dit sur le bouton qu'on vient de presser. */
function CopyCode({ code }: { code: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(code).then(() => setCopied(true)).catch(() => setCopied(false));
      }}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent p-0 font-mono text-lg font-semibold tracking-[0.16em] tabular-nums text-foreground transition-colors duration-200 hover:text-primary motion-reduce:transition-none"
    >
      {code}
      <span className={cn('inline-flex shrink-0', copied ? 'text-success' : 'text-muted-foreground')}>
        {sizedIcon(<ContentCopy />, 14, 1.75)}
      </span>
      <span className="sr-only">
        {copied
          ? t('notifications.detail.accessCode.copied', 'Copié')
          : t('notifications.detail.accessCode.copy', 'Copier le code')}
      </span>
    </button>
  );
}

/** Un chiffre du bandeau : intitule discret, valeur en avant. */
function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <Caption>{label}</Caption>
      <p className="m-0 mt-1 truncate text-sm font-semibold tabular-nums text-foreground">{children}</p>
    </div>
  );
}

export default function NotificationInterventionPanel({
  dossier,
  observation,
}: {
  dossier: InterventionDossier;
  /** Motif de l'evenement — ce que le panneau ne montre pas de lui-meme. */
  observation?: string;
}) {
  const { t, currentLanguage } = useTranslation();
  const { intervention, property } = dossier;
  const instructions: AccessInstructions | null = property?.checkInInstructions ?? null;

  const priority = intervention.priority?.toUpperCase() ?? '';
  const tone = PRIORITY_TONE[priority];
  const pressing = priority === 'HIGH' || priority === 'CRITICAL';

  const address = [intervention.propertyAddress, intervention.propertyPostalCode, intervention.propertyCity]
    .filter(Boolean).join(', ');

  const photos = [...photoList(intervention.beforePhotosUrls), ...photoList(intervention.afterPhotosUrls)];

  // Le cout REEL prime sur l'estime : une fois la mission faite, c'est lui qui
  // sera paye. Avant, l'estime est la seule promesse qui existe.
  const cost = intervention.actualCost && intervention.actualCost > 0
    ? { value: intervention.actualCost, label: t('notifications.detail.intervention.actualCost', 'Coût réel') }
    : intervention.estimatedCost && intervention.estimatedCost > 0
      ? { value: intervention.estimatedCost, label: t('notifications.detail.intervention.estimatedCost', 'Coût estimé') }
      : null;

  const duration = intervention.actualDurationMinutes && intervention.actualDurationMinutes > 0
    ? { text: formatDuration(intervention.actualDurationMinutes, t), label: t('notifications.detail.intervention.actualDuration', 'Durée réelle') }
    : intervention.estimatedDurationHours && intervention.estimatedDurationHours > 0
      ? { text: formatDuration(intervention.estimatedDurationHours * 60, t), label: t('notifications.detail.intervention.estimatedDuration', 'Durée prévue') }
      : null;

  return (
    <div className="flex flex-col gap-4">
      {/* L'urgence ne qualifie pas un champ, elle qualifie tout ce qui suit :
          elle ouvre donc le panneau, et seulement quand elle presse vraiment. */}
      {pressing && tone && (
        <div className={cn('flex items-center gap-2.5 rounded-lg px-3.5 py-2.5', tone.band, tone.ink)}>
          <span className="inline-flex shrink-0">{sizedIcon(<Warning />, 16, 2)}</span>
          <p className="m-0 text-sm font-semibold">
            {priority === 'CRITICAL'
              ? t('notifications.detail.intervention.critical', 'Priorité critique — à traiter avant le reste')
              : t('notifications.detail.intervention.high', 'Priorité élevée')}
          </p>
        </div>
      )}

      <section className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
        <PropertyIdentity
          property={property}
          name={intervention.propertyName}
          extra={address && <PropertyLine icon={<LocationOn />}>{address}</PropertyLine>}
          trailing={intervention.type ? (
            <Badge variant={tone?.badge ?? 'secondary'}>
              {getInterventionTypeLabel(intervention.type, t)}
            </Badge>
          ) : undefined}
        />

        <div className="rounded-lg bg-card px-3.5 py-3">
          <Caption>{t('notifications.detail.intervention.nature', 'Nature de l’intervention')}</Caption>
          <p className="m-0 mt-1 text-sm font-medium text-pretty text-foreground">{intervention.title}</p>
          {intervention.description?.trim() && (
            <p className="m-0 mt-2 text-sm leading-relaxed text-pretty whitespace-pre-line text-muted-foreground">
              {intervention.description}
            </p>
          )}
        </div>

        {intervention.sourceIssue && (
          <div className="border-s-2 border-border ps-3">
            <Caption>{t('notifications.detail.intervention.reported', 'Signalement à l’origine')}</Caption>
            <p className="m-0 mt-1 text-sm font-medium text-pretty text-foreground">
              {intervention.sourceIssue.title}
            </p>
            {intervention.sourceIssue.description?.trim() && (
              <p className="m-0 mt-1 text-sm leading-relaxed text-pretty whitespace-pre-line text-muted-foreground">
                {intervention.sourceIssue.description}
              </p>
            )}
            {intervention.sourceIssue.reportedByName && (
              <p className="m-0 mt-1 text-xs text-muted-foreground">
                {t('notifications.detail.intervention.reportedBy', 'Signalé par {{name}}', {
                  name: intervention.sourceIssue.reportedByName,
                })}
              </p>
            )}
            {(intervention.sourceIssue.photoUrls?.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {intervention.sourceIssue.photoUrls!.slice(0, 4).map((url) => (
                  <img
                    key={url}
                    src={toApiMediaUrl(url)}
                    alt=""
                    loading="lazy"
                    className="h-16 w-[88px] rounded-lg border border-border object-cover"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-x-8 gap-y-3 rounded-lg bg-card px-3.5 py-3">
          {intervention.assignedToName && (
            <div className="min-w-0">
              <Caption>{t('notifications.detail.metadata.assignee', 'Intervenant')}</Caption>
              <span className="mt-1 inline-flex min-w-0 items-center gap-1.5">
                <GuestAvatar name={intervention.assignedToName} size={20} />
                <span className="truncate text-sm font-medium text-foreground">
                  {intervention.assignedToName}
                </span>
              </span>
            </div>
          )}
          {intervention.scheduledDate && (
            <Figure label={t('notifications.detail.intervention.scheduled', 'Prévue le')}>
              {formatFactDate(intervention.scheduledDate.slice(0, 10), currentLanguage)}
            </Figure>
          )}
          {duration && (
            <Figure label={duration.label}>{duration.text}</Figure>
          )}
          {cost && (
            <div className="ms-auto min-w-0 text-end">
              <Caption>{cost.label}</Caption>
              <p className="m-0 mt-1 text-sm font-semibold tabular-nums text-foreground">
                <Money value={cost.value} from="EUR" />
              </p>
            </div>
          )}
        </div>

        {typeof intervention.progressPercentage === 'number'
          && intervention.progressPercentage > 0
          && intervention.progressPercentage < 100 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-4">
              <Caption>{t('notifications.detail.intervention.progress', 'Avancement')}</Caption>
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {Math.round(intervention.progressPercentage)} %
              </span>
            </div>
            <Progress value={intervention.progressPercentage} />
          </div>
        )}

        {(instructions?.accessCode?.trim() || instructions?.arrivalInstructions?.trim() || address) && (
          <div className="flex flex-wrap items-start gap-x-5 gap-y-4 rounded-lg bg-card px-3.5 py-3">
            {address && <MapTile property={property} address={address} />}

            <div className="flex min-w-[200px] flex-1 flex-col gap-3">
              {instructions?.accessCode?.trim() && (
                <div>
                  <Caption>{t('notifications.detail.accessCode.current', 'Code en vigueur')}</Caption>
                  <div className="mt-1">
                    <CopyCode code={instructions.accessCode.trim()} />
                  </div>
                </div>
              )}
              {instructions?.arrivalInstructions?.trim() && (
                <div>
                  <Caption>{t('notifications.detail.intervention.access', 'Indications d’accès')}</Caption>
                  <p className="m-0 mt-1 text-sm leading-relaxed text-pretty whitespace-pre-line text-muted-foreground">
                    {instructions.arrivalInstructions}
                  </p>
                </div>
              )}
              {instructions?.parkingInfo?.trim() && (
                <div>
                  <Caption>{t('notifications.detail.intervention.parking', 'Stationnement')}</Caption>
                  <p className="m-0 mt-1 text-sm leading-relaxed text-pretty whitespace-pre-line text-muted-foreground">
                    {instructions.parkingInfo}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {photos.length > 0 && (
          <div className="flex flex-col gap-2">
            <Caption>{t('notifications.detail.intervention.photos', 'Photos')}</Caption>
            <div className="flex flex-wrap gap-2">
              {photos.slice(0, 6).map((url) => (
                <img
                  key={url}
                  src={toApiMediaUrl(url)}
                  alt=""
                  loading="lazy"
                  className="h-16 w-[88px] rounded-lg border border-border object-cover"
                />
              ))}
              {photos.length > 6 && (
                <span className="flex h-16 w-[88px] items-center justify-center rounded-lg border border-border bg-field text-xs font-medium tabular-nums text-muted-foreground">
                  +{photos.length - 6}
                </span>
              )}
            </div>
          </div>
        )}

        {observation?.trim() && (
          <div className="border-t border-border pt-3.5">
            <Caption>{t('notifications.detail.stay.observed', 'Ce qui a été observé')}</Caption>
            <p className="m-0 mt-1.5 text-sm leading-relaxed text-pretty whitespace-pre-line text-foreground">
              {observation}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

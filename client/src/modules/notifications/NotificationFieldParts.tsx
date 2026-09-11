import React from 'react';
import { ContentCopy, LocationOn, OpenInNew, Warning } from '../../icons';
import { sizedIcon } from '../../config/navigationIcons';
import { cn } from '../../utils/cn';
import { toApiMediaUrl } from '../../utils/mediaUrl';
import { useTranslation } from '../../hooks/useTranslation';
import { formatFactDate } from './notificationMeta';
import { useThemeMode } from '../../hooks/useThemeMode';
import type { Property } from '../../services/api/propertiesApi';

/**
 * Les pieces communes aux fiches de TERRAIN — intervention, demande de service,
 * signalement.
 *
 * <p>Ces trois evenements ne parlent pas de la meme chose, mais celui qui les
 * recoit se pose les memes questions : est-ce que ca presse, ou est-ce, comment
 * y entrer, a quoi ca ressemble. Repondre trois fois de trois facons differentes
 * serait un defaut d'interface avant d'etre une duplication de code.</p>
 */

/** Intitule de champ a l'interieur d'un panneau. */
export function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/** Un chiffre : intitule discret, valeur en avant. */
export function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <Caption>{label}</Caption>
      <p className="m-0 mt-1 truncate text-sm font-semibold tabular-nums text-foreground">{children}</p>
    </div>
  );
}

/**
 * Teinte d'une priorite. Les valeurs du domaine et rien d'autre : une valeur
 * inconnue ne fabrique pas de banniere plutot que d'en inventer la couleur.
 *
 * <p>Les demandes et les signalements emploient leur propre vocabulaire
 * (`URGENT`, `MEDIUM`) pour les memes degres — ils sont ramenes ici aux quatre
 * paliers des interventions.</p>
 */
const PRIORITY_TONE: Record<string, { band: string; ink: string; badge: 'success' | 'info' | 'warning' | 'destructive' }> = {
  LOW: { band: 'bg-success-soft', ink: 'text-success-ink', badge: 'success' },
  NORMAL: { band: 'bg-info-soft', ink: 'text-info-ink', badge: 'info' },
  MEDIUM: { band: 'bg-info-soft', ink: 'text-info-ink', badge: 'info' },
  HIGH: { band: 'bg-warning-soft', ink: 'text-warning-ink', badge: 'warning' },
  URGENT: { band: 'bg-destructive-soft', ink: 'text-destructive-ink', badge: 'destructive' },
  CRITICAL: { band: 'bg-destructive-soft', ink: 'text-destructive-ink', badge: 'destructive' },
};

export function priorityTone(priority: string | null | undefined) {
  return PRIORITY_TONE[priority?.toUpperCase() ?? ''] ?? null;
}

/**
 * L'urgence en BANNIERE, pas en pastille : elle ne qualifie pas un champ, elle
 * qualifie tout ce qui suit.
 *
 * <p>Elle n'apparait qu'a partir d'« elevee » — une banniere sur chaque ligne
 * ne dirait plus rien.</p>
 */
export function PriorityBanner({ priority }: { priority: string | null | undefined }) {
  const { t } = useTranslation();
  const key = priority?.toUpperCase() ?? '';
  const tone = priorityTone(key);
  const severe = key === 'CRITICAL' || key === 'URGENT';
  if (!tone || !(severe || key === 'HIGH')) return null;

  return (
    <div className={cn('flex items-center gap-2.5 rounded-lg px-3.5 py-2.5', tone.band, tone.ink)}>
      <span className="inline-flex shrink-0">{sizedIcon(<Warning />, 16, 2)}</span>
      <p className="m-0 text-sm font-semibold">
        {severe
          ? t('notifications.detail.intervention.critical', 'Priorité critique — à traiter avant le reste')
          : t('notifications.detail.intervention.high', 'Priorité élevée')}
      </p>
    </div>
  );
}

/**
 * Vignette de carte cliquable — l'adresse, et le chemin pour y aller.
 *
 * <p>Une image statique, pas une carte interactive : on ne navigue pas dans une
 * fiche de notification, on l'ouvre dans l'application de cartes du telephone.
 * Sans coordonnees ou sans jeton, la tuile retombe sur un reperage sobre — le
 * LIEN, lui, marche toujours : il part sur l'adresse en toutes lettres.</p>
 */
export function MapTile({ property, address }: { property: Property | null; address: string }) {
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
      className="relative block h-[120px] w-[240px] shrink-0 overflow-hidden rounded-lg border border-border bg-field"
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
export function CopyCode({ code }: { code: string }) {
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

/**
 * Comment entrer : la carte, le code, les indications, le stationnement.
 *
 * <p>Ces consignes vivaient sur la fiche du logement, a deux ecrans de celui
 * qui se deplace. Rien a dire : l'encart disparait.</p>
 */
export function AccessBlock({ property, address }: { property: Property | null; address: string }) {
  const { t } = useTranslation();
  const access = property?.checkInInstructions ?? null;
  const code = access?.accessCode?.trim();
  const arrival = access?.arrivalInstructions?.trim();
  const parking = access?.parkingInfo?.trim();
  if (!address && !code && !arrival && !parking) return null;

  return (
    <div className="flex flex-wrap items-start gap-x-5 gap-y-4 rounded-lg bg-card px-3.5 py-3">
      {address && <MapTile property={property} address={address} />}

      <div className="flex min-w-[200px] flex-1 flex-col gap-3">
        {code && (
          <div>
            <Caption>{t('notifications.detail.accessCode.current', 'Code en vigueur')}</Caption>
            <div className="mt-1"><CopyCode code={code} /></div>
          </div>
        )}
        {arrival && (
          <div>
            <Caption>{t('notifications.detail.intervention.access', 'Indications d’accès')}</Caption>
            <p className="m-0 mt-1 text-sm leading-relaxed text-pretty whitespace-pre-line text-muted-foreground">
              {arrival}
            </p>
          </div>
        )}
        {parking && (
          <div>
            <Caption>{t('notifications.detail.intervention.parking', 'Stationnement')}</Caption>
            <p className="m-0 mt-1 text-sm leading-relaxed text-pretty whitespace-pre-line text-muted-foreground">
              {parking}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Photos : tableau, chaine separee par virgules, ou rien. */
export function photoList(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  const urls = typeof raw === 'string' ? raw.split(',') : raw;
  return urls.map((url) => url.trim()).filter(Boolean);
}

/** Bande de miniatures, bornee — au-dela, un compteur plutot qu'un mur. */
export function PhotoStrip({ urls, max = 6 }: { urls: string[]; max?: number }) {
  if (urls.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {urls.slice(0, max).map((url) => (
        <img
          key={url}
          src={toApiMediaUrl(url)}
          alt=""
          loading="lazy"
          className="h-16 w-[88px] rounded-lg border border-border object-cover"
        />
      ))}
      {urls.length > max && (
        <span className="flex h-16 w-[88px] items-center justify-center rounded-lg border border-border bg-field text-xs font-medium tabular-nums text-muted-foreground">
          +{urls.length - max}
        </span>
      )}
    </div>
  );
}

/**
 * Le motif de l'evenement, en cloture de dossier.
 *
 * <p>Le texte vient de l'emetteur et n'est pas decoupe ici : decouper de la
 * prose a l'ecran casserait a la premiere reformulation.</p>
 *
 * <p><b>Il est DATE.</b> Le dossier au-dessus est relu maintenant ; ce texte,
 * lui, a ete ecrit au moment de l'evenement. Un sejour deplace puis annule
 * donnait alors deux verites contradictoires cote a cote — « Test Property, du
 * 24 au 25 » dans le message, « Appartement Medina, du 23 au 25, annulee » dans
 * le dossier. Les deux sont vraies ; seule la date le disait.</p>
 */
export function ObservationBand({ text, at }: { text?: string; at?: string }) {
  const { t, currentLanguage } = useTranslation();
  if (!text?.trim()) return null;
  const moment = at ? formatFactDate(at.slice(0, 10), currentLanguage) : null;
  return (
    <div className="border-t border-border pt-3.5">
      <Caption>
        {t('notifications.detail.stay.observed', 'Ce qui a été observé')}
        {moment && <span className="ms-1.5 font-normal normal-case">· {moment}</span>}
      </Caption>
      <p className="m-0 mt-1.5 text-sm leading-relaxed text-pretty whitespace-pre-line text-foreground">
        {text}
      </p>
    </div>
  );
}

/** Duree en minutes, rendue « 2 h 30 » plutot qu'en decimales. */
export function formatDuration(minutes: number, t: (key: string, fallback: string) => string): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest} ${t('notifications.detail.intervention.minutes', 'min')}`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

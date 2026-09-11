import React from 'react';
import { Badge, Button, Skeleton, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import { Autorenew, Check, ContentCopy, VpnKey } from '../../icons';
import { sizedIcon, SCREEN_ICON } from '../../config/navigationIcons';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';
import { airbnbApi, type CheckInInstructions } from '../../services/api/airbnbApi';
import type { Notification } from '../../services/api';

/**
 * Le code d'acces d'un logement, dans la fiche d'une rotation.
 *
 * <p>« Le voyageur est parti : le code d'acces de "Maison Plumereau" a ete
 * regenere (1708A) » : le code etait noye dans une phrase, a relire caractere
 * par caractere pour aller le taper sur une boite a cles. Ici il a une surface,
 * une echelle, et un bouton pour le copier.</p>
 *
 * <p><b>Il est relu, jamais recopie depuis le message.</b> Le code du message
 * est celui de l'instant de l'evenement ; une seconde rotation le perime sans
 * que la notification ne bouge, et c'est alors l'ANCIEN code qu'on irait poser
 * sur la boite. La fiche va donc chercher celui qui est EN VIGUEUR, et son
 * intitule le dit — c'est la seule facon honnete d'afficher les deux sans
 * decouper la prose du message pour les comparer.</p>
 *
 * <p>Le secret ne transite pas par les faits de la notification — seul le
 * logement y entre, comme repere de navigation.</p>
 */

/** Logement d'une rotation de code, ou `null`. */
export function accessCodePropertyIdOf(notification: Notification): number | null {
  if (notification.notificationKey !== 'ACCESS_CODE_ROTATED') return null;

  const raw = notification.metadata?.propertyId;
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
  return null;
}

/**
 * Charge les instructions d'arrivee du logement — le code y vit.
 *
 * <p>Un echec ne fait rien echouer : `instructions` reste `null` et la fiche
 * retombe sur son message, qui porte deja le code tel qu'il etait.</p>
 */
export function useNotificationAccessCode(propertyId: number | null) {
  const [instructions, setInstructions] = React.useState<CheckInInstructions | null>(null);
  const [loading, setLoading] = React.useState(propertyId !== null);

  React.useEffect(() => {
    if (propertyId === null) {
      setInstructions(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    airbnbApi
      .getCheckInInstructions(propertyId)
      .then((loaded) => { if (active) setInstructions(loaded); })
      .catch(() => { if (active) setInstructions(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [propertyId]);

  return { instructions, loading };
}

/** Attente : la forme du panneau, pas un tourniquet centre. */
export function NotificationAccessCodeSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 shrink-0 rounded-lg" />
        <Skeleton className="h-3.5 w-40" />
      </div>
      <Skeleton className="h-[68px] w-full rounded-lg" />
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
 * Copie le code, et le DIT — sans toast : la confirmation appartient au bouton
 * qu'on vient de presser, pas a un coin de l'ecran.
 */
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
      // Presse-papiers refuse (contexte non securise, permission) : le code
      // reste selectionnable a la main, on ne fabrique pas de fausse reussite.
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
          {copied
            ? <Check size={16} strokeWidth={2} />
            : <ContentCopy size={16} strokeWidth={1.75} />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Le code en vigueur, le logement, et le motif de l'evenement.
 *
 * <p>Le code est pose seul sur sa surface, a l'echelle ou on le lit d'un coup
 * d'oeil en tenant une boite a cles d'une main. Espacement des caracteres :
 * « 1708A » se recopie caractere par caractere, pas comme un mot.</p>
 */
export default function NotificationAccessCodePanel({
  instructions,
  propertyName,
  observation,
}: {
  instructions: CheckInInstructions;
  propertyName?: string | null;
  /** Motif de l'evenement — ce que le panneau ne montre pas de lui-meme. */
  observation?: string;
}) {
  const { t } = useTranslation();
  const code = instructions.accessCode?.trim();

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
      <header className="flex items-center gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground">
          {sizedIcon(<VpnKey />, 17, 1.75)}
        </span>
        <div className="min-w-0 flex-1">
          {propertyName && (
            <p className="m-0 inline-flex min-w-0 max-w-full items-center gap-1.5 text-sm font-semibold text-foreground">
              <span className="inline-flex shrink-0 text-muted-foreground">
                {sizedIcon(SCREEN_ICON['/properties'], 14, 1.75)}
              </span>
              <span className="truncate">{propertyName}</span>
            </p>
          )}
        </div>
        {instructions.accessCodeAutoRotate && (
          <Badge variant="info">
            <Autorenew size={12} strokeWidth={2} />
            {t('notifications.detail.accessCode.autoRotate', 'Renouvellement auto')}
          </Badge>
        )}
      </header>

      {code ? (
        <div className="flex items-center gap-3 rounded-lg bg-card px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <Caption>{t('notifications.detail.accessCode.current', 'Code en vigueur')}</Caption>
            <p className="m-0 mt-1 truncate font-mono text-2xl leading-none font-semibold tracking-[0.18em] tabular-nums text-foreground">
              {code}
            </p>
          </div>
          <CopyButton value={code} />
        </div>
      ) : (
        <p className="m-0 rounded-lg bg-card px-3.5 py-3 text-sm text-muted-foreground">
          {t('notifications.detail.accessCode.unknown',
            "Aucun code d'accès n'est enregistré sur ce logement.")}
        </p>
      )}

      {/* Le motif CLOT le dossier plutot que de flotter sous la carte : la fiche
          se lit d'un seul tenant — quel logement, quel code, et pourquoi il a
          change. Le texte vient de l'emetteur et n'est pas decoupe ici. */}
      {observation?.trim() && (
        <div className="border-t border-border pt-3.5">
          <Caption>{t('notifications.detail.stay.observed', 'Ce qui a été observé')}</Caption>
          <p className="m-0 mt-1.5 text-sm leading-relaxed text-pretty whitespace-pre-line text-foreground">
            {observation}
          </p>
        </div>
      )}
    </section>
  );
}

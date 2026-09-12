import React from 'react';
import { Badge, Button, Skeleton, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import { Autorenew, Check, ContentCopy, Group, Person, Schedule } from '../../icons';
import GuestAvatar from '../../components/baitly/GuestAvatar';
import { PropertyIdentity, useNotificationProperty } from './NotificationPropertyPanel';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';
import { resolveMediaUrl } from '../../config/api';
import { getInterventionStatusLabel, getInterventionTypeLabel } from '../../utils/statusUtils';
import { airbnbApi, type CheckInInstructions } from '../../services/api/airbnbApi';
import { interventionsApi } from '../../services/api/interventionsApi';
import { factId, formatFactDate } from './notificationMeta';
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
 *
 * <p><b>Le code tourne POUR QUELQU'UN.</b> Au depart du voyageur, c'est le
 * menage qui va trouver la boite a cles — et la fiche ne disait pas qui. « Qui
 * va s'en servir » nomme donc l'intervenant ou l'equipe attendue, la date de
 * son passage et l'etat de sa mission : sans cela, « pensez a mettre a jour le
 * code » ne dit pas pour quand, ni a qui le transmettre.</p>
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
 * Mission a qui ce code est destine, telle que L'EMETTEUR l'a designee.
 *
 * <p>Depuis {@code AccessCodeRotationScheduler}, la rotation nomme la visite
 * qui va se servir du code. C'est un lien DUR : rien n'est deduit, et la fiche
 * montre la mission que le geste visait, pas celle qui s'en approche le plus
 * aujourd'hui.</p>
 *
 * <p>`null` pour les notifications emises avant ce fait — rien ne les fera
 * renotifier, et c'est {@link nextVisitOf} qui prend alors le relais.</p>
 */
export function accessCodeVisitIdOf(notification: Notification): number | null {
  if (notification.notificationKey !== 'ACCESS_CODE_ROTATED') return null;
  return factId(notification, 'interventionId');
}

/**
 * Ce que la fiche montre d'une visite.
 *
 * <p>Le strict necessaire, pour accepter indifferemment une ligne de liste
 * ({@code Intervention}) et un dossier complet ({@code InterventionDetailsData})
 * — les deux chemins de chargement ci-dessous.</p>
 */
export interface AccessCodeVisit {
  id: number;
  type: string;
  status: string;
  scheduledDate: string;
  assignedToName?: string;
  assignedToType?: 'user' | 'team';
  /** Photo de l'intervenant, URL ticketee servie par l'API. */
  assignedToAvatarUrl?: string | null;
  assignmentResponse?: 'PENDING' | 'ACCEPTED' | 'DECLINED';
}

/**
 * Un menage se reconnait a son type : tous les libelles de nettoyage le portent
 * ({@code CLEANING}, {@code DEEP_CLEANING}, {@code KITCHEN_CLEANING}...). Le
 * type n'etant pas contraint en base, on lit le mot plutot qu'une liste close
 * qui laisserait passer le prochain libelle ajoute. Meme regle que
 * {@code AccessCodeRotationScheduler.isCleaning}, cote serveur.
 */
function isCleaning(type?: string | null): boolean {
  const upper = (type ?? '').toUpperCase();
  return upper.includes('CLEAN') || upper.includes('HOUSEKEEP') || upper.includes('MENAGE');
}

/**
 * L'intervention qui va se servir du nouveau code.
 *
 * <p>Le menage d'abord — c'est POUR LUI que le code tourne au depart du
 * voyageur. A defaut, la premiere visite prevue : quelle qu'elle soit, c'est
 * elle qui trouvera la boite a cles. Une mission annulee ne compte pas :
 * personne ne viendra.</p>
 */
export function nextVisitOf(list: AccessCodeVisit[]): AccessCodeVisit | null {
  const live = list
    .filter((visit) => (visit.status ?? '').toUpperCase() !== 'CANCELLED')
    .sort((a, b) => (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? ''));
  return live.find((visit) => isCleaning(visit.type)) ?? live[0] ?? null;
}

/**
 * Charge les instructions d'arrivee du logement — le code y vit — et la visite
 * qui va s'en servir.
 *
 * <p>Deux chemins pour la visite, dans cet ordre. <b>Le lien dur d'abord</b> :
 * quand la notification NOMME la mission, elle est lue par son identifiant, et
 * c'est bien celle que la rotation visait. <b>La deduction ensuite</b>, pour
 * les fiches emises avant ce fait : la premiere visite prevue sur le logement,
 * menage en priorite.</p>
 *
 * <p>Les visites deduites sont cherchees a partir du JOUR de l'evenement, pas
 * de maintenant : une fiche relue trois jours plus tard doit toujours montrer
 * le menage qui a suivi ce depart-la, meme s'il est deja fait.</p>
 *
 * <p>Aucun des deux appels n'est bloquant : `instructions` a `null` fait
 * retomber la fiche sur son message, qui porte deja le code tel qu'il etait ;
 * `visit` a `null` ne coute qu'une section.</p>
 */
export function useNotificationAccessCode(
  propertyId: number | null,
  visitId: number | null,
  since?: string | null,
) {
  const [instructions, setInstructions] = React.useState<CheckInInstructions | null>(null);
  const [visit, setVisit] = React.useState<AccessCodeVisit | null>(null);
  const [loading, setLoading] = React.useState(propertyId !== null);

  React.useEffect(() => {
    if (propertyId === null) {
      setInstructions(null);
      setVisit(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    const day = (since ?? new Date().toISOString()).slice(0, 10);

    const loadVisit = async (): Promise<AccessCodeVisit | null> => {
      if (visitId !== null) {
        return interventionsApi.getById(visitId).catch(() => null);
      }
      const upcoming = await interventionsApi
        .getAll({ propertyId, startDate: day, size: 10, sort: 'scheduledDate,asc' })
        .catch(() => []);
      return nextVisitOf(upcoming);
    };

    void (async () => {
      const [loadedInstructions, loadedVisit] = await Promise.all([
        airbnbApi.getCheckInInstructions(propertyId).catch(() => null),
        loadVisit(),
      ]);
      if (!active) return;

      setInstructions(loadedInstructions);
      setVisit(loadedVisit);
      setLoading(false);
    })();

    return () => { active = false; };
  }, [propertyId, visitId, since]);

  return { instructions, visit, loading };
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
      <Skeleton className="h-[52px] w-full" />
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

/** Separateur de section : un filet, pas une carte de plus. */
function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-3.5">
      <Caption>{title}</Caption>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/**
 * Le moment d'une visite : le jour, et l'heure quand elle est posee.
 *
 * <p>Minuit se lit comme « pas d'heure convenue » — l'afficher ferait croire a
 * un rendez-vous a 00:00.</p>
 */
function formatVisitMoment(iso: string, lang: string): string {
  const day = formatFactDate(iso.slice(0, 10), lang);
  const time = iso.slice(11, 16);
  return /^\d{2}:\d{2}$/.test(time) && time !== '00:00' ? `${day} · ${time}` : day;
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
  visit,
  propertyName,
  observation,
}: {
  instructions: CheckInInstructions;
  /** La visite qui va se servir du code. `null` : aucune n'est prevue. */
  visit?: AccessCodeVisit | null;
  propertyName?: string | null;
  /** Motif de l'evenement — ce que le panneau ne montre pas de lui-meme. */
  observation?: string;
}) {
  const { t, currentLanguage } = useTranslation();
  const { property } = useNotificationProperty(instructions.propertyId);
  const code = instructions.accessCode?.trim();

  const assignee = visit?.assignedToName?.trim();
  // L'URL vient ticketee du serveur : elle se suffit dans un `<img>`, il ne lui
  // manque que l'origine de l'API — le front et l'API sont sur deux ports en
  // dev, et un chemin nu viserait Vite, qui rend index.html.
  const assigneePhoto = resolveMediaUrl(visit?.assignedToAvatarUrl);
  const isTeam = visit?.assignedToType === 'team';
  const awaitingAnswer = visit?.assignmentResponse === 'PENDING';
  // La mission nommee par la notification a pu etre annulee DEPUIS : le fait ne
  // bouge pas, le statut si. Dire qu'elle « trouvera la boite a cles » serait
  // alors faux — c'est justement ce que le lien dur permet de constater.
  const cancelled = (visit?.status ?? '').toUpperCase() === 'CANCELLED';

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
      <PropertyIdentity
        property={property}
        name={property?.name ?? propertyName ?? ''}
        trailing={instructions.accessCodeAutoRotate ? (
          <Badge variant="info">
            <Autorenew size={12} strokeWidth={2} />
            {t('notifications.detail.accessCode.autoRotate', 'Renouvellement auto')}
          </Badge>
        ) : undefined}
      />

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

      <Section title={t('notifications.detail.accessCode.visit', 'Qui va s’en servir')}>
        {visit ? (
          <div className="flex items-start gap-3">
            {assignee ? (
              <GuestAvatar name={assignee} photoUrl={assigneePhoto} size={36} />
            ) : (
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground">
                <Person size={18} strokeWidth={1.75} />
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground">
                {assignee ? (
                  <>
                    <span className="font-medium">{assignee}</span>
                    {isTeam && (
                      <Badge variant="outline">
                        <Group size={12} strokeWidth={2} />
                        {t('notifications.detail.accessCode.team', 'Équipe')}
                      </Badge>
                    )}
                  </>
                ) : (
                  <span className="font-medium text-muted-foreground">
                    {t('notifications.detail.accessCode.unassigned', 'Aucun intervenant assigné')}
                  </span>
                )}
                <Badge variant="secondary">{getInterventionTypeLabel(visit.type, t)}</Badge>
                <Badge variant={cancelled ? 'destructive' : 'outline'}>
                  {getInterventionStatusLabel(visit.status, t)}
                </Badge>
                {awaitingAnswer && (
                  <Badge variant="warning">
                    {t('notifications.detail.accessCode.awaitingAnswer', 'En attente de réponse')}
                  </Badge>
                )}
              </p>
              {visit.scheduledDate && (
                <p className="m-0 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-flex shrink-0">
                    <Schedule size={13} strokeWidth={1.75} />
                  </span>
                  <span className="tabular-nums">
                    {formatVisitMoment(visit.scheduledDate, currentLanguage)}
                  </span>
                </p>
              )}
              <p className="m-0 text-xs text-muted-foreground">
                {cancelled
                  ? t('notifications.detail.accessCode.cancelledHint',
                      'Cette mission a été annulée depuis : plus personne n’est attendu avec ce code.')
                  : assignee
                    ? t('notifications.detail.accessCode.visitHint',
                        'C’est cette personne qui trouvera la boîte à clés : le nouveau code doit lui parvenir avant son passage.')
                    : t('notifications.detail.accessCode.unassignedHint',
                        'La mission n’a pas encore d’intervenant : le nouveau code n’a été transmis à personne.')}
              </p>
            </div>
          </div>
        ) : (
          <p className="m-0 text-sm text-muted-foreground">
            {t('notifications.detail.accessCode.noVisit',
              'Aucune intervention n’est prévue sur ce logement : le nouveau code n’attend personne.')}
          </p>
        )}
      </Section>

      {/* Le motif CLOT le dossier plutot que de flotter sous la carte : la fiche
          se lit d'un seul tenant — quel logement, quel code, pour qui, et
          pourquoi il a change. Le texte vient de l'emetteur, non decoupe ici. */}
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

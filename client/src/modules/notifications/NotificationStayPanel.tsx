import React from 'react';
import { parseISO } from 'date-fns';
import { ar, enUS, fr } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Skeleton,
} from '../../components/ui';
import GuestAvatar from '../../components/baitly/GuestAvatar';
import ChannelTag from '../../components/baitly/ChannelTag';
import { Money } from '../../components/baitly/Money';
import SendMessageDialog from '../messaging/SendMessageDialog';
import {
  BlockOutlined,
  Email,
  Person,
  Phone,
  Send,
} from '../../icons';
import { sizedIcon } from '../../config/navigationIcons';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';
import { PropertyIdentity, PropertyLine } from './NotificationPropertyPanel';
import RangeCalendar, { type CalendarRange } from './RangeCalendar';
import { guestPhotoSrc } from '../../services/api/guestsApi';
import { propertiesApi, type Property } from '../../services/api/propertiesApi';
import { reservationsApi, type Reservation } from '../../services/api/reservationsApi';
import { deepLinkId, factId, formatFactDate, FACT_ICON } from './notificationMeta';
import type { Notification } from '../../services/api';

/**
 * Le SEJOUR designe par une carte de la constellation, et les gestes qui
 * portent dessus.
 *
 * <p>« No-show possible (reservation #498) » etait un paragraphe : la date
 * d'arrivee dans une phrase, le voyageur nulle part, le logement nulle part, et
 * les nuits en jeu a compter de tete. Le dossier existe pourtant en entier —
 * il suffisait d'aller le lire. Ce panneau montre donc ce sur quoi la decision
 * porte : le logement avec sa photo, le voyageur avec son visage et ses moyens
 * de contact, la fenetre du sejour avec la part deja consommee et la part
 * encore revendable.</p>
 *
 * <p><b>Deux gestes, deux natures.</b> Relancer la fiche voyageur est reversible
 * et s'execute ici ({@code POST /guest-messaging/send}, qui re-verifie
 * destinataire et canal). Annuler la reservation ne l'est pas : confirmation
 * explicite, puis le chemin canonique ({@code DELETE /reservations/:id}) qui
 * valide l'acces au logement et libere les jours au calendrier. Aucun des deux
 * ne rejoue de contrat cote client — ils appellent l'endpoint qui le porte.</p>
 *
 * <p>« Marquer no-show », lui, reste une NAVIGATION vers la file de supervision :
 * c'est une carte HITL, son modal de confirmation enumere les consequences, et
 * dupliquer ce parcours ici en ferait deux versions qui divergent.</p>
 */

/**
 * Gestes de la constellation qui portent sur un SEJOUR.
 *
 * <p>La liste est explicite : {@code reservationId} designe « une reservation »,
 * pas « une reservation sur laquelle ces gestes-ci ont un sens ». Une
 * notification de messagerie porte le meme fait, et n'a rien a faire d'un
 * « Annuler la reservation ».</p>
 */
const STAY_ACTION_TYPES = new Set(['NOSHOW_MARK']);

/**
 * Sejour designe par une notification, ou `null`.
 *
 * <p>Le DOSSIER s'ouvre des qu'un sejour est designe — un message envoye, une
 * arrivee, une annulation parlent tous du meme objet, et un gestionnaire se
 * pose les memes questions devant chacun. Ce sont les GESTES qui restent
 * reserves (cf. {@link stayActionsApply}).</p>
 *
 * <p>Le fait d'abord ; a defaut, le sejour surligne par le lien profond
 * ({@code /reservations?highlight=25}), que ces notifications portent depuis
 * toujours.</p>
 */
export function reservationIdOf(notification: Notification): number | null {
  const fact = factId(notification, 'reservationId');
  if (fact !== null) return fact;

  return notification.notificationKey?.startsWith('RESERVATION_')
    ? deepLinkId(notification, { param: 'highlight' })
    : null;
}

/**
 * Les gestes de no-show ne valent que pour la carte qui les propose : marquer,
 * relancer, annuler n'ont de sens que tant que l'agent attend une decision.
 */
export function stayActionsApply(notification: Notification): boolean {
  const actionType = notification.metadata?.actionType;
  return typeof actionType === 'string' && STAY_ACTION_TYPES.has(actionType);
}

export interface NotificationStay {
  reservation: Reservation;
  /** Logement du sejour — charge pour sa photo. `null` si illisible. */
  property: Property | null;
}

/**
 * Charge le sejour, puis son logement.
 *
 * <p>L'etat est relu MAINTENANT, pas au moment du scan : un sejour annule
 * entre-temps par un collegue doit se dire tel quel, et non laisser la fiche
 * proposer de l'annuler une seconde fois.</p>
 *
 * <p>Un echec ne fait rien echouer : `stay` reste `null` et la fiche retombe
 * sur son message. Le logement, lui, est accessoire — son absence coute une
 * vignette, pas le panneau.</p>
 */
export function useNotificationStay(reservationId: number | null) {
  const [stay, setStay] = React.useState<NotificationStay | null>(null);
  const [loading, setLoading] = React.useState(reservationId !== null);

  const load = React.useCallback(() => {
    if (reservationId === null) {
      setStay(null);
      setLoading(false);
      return () => {};
    }
    let active = true;
    setLoading(true);
    reservationsApi
      .getById(reservationId)
      .then(async (reservation) => {
        const property = await propertiesApi.getById(reservation.propertyId).catch(() => null);
        if (active) setStay({ reservation, property });
      })
      .catch(() => { if (active) setStay(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reservationId]);

  React.useEffect(() => load(), [load]);

  return { stay, loading, reload: load };
}

/** Attente du dossier : la forme du panneau, pas un tourniquet centre. */
export function NotificationStaySkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-[66px] w-[88px] shrink-0 rounded-lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <Skeleton className="h-14 w-full rounded-lg" />
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

/** Teinte du statut d'un sejour. */
const STATUS_BADGE: Record<string, 'success' | 'info' | 'warning' | 'destructive' | 'secondary'> = {
  confirmed: 'success',
  checked_in: 'info',
  checked_out: 'secondary',
  pending: 'warning',
  cancelled: 'destructive',
};

/** Nombre de nuits entre deux dates ISO, ou `null` si l'une est illisible. */
function nightsBetween(from: string, to: string): number | null {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  return Math.round((b - a) / 86_400_000);
}

/** Aujourd'hui, en date ISO locale — la borne qui separe le consomme du revendable. */
function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Un moyen de joindre le voyageur, ou rien — pas de ligne vide « — ». */
function ContactLine({ icon, value, href }: { icon: React.ReactNode; value?: string; href: string }) {
  if (!value?.trim()) return null;
  return (
    <a
      href={`${href}${value.trim()}`}
      className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <span className="inline-flex shrink-0">{sizedIcon(icon, 13, 1.75)}</span>
      <span className="truncate">{value}</span>
    </a>
  );
}

/**
 * Le dossier du sejour : logement, voyageur, fenetre, montant.
 *
 * <p>La fenetre porte la seule chose que la phrase ne disait pas — combien de
 * nuits sont encore revendables. La barre la montre : la part sombre est
 * consommee (elle ne reviendra pas), la part teintee est celle que « Marquer
 * no-show » remet en vente.</p>
 */
export default function NotificationStayPanel({
  stay,
  observation,
}: {
  stay: NotificationStay;
  /** Motif de l'evenement — ce que la carte ne montre pas d'elle-meme. */
  observation?: string;
}) {
  const { t, currentLanguage } = useTranslation();
  const { reservation, property } = stay;

  const guestName = reservation.guestName?.trim()
    || t('notifications.detail.stay.unknownGuest', 'Voyageur inconnu');
  const nights = nightsBetween(reservation.checkIn, reservation.checkOut);
  const today = todayIso();
  const remaining = reservation.checkOut > today
    ? nightsBetween(reservation.checkIn > today ? reservation.checkIn : today, reservation.checkOut)
    : 0;
  const consumedRatio = nights && remaining !== null
    ? Math.min(1, Math.max(0, (nights - remaining) / nights))
    : 0;

  const cancelled = reservation.status === 'cancelled';

  // Deux plages plutot qu'une : ce qui est CONSOMME et ce qui reste vendable ne
  // se lisent pas pareil, et c'est toute la question d'un no-show.
  const calendarLocale = currentLanguage === 'ar' ? ar : currentLanguage === 'en' ? enUS : fr;
  const splitAt = reservation.checkIn > today ? reservation.checkIn : today;
  const calendarRanges: CalendarRange[] = [];
  if (reservation.checkIn < splitAt) {
    calendarRanges.push({
      from: parseISO(reservation.checkIn),
      toExclusive: parseISO(splitAt),
      color: 'var(--bui-muted-foreground)',
    });
  }
  if (splitAt < reservation.checkOut) {
    calendarRanges.push({
      from: parseISO(splitAt),
      toExclusive: parseISO(reservation.checkOut),
      color: cancelled ? 'var(--bui-muted-foreground)' : 'var(--bui-warning)',
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
      <PropertyIdentity
        property={property}
        name={reservation.propertyName}
        extra={reservation.confirmationCode && (
          <PropertyLine icon={FACT_ICON.reservationReference}>
            <span className="tabular-nums">{reservation.confirmationCode}</span>
          </PropertyLine>
        )}
        trailing={reservation.source ? <ChannelTag channel={reservation.source} /> : undefined}
      />

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <GuestAvatar
          name={guestName}
          photoUrl={guestPhotoSrc(reservation.guestAvatarUrl)}
          size={36}
        />
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-sm font-medium text-foreground">{guestName}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5">
            <ContactLine icon={<Email />} value={reservation.guestEmail} href="mailto:" />
            <ContactLine icon={<Phone />} value={reservation.guestPhone} href="tel:" />
            {!reservation.guestEmail?.trim() && !reservation.guestPhone?.trim() && (
              <span className="inline-flex items-center gap-1.5 text-xs text-warning-ink">
                <span className="inline-flex shrink-0">{sizedIcon(<Person />, 13, 1.75)}</span>
                {t('notifications.detail.stay.noContact', 'Aucun moyen de le joindre')}
              </span>
            )}
          </div>
        </div>
        <Badge variant={STATUS_BADGE[reservation.status] ?? 'secondary'}>
          {t(`reservations.status.${reservation.status}`, reservation.status)}
        </Badge>
      </div>

      <div className="rounded-lg bg-card px-3.5 py-3">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="min-w-0">
            <Caption>{t('notifications.detail.metadata.checkIn', 'Arrivée')}</Caption>
            <p className="m-0 mt-1 text-sm font-medium tabular-nums text-foreground">
              {formatFactDate(reservation.checkIn, currentLanguage)}
              {reservation.checkInTime && (
                <span className="ms-1.5 font-normal text-muted-foreground">
                  {reservation.checkInTime}
                </span>
              )}
            </p>
          </div>
          <div className="min-w-0">
            <Caption>{t('notifications.detail.metadata.checkOut', 'Départ')}</Caption>
            <p className="m-0 mt-1 text-sm font-medium tabular-nums text-foreground">
              {formatFactDate(reservation.checkOut, currentLanguage)}
              {reservation.checkOutTime && (
                <span className="ms-1.5 font-normal text-muted-foreground">
                  {reservation.checkOutTime}
                </span>
              )}
            </p>
          </div>
          {remaining !== null && nights !== null && (
            <div className="ms-auto text-end">
              <Caption>{t('notifications.detail.stay.releasable', 'Encore revendable')}</Caption>
              <p
                className={cn(
                  'm-0 mt-1 text-sm font-semibold tabular-nums',
                  remaining > 0 ? 'text-warning-ink' : 'text-muted-foreground',
                )}
              >
                {t('notifications.detail.stay.remainingOfTotal', '{{count}} nuit sur {{total}}', {
                  count: remaining,
                  total: nights,
                })}
              </p>
            </div>
          )}
        </div>

        {nights !== null && remaining !== null && (
          <div
            className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-border"
            role="img"
            aria-label={t('notifications.detail.stay.remainingOfTotal', '{{count}} nuit sur {{total}}', {
              count: remaining,
              total: nights,
            })}
          >
            {/* La part consommee est FIXE, la part revendable prend le reste :
                sans `shrink-0` les deux segments se partageaient la barre
                lorsque plus rien n'etait a liberer. */}
            <span
              className="block shrink-0 bg-muted-foreground/50"
              style={{ width: `${consumedRatio * 100}%` }}
            />
            <span className="block flex-1 bg-warning" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        {typeof reservation.guestCount === 'number' && reservation.guestCount > 0 && (
          <div className="min-w-0">
            <Caption>{t('notifications.detail.stay.guests', 'Voyageurs')}</Caption>
            <p className="m-0 mt-1 text-sm font-medium tabular-nums text-foreground">
              {reservation.guestCount}
              {/* La ventilation quand elle est connue : un menage et une taxe de
                  sejour ne se calculent pas pareil avec des enfants. */}
              {typeof reservation.adultsCount === 'number' && (
                <span className="ms-1.5 text-xs font-normal text-muted-foreground">
                  {t('notifications.detail.stay.guestSplit', '{{adults}} ad. · {{children}} enf.', {
                    adults: reservation.adultsCount,
                    children: reservation.childrenCount ?? 0,
                  })}
                </span>
              )}
            </p>
          </div>
        )}

        {typeof reservation.totalPrice === 'number' && reservation.totalPrice > 0 && (
          <div className="ms-auto min-w-0 text-end">
            <Caption>{t('notifications.detail.stay.stayAmount', 'Montant du séjour')}</Caption>
            <p className="m-0 mt-1 text-sm font-semibold tabular-nums text-foreground">
              <Money value={reservation.totalPrice} />
            </p>
            {/* Qui a encaisse decide de ce qu'il reste a faire : rien quand le
                canal a deja pris l'argent, relancer sinon. */}
            <p className="m-0 mt-0.5 text-xs text-muted-foreground">
              {reservation.collectedByChannel
                ? t('notifications.detail.stay.collectedByChannel', 'Encaissé par le canal')
                : reservation.paymentStatus?.toUpperCase() === 'PAID'
                  ? t('notifications.detail.stay.paid', 'Réglé')
                  : t('notifications.detail.stay.unpaid', 'En attente de règlement')}
            </p>
          </div>
        )}
      </div>

      {reservation.notes?.trim() && (
        <div>
          <Caption>{t('notifications.detail.stay.notes', 'Notes')}</Caption>
          <p className="m-0 mt-1 text-sm leading-relaxed text-pretty whitespace-pre-line text-muted-foreground">
            {reservation.notes}
          </p>
        </div>
      )}

      {/* Le motif CLOT le dossier au lieu de flotter en dessous : la carte se lit
          alors de haut en bas — quel logement, qui, quand, combien, et pourquoi
          on en parle. Le texte vient de l'emetteur et n'est pas decoupe ici :
          decouper de la prose a l'ecran casserait a la premiere reformulation. */}
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

/**
 * Les deux gestes de recours, en pied de fiche, a cote du geste principal.
 *
 * <p>Ils repondent a la meme question par deux chemins : le voyageur est-il
 * injoignable, ou seulement silencieux ? « Relancer » parie sur le silence —
 * un message part, rien n'est perdu si le voyageur se presente. « Annuler la
 * reservation » tranche l'autre sens, et se paie d'une confirmation.</p>
 *
 * <p><b>Ne pas confondre avec le geste principal.</b> « Marquer no-show »
 * libere les nuits RESTANTES en gardant le sejour ; « Annuler la reservation »
 * libere TOUTE la fenetre et clot le sejour. Le modal de confirmation dit la
 * difference plutot que de la laisser deviner a deux libelles voisins.</p>
 */
export function NotificationStayActions({
  stay,
  onChanged,
}: {
  stay: NotificationStay;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { reservation } = stay;

  const [messageOpen, setMessageOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);

  const cancelled = reservation.status === 'cancelled';

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await reservationsApi.cancel(reservation.id);
      toast.success(t('notifications.detail.stay.cancelDone',
        'Réservation annulée — les nuits sont libérées.'));
      setConfirmOpen(false);
      onChanged();
    } catch (error) {
      // Le refus vient du serveur (acces au logement, sejour deja clos) : on le
      // montre tel quel plutot que de le traduire en « une erreur est survenue ».
      const message = (error as { message?: string })?.message;
      toast.error(message || t('notifications.detail.stay.cancelFailed', "L'annulation a échoué."));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setMessageOpen(true)}>
        <Send size={15} strokeWidth={1.75} />
        {t('notifications.detail.stay.remind', 'Relancer la fiche voyageur')}
      </Button>

      {!cancelled && (
        <Button
          variant="outline"
          onClick={() => setConfirmOpen(true)}
          className="hover:border-destructive hover:text-destructive"
        >
          <BlockOutlined size={15} strokeWidth={1.75} />
          {t('notifications.detail.stay.cancelStay', 'Annuler la réservation')}
        </Button>
      )}

      {/* Le modele d'arrivee porte deja le lien du livret ({guideLink}) : c'est
          par lui que le voyageur atteint le formulaire de check-in. On l'amorce
          plutot que de laisser retrouver « CHECK_IN » dans la liste. */}
      <SendMessageDialog
        open={messageOpen}
        reservationId={reservation.id}
        guestName={reservation.guestName}
        preferredTemplateType="CHECK_IN"
        onClose={() => setMessageOpen(false)}
        onSent={onChanged}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('notifications.detail.stay.cancelTitle', 'Annuler la réservation ?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('notifications.detail.stay.cancelIntro',
                'Le séjour de {{guest}} est clos et toute sa fenêtre repasse en vente.',
                { guest: reservation.guestName?.trim()
                  || t('notifications.detail.stay.unknownGuest', 'Voyageur inconnu') })}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm text-muted-foreground">
            {[
              t('notifications.detail.stay.cancelC1',
                "Rien n'est modifié côté paiement : remboursement et frais restent à traiter à part."),
              t('notifications.detail.stay.cancelC2',
                "La déclaration au canal d'origine reste à faire à la main."),
              t('notifications.detail.stay.cancelC3',
                'Pour ne libérer que les nuits restantes en gardant le séjour, préférez « Marquer no-show ».'),
            ].map((line) => (
              <li key={line} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
                <span className="min-w-0 text-pretty">{line}</span>
              </li>
            ))}
          </ul>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>
              {t('common.back', 'Retour')}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancelling}
              onClick={(event) => { event.preventDefault(); void handleCancel(); }}
            >
              {cancelling
                ? t('notifications.detail.stay.cancelling', 'Annulation…')
                : t('notifications.detail.stay.cancelConfirm', 'Annuler la réservation')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

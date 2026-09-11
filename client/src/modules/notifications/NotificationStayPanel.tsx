import React from 'react';
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
  LocationOn,
  Person,
  Phone,
  Send,
} from '../../icons';
import { sizedIcon } from '../../config/navigationIcons';
import { cn } from '../../utils/cn';
import { toApiMediaUrl } from '../../utils/mediaUrl';
import { useTranslation } from '../../hooks/useTranslation';
import { propertyGradientCss } from '../properties/propertiesListConstants';
import { guestPhotoSrc } from '../../services/api/guestsApi';
import { propertiesApi, type Property } from '../../services/api/propertiesApi';
import { reservationsApi, type Reservation } from '../../services/api/reservationsApi';
import { formatFactDate, FACT_ICON } from './notificationMeta';
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
 * <p>Comme pour les serrures, la liste est explicite : {@code reservationId}
 * designe « une reservation », pas « une reservation sur laquelle ces gestes-ci
 * ont un sens ». Un geste de facturation portant le meme fait ne doit pas se
 * voir proposer « Annuler la reservation ».</p>
 */
const STAY_ACTION_TYPES = new Set(['NOSHOW_MARK']);

/** Sejour designe par une notification, ou `null`. */
export function reservationIdOf(notification: Notification): number | null {
  const actionType = notification.metadata?.actionType;
  if (typeof actionType !== 'string' || !STAY_ACTION_TYPES.has(actionType)) return null;

  const raw = notification.metadata?.reservationId;
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
  return null;
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

/**
 * Vignette du logement : sa photo, ou a defaut le degrade reproductible qui lui
 * sert deja d'identite dans la liste des logements. Jamais un carre vide — une
 * vignette absente se lit comme une image cassee.
 */
function PropertyThumb({ property, name }: { property: Property | null; name: string }) {
  const [failed, setFailed] = React.useState(false);
  const src = toApiMediaUrl(property?.coverPhotoUrl ?? property?.photoUrls?.[0]);

  return (
    <span
      className="relative block h-[66px] w-[88px] shrink-0 overflow-hidden rounded-lg border border-border"
      style={{ background: propertyGradientCss(String(property?.id ?? name)) }}
    >
      {src && !failed && (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
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
  const place = [property?.city, property?.postalCode].filter(Boolean).join(' ');

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
      <header className="flex items-start gap-3">
        <PropertyThumb property={property} name={reservation.propertyName} />

        <div className="min-w-0 flex-1 self-center">
          <p className="m-0 truncate text-sm font-semibold text-foreground">
            {reservation.propertyName}
          </p>
          {place && (
            <p className="m-0 mt-1 inline-flex min-w-0 max-w-full items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-flex shrink-0">{sizedIcon(<LocationOn />, 13, 1.75)}</span>
              <span className="truncate">{place}</span>
            </p>
          )}
          {reservation.confirmationCode && (
            <p className="m-0 mt-1 inline-flex min-w-0 max-w-full items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
              <span className="inline-flex shrink-0">
                {sizedIcon(FACT_ICON.reservationReference, 13, 1.75)}
              </span>
              <span className="truncate">{reservation.confirmationCode}</span>
            </p>
          )}
        </div>

        {reservation.source && <ChannelTag channel={reservation.source} />}
      </header>

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
        {cancelled && (
          <Badge variant="destructive">
            {t('notifications.detail.stay.cancelled', 'Annulée')}
          </Badge>
        )}
      </div>

      <div className="rounded-lg bg-card px-3.5 py-3">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="min-w-0">
            <Caption>{t('notifications.detail.metadata.checkIn', 'Arrivée')}</Caption>
            <p className="m-0 mt-1 text-sm font-medium tabular-nums text-foreground">
              {formatFactDate(reservation.checkIn, currentLanguage)}
            </p>
          </div>
          <div className="min-w-0">
            <Caption>{t('notifications.detail.metadata.checkOut', 'Départ')}</Caption>
            <p className="m-0 mt-1 text-sm font-medium tabular-nums text-foreground">
              {formatFactDate(reservation.checkOut, currentLanguage)}
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

      {typeof reservation.totalPrice === 'number' && reservation.totalPrice > 0 && (
        <div className="flex items-baseline justify-between gap-4">
          <Caption>{t('notifications.detail.stay.stayAmount', 'Montant du séjour')}</Caption>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            <Money value={reservation.totalPrice} />
          </span>
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

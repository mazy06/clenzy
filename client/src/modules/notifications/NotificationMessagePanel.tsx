import React from 'react';
import { Badge, Button, Skeleton } from '../../components/ui';
import GuestAvatar from '../../components/baitly/GuestAvatar';
import { Email, Person, Phone, Send, Warning, WhatsApp } from '../../icons';
import { Caption } from './NotificationFieldParts';
import { formatFactDate } from './notificationMeta';
import { guestPhotoSrc } from '../../services/api/guestsApi';
import {
  guestMessagingApi,
  type GuestMessageLog,
} from '../../services/api/guestMessagingApi';
import { renderServerEmailPreview } from '../../utils/emailMarkdown';
import { useThemeMode } from '../../hooks/useThemeMode';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../contexts/AuthContext';
import type { Notification } from '../../services/api';

/**
 * Le MESSAGE envoye a un voyageur — l'objet de l'evenement, pas le sejour.
 *
 * <p>Ces notifications ouvraient jusqu'ici le dossier du sejour : photo du
 * logement, calendrier des nuits, montant, « Ouvrir Reservations ». Or la
 * question posee par « Message envoye au voyageur » n'est pas « ce sejour va-t-il
 * bien ? » mais « QU'a-t-on ecrit, A QUELLE adresse, et est-ce parti ? ». Le
 * sejour n'est ici qu'un repere — une ligne, pas un dossier.</p>
 *
 * <p><b>Le contenu est relu, pas recopie.</b> La notification ne transporte que
 * le NOM du modele ; le texte reellement compose vit dans le journal d'envoi.
 * Le panneau va donc le chercher et le montre dans un cadre isole
 * ({@code sandbox=""}) — meme mecanique que l'historique des messages, ou ce
 * HTML est deja rendu.</p>
 *
 * <p>Rien de tout cela n'est indispensable : sans journal retrouve, le panneau
 * se rabat sur ce que les faits portent — destinataire, modele, canal, motif
 * d'echec. C'est le cas des evenements emis avant que le sejour ne rejoigne les
 * metadonnees.</p>
 */

const MESSAGE_KEYS = new Set(['GUEST_MESSAGE_SENT', 'GUEST_MESSAGE_FAILED']);

/** Ce qu'une notification de messagerie designe, ou `null`. */
export interface GuestMessageSubject {
  /** Sejour concerne — sans lui, le journal d'envoi reste introuvable. */
  reservationId: number | null;
  /** Nom du modele employe, tel qu'ecrit a l'emission. */
  template: string | null;
  /** `EMAIL`, `WHATSAPP`… tel qu'ecrit a l'emission. */
  channel: string | null;
  guestName: string | null;
  guestAvatarUrl: string | null;
  /** Motif d'echec, present uniquement quand l'envoi a echoue. */
  error: string | null;
  failed: boolean;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function guestMessageOf(notification: Notification): GuestMessageSubject | null {
  if (!notification.notificationKey || !MESSAGE_KEYS.has(notification.notificationKey)) return null;

  const facts = notification.metadata ?? {};
  const reservationId = typeof facts.reservationId === 'number' ? facts.reservationId : null;
  return {
    reservationId,
    template: text(facts.template),
    channel: text(facts.channel),
    guestName: text(facts.guest),
    guestAvatarUrl: text(facts.guestAvatarUrl),
    error: text(facts.error),
    failed: notification.notificationKey === 'GUEST_MESSAGE_FAILED',
  };
}

/**
 * Le journal de CET envoi, puis son contenu.
 *
 * <p>L'envoi est retrouve dans l'historique du sejour : meme canal, meme modele,
 * et l'horodatage le plus proche de la notification. Deux messages identiques
 * partis a quelques minutes d'intervalle porteraient le meme texte — l'ambiguite
 * ne change alors rien a ce qui s'affiche.</p>
 */
export function useNotificationMessage(subject: GuestMessageSubject | null, at: string) {
  const [log, setLog] = React.useState<GuestMessageLog | null>(null);
  const [body, setBody] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(subject?.reservationId != null);

  const reservationId = subject?.reservationId ?? null;
  const channel = subject?.channel ?? null;
  const template = subject?.template ?? null;

  React.useEffect(() => {
    if (reservationId === null) {
      setLog(null);
      setBody(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    guestMessagingApi
      .getReservationHistory(reservationId)
      .then((history) => {
        if (!active) return null;
        const found = closestTo(history, { channel, template, at });
        setLog(found);
        // L'apercu n'existe que pour un envoi adosse a un modele.
        return found && found.templateId ? guestMessagingApi.previewMessage(found.id) : null;
      })
      .then((preview) => { if (active && preview) setBody(preview.htmlBody); })
      .catch(() => { if (active) { setLog(null); setBody(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reservationId, channel, template, at]);

  return { log, body, loading };
}

/** L'envoi du bon canal et du bon modele, le plus proche de l'evenement. */
function closestTo(
  history: GuestMessageLog[],
  { channel, template, at }: { channel: string | null; template: string | null; at: string },
): GuestMessageLog | null {
  const moment = Date.parse(at);
  const candidates = history.filter((entry) =>
    (channel === null || entry.channel === channel)
    && (template === null || entry.templateName === template));
  if (candidates.length === 0) return null;

  return candidates.reduce((best, entry) => {
    const distance = Math.abs(Date.parse(entry.sentAt ?? entry.createdAt) - moment);
    const bestDistance = Math.abs(Date.parse(best.sentAt ?? best.createdAt) - moment);
    return Number.isNaN(distance) || distance >= bestDistance ? best : entry;
  });
}

/** Attente : la forme du panneau, pas un tourniquet centre. */
export function NotificationMessageSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <Skeleton className="h-[140px] w-full rounded-lg" />
    </div>
  );
}

/** Canal d'envoi : son icone et son nom, jamais son code brut. */
function ChannelMark({ channel }: { channel: string | null }) {
  const { t } = useTranslation();
  const known: Record<string, { icon: React.ReactNode; label: string }> = {
    EMAIL: { icon: <Email size={14} strokeWidth={1.75} />, label: t('notifications.detail.message.email', 'E-mail') },
    WHATSAPP: { icon: <WhatsApp size={14} />, label: 'WhatsApp' },
    SMS: { icon: <Phone size={14} strokeWidth={1.75} />, label: 'SMS' },
  };
  const mark = channel ? known[channel.toUpperCase()] : undefined;
  if (!mark) return channel ? <>{channel}</> : null;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex shrink-0 text-muted-foreground">{mark.icon}</span>
      {mark.label}
    </span>
  );
}

/**
 * Ce qui est parti, a qui, et ce qu'il en est advenu.
 *
 * <p>Ordre de lecture : le destinataire et l'etat de l'envoi d'abord — c'est ce
 * qui decide s'il y a un geste a faire —, puis l'objet du message, puis son
 * texte. Le sejour ferme la fiche en une ligne : il situe, il n'occupe pas.</p>
 */
export default function NotificationMessagePanel({
  subject,
  log,
  body,
  at,
  stayLine,
  onResent,
}: {
  subject: GuestMessageSubject;
  log: GuestMessageLog | null;
  /** Corps du message tel que compose, ou `null` s'il n'a pas pu etre relu. */
  body: string | null;
  /** Instant de l'evenement. */
  at: string;
  /** Repere de sejour : logement · reference · dates, deja mis en forme. */
  stayLine?: string | null;
  onResent?: () => void;
}) {
  const { t, currentLanguage } = useTranslation();
  const { isDark } = useThemeMode();
  const { isPlatformStaff } = useAuth();
  const [resending, setResending] = React.useState(false);
  const [resendError, setResendError] = React.useState<string | null>(null);
  const [resent, setResent] = React.useState(false);

  const failed = subject.failed || log?.status === 'FAILED';
  const recipient = log?.recipient ?? null;
  const guestName = subject.guestName ?? log?.guestName ?? null;
  const templateName = subject.template ?? log?.templateName ?? null;
  // L'objet REELLEMENT envoye quand on a pu le relire ; le modele sinon.
  const heading = log?.subject?.trim() || templateName;
  const reason = subject.error ?? log?.errorMessage ?? null;

  const resend = async () => {
    if (!log) return;
    setResending(true);
    setResendError(null);
    try {
      await guestMessagingApi.resendMessage(log.id);
      setResent(true);
      onResent?.();
    } catch (error) {
      setResendError(error instanceof Error
        ? error.message
        : t('notifications.detail.message.resendFailed', "Le renvoi n'a pas abouti."));
    } finally {
      setResending(false);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
      {/* ── A qui, et est-ce parti ─────────────────────────────────────────── */}
      <header className="flex items-start gap-3">
        <GuestAvatar
          name={guestName ?? '?'}
          photoUrl={guestPhotoSrc(subject.guestAvatarUrl)}
          size={36}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <p className="m-0 flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
            {guestName ?? (
              <>
                <span className="inline-flex shrink-0 text-muted-foreground">
                  <Person size={14} strokeWidth={1.75} />
                </span>
                {t('notifications.detail.message.unknownGuest', 'Destinataire inconnu')}
              </>
            )}
          </p>
          {/* L'ADRESSE reellement employee : c'est elle qu'on corrige apres un
              echec, et elle seule distingue deux envois au meme voyageur. */}
          <p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">
            {recipient ?? t('notifications.detail.message.recipientUnknown',
              "L'adresse employée n'a pas pu être relue.")}
          </p>
        </div>
        <Badge variant={failed ? 'destructive' : 'success'} className="mt-0.5 shrink-0">
          {failed
            ? t('notifications.detail.message.failed', 'Échec')
            : t('notifications.detail.message.sent', 'Envoyé')}
        </Badge>
      </header>

      {/* ── Ce qui est parti ───────────────────────────────────────────────── */}
      <div className="rounded-lg bg-card px-3.5 py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <ChannelMark channel={subject.channel} />
          {templateName && (
            <>
              <span aria-hidden="true">·</span>
              <span>{t('notifications.detail.message.template', 'Modèle')} « {templateName} »</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <time dateTime={log?.sentAt ?? at} className="tabular-nums">
            {formatFactDate((log?.sentAt ?? at).slice(0, 10), currentLanguage)}
          </time>
        </div>

        {heading && (
          <p className="m-0 mt-1.5 text-sm leading-snug font-medium text-pretty text-foreground">
            {heading}
          </p>
        )}

        {body ? (
          /* Cadre isole : ce HTML vient d'un modele redige dans l'application,
             il ne s'execute pas dans la page qui l'affiche. */
          <iframe
            sandbox=""
            title={t('notifications.detail.message.preview', 'Contenu du message')}
            className="mt-3 h-56 w-full rounded-md border border-border"
            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:1.6;color:${isDark ? '#e0e0e0' : '#333'};background:${isDark ? '#1e1e1e' : '#fff'};padding:14px;margin:0;word-wrap:break-word;}a{color:${isDark ? '#90caf9' : '#1976d2'};}</style></head><body>${renderServerEmailPreview(body)}</body></html>`}
          />
        ) : (
          <p className="m-0 mt-2 text-xs text-muted-foreground">
            {t('notifications.detail.message.bodyUnavailable',
              "Le texte de ce message n'est plus relisible.")}
          </p>
        )}
      </div>

      {/* ── Pourquoi ca n'est pas parti, et le geste qui reste ─────────────── */}
      {failed && (
        <div className="flex flex-col gap-2.5 rounded-lg bg-destructive-soft px-3.5 py-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex shrink-0 text-destructive-ink">
              <Warning size={15} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <Caption>{t('notifications.detail.message.reason', 'Motif du refus')}</Caption>
              <p className="m-0 mt-1 text-sm leading-relaxed text-pretty text-destructive-ink">
                {reason ?? t('notifications.detail.message.reasonUnknown',
                  "Le fournisseur n'a pas donné de motif.")}
              </p>
            </div>
          </div>

          {/* Le renvoi est reserve au staff plateforme : c'est le seul profil que
              l'endpoint accepte aujourd'hui. */}
          {log && isPlatformStaff() && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="xs" variant="outline" onClick={() => void resend()} disabled={resending || resent}>
                <Send size={14} strokeWidth={1.75} />
                {resent
                  ? t('notifications.detail.message.resentDone', 'Renvoyé')
                  : t('notifications.detail.message.resend', 'Renvoyer le message')}
              </Button>
              {resendError && (
                <span className="text-xs text-destructive-ink">{resendError}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Ou cela se passe : un repere, pas un dossier ───────────────────── */}
      {stayLine && (
        <p className="m-0 border-t border-border pt-3 text-xs text-muted-foreground">
          {stayLine}
        </p>
      )}
    </section>
  );
}

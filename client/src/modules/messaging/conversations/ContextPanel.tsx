import React from 'react';
import { Badge, Button } from '../../../components/ui';
import { Packshot } from '../../../components/baitly/FirstUseStage';
import { STAGE_IMAGES } from '../../../components/baitly/stageImages';
import { ArrowRight, Link, MapPin, MessageSquare, Moon, User, X } from '../../../icons/glyphs';
import { useTranslation } from '../../../hooks/useTranslation';
import { activeIntlLocale } from '../../../utils/activeLocale';
import type { ConversationAnalysis, ConversationDto } from '../../../services/api/conversationApi';
import { SentimentGauge } from './AiCopilot';
import ChannelMark, { channelLabel } from './ChannelMark';
import ConversationAvatar from './ConversationAvatar';
import type { StayInfo } from './messagingModel';

interface ContextPanelProps {
  conv: ConversationDto;
  stay: StayInfo | null;
  analysis?: ConversationAnalysis | null;
  onOpenGuest?: () => void;
  onViewReservation?: () => void;
  onAttach?: () => void;
  /** Ferme le panneau quand il s'affiche en tiroir (largeur intermédiaire). */
  onClose?: () => void;
}

function shortDate(date: Date): string {
  return date.toLocaleDateString(activeIntlLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-b border-border px-4 py-4 last:border-b-0">
      <h3 className="m-0 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 min-w-0 truncate font-medium text-foreground tabular-nums">{children}</dd>
    </div>
  );
}

/**
 * Panneau de contexte d'une conversation voyageur : qui écrit, quel séjour,
 * ce que l'IA a lu dans le dernier message. Il évite d'ouvrir la fiche ou la
 * réservation juste pour répondre à « à quelle heure est l'arrivée ? ».
 *
 * <p>Tout vient des données déjà portées par la conversation : aucune requête
 * de plus, et aucun statut inventé quand une information manque.</p>
 */
export default function ContextPanel({ conv, stay, analysis, onOpenGuest, onViewReservation, onAttach, onClose }: ContextPanelProps) {
  const { t } = useTranslation();
  const name = conv.guestName || channelLabel(conv.channel);

  return (
    <aside
      aria-label={t('messagingHub.context.title', 'Contexte')}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-border bg-card"
    >
      <div className="flex items-start gap-3 border-b border-border px-4 py-4">
        <ConversationAvatar name={name} channel={conv.channel} size={44} />
        <div className="min-w-0 flex-1">
          <p dir="auto" className="m-0 truncate text-sm font-semibold text-foreground">{name}</p>
          <p className="m-0 mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <ChannelMark channel={conv.channel} size={14} />
            {channelLabel(conv.channel)}
          </p>
          {conv.guestId != null && onOpenGuest && (
            <Button type="button" size="xs" variant="outline" className="mt-2 cursor-pointer" onClick={onOpenGuest}>
              <User className="size-3.5" aria-hidden />
              {t('messagingHub.guestProfile', 'Fiche voyageur')}
            </Button>
          )}
        </div>
        {onClose && (
          <Button type="button" size="icon-xs" variant="ghost" className="cursor-pointer" onClick={onClose} aria-label={t('common.close', 'Fermer')}>
            <X className="size-3.5" aria-hidden />
          </Button>
        )}
      </div>

      <Section title={t('messagingHub.context.stay', 'Séjour')}>
        {stay ? (
          <div className="flex flex-col gap-3 rounded-xl bg-muted/50 p-3">
            <div className="flex items-start gap-3">
              <Packshot src={STAGE_IMAGES.bookings} size="sm" bare />
              <div className="min-w-0 flex-1">
                {conv.propertyName && (
                  <p dir="auto" className="m-0 flex items-center gap-1 truncate text-sm font-medium text-foreground">
                    <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{conv.propertyName}</span>
                  </p>
                )}
                <Badge
                  className="mt-1"
                  variant={stay.key === 'current' ? 'success' : stay.key === 'upcoming' ? 'info' : 'secondary'}
                >
                  {stay.key === 'current'
                    ? t('messagingHub.stayCurrent', 'Séjour en cours')
                    : stay.key === 'upcoming'
                      ? t('messagingHub.stayUpcoming', 'À venir')
                      : t('messagingHub.stayPast', 'Séjour terminé')}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-2xs text-muted-foreground">{t('messagingHub.context.arrival', 'Arrivée')}</p>
                <p className="m-0 font-medium text-foreground tabular-nums">{shortDate(stay.arrival)}</p>
              </div>
              <ArrowRight className="size-3.5 shrink-0 text-faint rtl:rotate-180" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="m-0 text-2xs text-muted-foreground">{t('messagingHub.context.departure', 'Départ')}</p>
                <p className="m-0 font-medium text-foreground tabular-nums">{stay.departure ? shortDate(stay.departure) : '—'}</p>
              </div>
              {stay.nights != null && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-2 py-1 text-2xs font-medium text-foreground tabular-nums">
                  <Moon className="size-3" aria-hidden />
                  {stay.nights}
                </span>
              )}
            </div>

            {onViewReservation && (
              <Button type="button" size="xs" variant="outline" className="cursor-pointer self-start" onClick={onViewReservation}>
                {t('messagingHub.viewReservation', 'Voir la réservation')}
              </Button>
            )}
          </div>
        ) : conv.reservationId ? (
          <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            {conv.propertyName && <span className="font-medium text-foreground">{conv.propertyName}</span>}
            {onViewReservation && (
              <Button type="button" size="xs" variant="outline" className="cursor-pointer self-start" onClick={onViewReservation}>
                {t('messagingHub.viewReservation', 'Voir la réservation')}
              </Button>
            )}
          </div>
        ) : (
          // Une conversation non rattachée n'a pas de séjour : on le dit, et on
          // propose le seul geste utile.
          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3">
            <p className="m-0 text-xs text-muted-foreground">
              {t('messagingHub.context.unattached', 'Cette conversation n’est rattachée à aucune réservation.')}
            </p>
            {onAttach && (
              <Button type="button" size="xs" variant="outline" className="cursor-pointer self-start" onClick={onAttach}>
                <Link className="size-3.5" aria-hidden />
                {t('messagingHub.attachReservation', 'Rattacher à une réservation')}
              </Button>
            )}
          </div>
        )}
      </Section>

      {analysis && (
        <Section title={t('messagingHub.context.analysis', 'Lecture de l’IA')}>
          <SentimentGauge analysis={analysis} />
        </Section>
      )}

      <Section title={t('messagingHub.context.conversation', 'Conversation')}>
        <dl className="m-0 flex flex-col gap-2">
          <Fact label={t('messagingHub.context.messages', 'Messages')}>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3" aria-hidden />
              {conv.messageCount}
            </span>
          </Fact>
          <Fact label={t('messagingHub.context.openedOn', 'Ouverte le')}>
            {new Date(conv.createdAt).toLocaleDateString(activeIntlLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}
          </Fact>
        </dl>
      </Section>
    </aside>
  );
}

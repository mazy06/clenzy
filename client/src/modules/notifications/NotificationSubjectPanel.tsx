import React from 'react';
import { Badge } from '../../components/ui';
import GuestAvatar from '../../components/baitly/GuestAvatar';
import { guestPhotoSrc } from '../../services/api/guestsApi';
import ChannelTag from '../../components/baitly/ChannelTag';
import { Money } from '../../components/baitly/Money';
import NoiseGauge from '../../components/baitly/NoiseGauge';
import { Build, Description, Schedule } from '../../icons';
import { sizedIcon } from '../../config/navigationIcons';
import { useTranslation } from '../../hooks/useTranslation';
import { formatFactDate, type NotificationFact } from './notificationMeta';
import type { Notification } from '../../services/api';

/**
 * Le SUJET d'une notification, quand il a une forme.
 *
 * <p>Le relevé « intitulé à gauche, valeur à droite » sait tout dire, et c'est
 * sa limite : un séjour y devient trois lignes qu'il faut recoller, un montant
 * une valeur parmi d'autres, une mission un titre sans échéance lisible. Ces
 * panneaux prennent les faits que le relevé rendrait plats et leur donnent la
 * forme de l'objet — un voyageur a un visage, un séjour deux bornes et une
 * durée, une échéance une urgence.</p>
 *
 * <p>Chaque panneau déclare les faits qu'il CONSOMME : le relevé n'affiche que
 * le reste, sinon la fiche dirait deux fois la même chose.</p>
 *
 * <p>Rien ici ne va chercher de données. Les panneaux qui, eux, chargent leur
 * objet (l'avis, la serrure) vivent à côté — leur asynchronisme n'a pas à
 * contaminer un rendu qui se déduit des seuls faits reçus.</p>
 */
export type NotificationSubjectKind = 'noise' | 'task' | 'stay' | 'money';

export interface NotificationSubject {
  /** Panneau retenu. Nommé plutôt que deviné : c'est ce que les tests lisent. */
  kind: NotificationSubjectKind;
  node: React.ReactNode;
  /** Clés de faits déjà dites par le panneau, à retirer du relevé. */
  consumed: string[];
}

function byKey(facts: NotificationFact[]) {
  return new Map(facts.map((fact) => [fact.key, fact]));
}

/**
 * Photo du voyageur, quand l'evenement en designe un.
 *
 * <p>Elle ne passe PAS par le releve de faits : ce n'est pas une ligne a
 * afficher, c'est un attribut du voyageur — et son URL est signee a la lecture
 * par le serveur, pas ecrite a l'emission (un ticket ne vaut qu'un quart
 * d'heure). Absente, l'avatar retombe sur les initiales, ce qui reste le cas
 * courant.</p>
 */
function guestAvatarOf(notification: Notification): string | undefined {
  const raw = notification.metadata?.guestAvatarUrl;
  return typeof raw === 'string' ? guestPhotoSrc(raw) : undefined;
}

/** Intitulé de champ à l'intérieur d'un panneau. */
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

/**
 * Jours entiers d'ici à une date ISO, dans le calendrier du LECTEUR.
 *
 * <p>Approximation assumée : l'échéance d'une mission est fixée dans le fuseau
 * du logement, que la notification ne transporte pas. L'écart ne dépasse jamais
 * un jour, et la date absolue reste affichée à côté — c'est l'urgence qui est
 * indicative, pas l'échéance.</p>
 */
function daysUntil(iso: string): number | null {
  const target = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Enveloppe commune : une surface, jamais une carte dans une carte. */
function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl bg-muted px-4 py-4 ${className ?? ''}`}>{children}</section>;
}

/**
 * Séjour : qui vient, d'où, quand, pour combien de nuits, pour quel montant.
 *
 * <p>Les deux bornes se lisent côte à côte avec la durée au bout — « du 12 au
 * 15 septembre, 3 nuits » est une seule information, pas trois. Pas de flèche
 * entre les dates : elle pointerait du mauvais côté en arabe.</p>
 */
function StayPanel({
  facts,
  notification,
}: {
  facts: Map<string, NotificationFact>;
  notification: Notification;
}) {
  const { t, currentLanguage } = useTranslation();
  const guest = facts.get('guest');
  const stay = facts.get('stay');
  const reference = facts.get('reservationReference');
  const channel = facts.get('channel');
  const amount = facts.get('amount');

  const guestName = guest?.kind === 'text' ? guest.value : null;
  const nights = stay?.kind === 'stay' ? nightsBetween(stay.from, stay.to) : null;

  return (
    <Panel className="flex flex-col gap-3">
      <header className="flex items-start gap-3">
        {guestName && (
          <GuestAvatar
            name={guestName}
            photoUrl={guestAvatarOf(notification)}
            size={36}
            className="mt-0.5"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-sm font-medium text-foreground">
            {guestName ?? t('notifications.detail.subjectPanel.stay', 'Séjour')}
          </p>
          {reference?.kind === 'text' && (
            <p className="m-0 mt-0.5 truncate text-xs tabular-nums text-muted-foreground">
              {reference.value}
            </p>
          )}
        </div>
        {channel?.kind === 'text' && <ChannelTag channel={channel.value} />}
      </header>

      {stay?.kind === 'stay' && (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-lg bg-card px-3.5 py-3">
          <div className="min-w-0">
            <Caption>{t('notifications.detail.metadata.checkIn', 'Arrivée')}</Caption>
            <p className="m-0 mt-1 text-sm font-medium tabular-nums text-foreground">
              {formatFactDate(stay.from, currentLanguage)}
            </p>
          </div>
          <div className="min-w-0">
            <Caption>{t('notifications.detail.metadata.checkOut', 'Départ')}</Caption>
            <p className="m-0 mt-1 text-sm font-medium tabular-nums text-foreground">
              {formatFactDate(stay.to, currentLanguage)}
            </p>
          </div>
          {nights !== null && (
            <span className="ms-auto text-xs tabular-nums text-muted-foreground">
              {t('notifications.detail.subjectPanel.nights', '{{count}} nuit', { count: nights })}
            </span>
          )}
        </div>
      )}

      {amount?.kind === 'money' && (
        <div className="flex items-baseline justify-between gap-4">
          <Caption>{t('notifications.detail.metadata.amount', 'Montant')}</Caption>
          <span className="text-lg font-semibold tabular-nums text-foreground">
            <Money value={amount.value} from={amount.currency} />
          </span>
        </div>
      )}
    </Panel>
  );
}

/**
 * Bruit : le niveau mesuré, situé par rapport au seuil qu'il franchit.
 *
 * <p>« Niveau sonore de 78 dB détecté (seuil : 55 dB) » demandait de faire la
 * soustraction. La jauge la fait.</p>
 */
function NoisePanel({
  facts,
  notification,
}: {
  facts: Map<string, NotificationFact>;
  notification: Notification;
}) {
  const { t } = useTranslation();
  const measured = facts.get('noiseDb');
  const threshold = facts.get('noiseThresholdDb');
  if (measured?.kind !== 'decibels' || threshold?.kind !== 'decibels') return null;

  return (
    <Panel className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Caption>{t('notifications.detail.subjectPanel.noiseLevel', 'Niveau sonore')}</Caption>
        <span className="text-xs tabular-nums text-muted-foreground">
          {t('notifications.detail.subjectPanel.noiseThreshold', 'Seuil {{db}} dB', {
            db: Math.round(threshold.value),
          })}
        </span>
      </div>
      <NoiseGauge
        measuredDb={measured.value}
        thresholdDb={Math.round(threshold.value)}
        critical={notification.type === 'error'}
      />
    </Panel>
  );
}

/** Encre du montant selon la nature de l'événement. Un échec ne se dit pas en noir. */
const AMOUNT_INK: Partial<Record<Notification['type'], string>> = {
  success: 'var(--bui-success-ink)',
  error: 'var(--bui-destructive-ink)',
};

/**
 * Montant seul — un règlement, un versement, un remboursement.
 *
 * <p>Le montant est le sujet, pas une ligne du relevé : il passe en tête,
 * dans l'encre de l'événement.</p>
 */
function MoneyPanel({
  facts,
  notification,
}: {
  facts: Map<string, NotificationFact>;
  notification: Notification;
}) {
  const { t } = useTranslation();
  const amount = facts.get('amount');
  if (amount?.kind !== 'money') return null;

  return (
    <Panel className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <Caption>{t('notifications.detail.metadata.amount', 'Montant')}</Caption>
      <span
        className="text-2xl leading-none font-semibold tabular-nums"
        style={{ color: AMOUNT_INK[notification.type] ?? 'var(--bui-foreground)' }}
      >
        <Money value={amount.value} from={amount.currency} symbolSize={16} />
      </span>
    </Panel>
  );
}

/**
 * Mission : intervention terrain ou demande de service.
 *
 * <p>L'échéance porte son urgence — « en retard », « aujourd'hui », « dans 2 j » —
 * parce que c'est elle qui décide de l'ordre dans lequel on traite la file. La
 * date absolue reste à côté : l'urgence est un raccourci, pas la donnée.</p>
 */
function TaskPanel({ facts }: { facts: Map<string, NotificationFact> }) {
  const { t, currentLanguage } = useTranslation();
  const intervention = facts.get('intervention');
  const request = facts.get('request');
  const assignee = facts.get('assignee');
  const due = facts.get('dueDate');

  const isIntervention = intervention?.kind === 'text';
  const title = isIntervention
    ? intervention.value
    : request?.kind === 'text'
      ? request.value
      : null;
  if (!title) return null;

  const assigneeName = assignee?.kind === 'text' ? assignee.value : null;
  const dueIso = due?.kind === 'date' ? due.value : null;
  const remaining = dueIso ? daysUntil(dueIso) : null;

  const urgency = remaining === null
    ? null
    : remaining < 0
      ? { variant: 'destructive' as const, label: t('notifications.detail.subjectPanel.overdue', 'En retard') }
      : remaining === 0
        ? { variant: 'warning' as const, label: t('notifications.detail.subjectPanel.dueToday', "Aujourd'hui") }
        : remaining <= 2
          ? { variant: 'warning' as const, label: t('notifications.detail.subjectPanel.dueInDays', 'Dans {{count}} j', { count: remaining }) }
          : null;

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground">
          {sizedIcon(isIntervention ? <Build /> : <Description />, 17, 1.75)}
        </span>
        <div className="min-w-0 flex-1">
          <Caption>
            {isIntervention
              ? t('notifications.detail.metadata.intervention', 'Intervention')
              : t('notifications.detail.metadata.request', 'Demande')}
          </Caption>
          <p className="m-0 mt-1 text-sm font-medium text-pretty text-foreground">{title}</p>
        </div>
      </div>

      {(assigneeName || dueIso) && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {assigneeName && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <GuestAvatar name={assigneeName} size={20} />
              <span className="truncate text-foreground">{assigneeName}</span>
            </span>
          )}
          {dueIso && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex shrink-0">{sizedIcon(<Schedule />, 14, 1.75)}</span>
              <span className="tabular-nums">{formatFactDate(dueIso, currentLanguage)}</span>
              {urgency && <Badge variant={urgency.variant}>{urgency.label}</Badge>}
            </span>
          )}
        </div>
      )}
    </Panel>
  );
}

/**
 * Panneau adapté au sujet de la notification, ou `null` quand le relevé suffit.
 *
 * <p>L'ordre des essais est celui de la SPÉCIFICITÉ, pas de la richesse : une
 * mission payée est d'abord une mission, un séjour facturé d'abord un séjour.
 * Le montant ne prend la tête que lorsqu'il est seul — un versement, un
 * remboursement, un règlement sans autre objet.</p>
 */
export function resolveSubject(
  facts: NotificationFact[],
  notification: Notification,
): NotificationSubject | null {
  const map = byKey(facts);

  if (map.has('noiseDb') && map.has('noiseThresholdDb')) {
    return {
      kind: 'noise',
      node: <NoisePanel facts={map} notification={notification} />,
      consumed: ['noiseDb', 'noiseThresholdDb'],
    };
  }

  if (map.has('intervention') || map.has('request')) {
    return {
      kind: 'task',
      node: <TaskPanel facts={map} />,
      // `amount` reste au relevé : selon l'émetteur il vaut un coût estimé ou
      // une somme réglée, et le panneau ne saurait pas lequel il nomme.
      consumed: ['intervention', 'request', 'assignee', 'dueDate'],
    };
  }

  if (map.has('guest') && (map.has('stay') || map.has('reservationReference'))) {
    return {
      kind: 'stay',
      node: <StayPanel facts={map} notification={notification} />,
      consumed: ['guest', 'stay', 'reservationReference', 'channel', 'amount'],
    };
  }

  if (map.has('amount')) {
    return {
      kind: 'money',
      node: <MoneyPanel facts={map} notification={notification} />,
      consumed: ['amount'],
    };
  }

  return null;
}

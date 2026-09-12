import React from 'react';
import { Badge, Progress, Skeleton } from '../../components/ui';
import GuestAvatar from '../../components/baitly/GuestAvatar';
import { Money } from '../../components/baitly/Money';
import { useTranslation } from '../../hooks/useTranslation';
import { resolveMediaUrl } from '../../config/api';
import { getInterventionTypeLabel } from '../../utils/statusUtils';
import { interventionsApi } from '../../services/api/interventionsApi';
import type { InterventionDetailsData } from '../interventions/interventionUtils';
import { PropertyIdentity, useNotificationProperty } from './NotificationPropertyPanel';
import {
  AccessBlock,
  Caption,
  Figure,
  ObservationBand,
  PhotoStrip,
  PriorityBanner,
  formatDuration,
  photoList,
  priorityTone,
} from './NotificationFieldParts';
import { deepLinkId, factId, formatFactDate } from './notificationMeta';
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

/**
 * Intervention designee par une notification, ou `null`.
 *
 * <p>Le fait d'abord ; a defaut, la fiche visee par le lien profond
 * ({@code /interventions/97}), que ces notifications portent depuis toujours.
 * Sans ce repli, aucune des fiches emises avant les faits structures ne
 * s'ouvrirait — et rien ne les fera renotifier.</p>
 */
export function interventionIdOf(notification: Notification): number | null {
  // Une rotation de code NOMME desormais la mission qui va s'en servir, mais son
  // sujet reste le CODE : c'est le panneau du code d'acces qui la montre, en une
  // ligne. Ouvrir ici le dossier complet dirait la meme mission deux fois.
  if (notification.notificationKey === 'ACCESS_CODE_ROTATED') return null;

  const fact = factId(notification, 'interventionId');
  if (fact !== null) return fact;

  // Le repli ne vaut que pour les cles dont le lien profond ouvre une fiche
  // d'intervention. Les anciennes confirmations de paiement, elles, pointaient
  // vers la DEMANDE : c'est le panneau des demandes qui les prend.
  const key = notification.notificationKey ?? '';
  if (!key.startsWith('INTERVENTION_') && key !== 'PAYMENT_CONFIRMED') return null;
  return deepLinkId(notification, { pathPrefix: '/interventions' });
}

export interface InterventionDossier {
  intervention: InterventionDetailsData;
  property: Property | null;
}

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

  const tone = priorityTone(intervention.priority);

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
      <PriorityBanner priority={intervention.priority} />

      <section className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
        <PropertyIdentity
          property={property}
          name={intervention.propertyName}
          address={address}
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
              <div className="mt-2">
                <PhotoStrip urls={intervention.sourceIssue.photoUrls!} max={4} />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-x-8 gap-y-3 rounded-lg bg-card px-3.5 py-3">
          {intervention.assignedToName && (
            <div className="min-w-0">
              <Caption>{t('notifications.detail.metadata.assignee', 'Intervenant')}</Caption>
              <span className="mt-1 inline-flex min-w-0 items-center gap-1.5">
                <GuestAvatar
                  name={intervention.assignedToName}
                  // URL ticketee servie par l'API : il ne lui manque que
                  // l'origine — front et API sont sur deux ports en dev.
                  photoUrl={resolveMediaUrl(intervention.assignedToAvatarUrl)}
                  size={20}
                />
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

        <AccessBlock property={property} address={address} />

        {photos.length > 0 && (
          <div className="flex flex-col gap-2">
            <Caption>{t('notifications.detail.intervention.photos', 'Photos')}</Caption>
            <PhotoStrip urls={photos} />
          </div>
        )}

        <ObservationBand text={observation} />
      </section>
    </div>
  );
}

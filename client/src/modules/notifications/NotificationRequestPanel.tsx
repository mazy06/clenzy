import React from 'react';
import { Badge, Skeleton } from '../../components/ui';
import GuestAvatar from '../../components/baitly/GuestAvatar';
import { Money } from '../../components/baitly/Money';
import { LocationOn } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { getInterventionTypeLabel } from '../../utils/statusUtils';
import { serviceRequestsApi, type ServiceRequest } from '../../services/api/serviceRequestsApi';
import { issuesApi, type Issue } from '../../services/api/issuesApi';
import { PropertyIdentity, PropertyLine, useNotificationProperty } from './NotificationPropertyPanel';
import {
  AccessBlock,
  Caption,
  Figure,
  ObservationBand,
  PhotoStrip,
  PriorityBanner,
  formatDuration,
  priorityTone,
} from './NotificationFieldParts';
import { deepLinkId, factId, formatFactDate } from './notificationMeta';
import type { Notification } from '../../services/api';

/**
 * Le DOSSIER d'une demande de service ou d'un signalement terrain.
 *
 * <p>« Une equipe a ete assignee a votre demande "Menage - John Smith" » ou
 * « Anomalie signalee sur Test Property : Joint de douche decolle (MEDIUM) » :
 * un intitule, une gravite entre parentheses, et la decision a prendre sans
 * rien d'autre sous les yeux. Le devis, l'echeance, le prestataire, les photos
 * du constat, l'adresse et le code de porte existaient deja — a un ecran de
 * distance.</p>
 *
 * <p>Les deux objets partagent la meme forme parce qu'ils posent la meme
 * question : faut-il agir, ou est-ce, et combien ca coute. Ils gardent chacun
 * ce qui leur est propre — un devis ligne a ligne pour l'une, des photos de
 * constat pour l'autre.</p>
 */

/** Cles portant une DEMANDE de service. */
const REQUEST_KEYS = /^SERVICE_REQUEST_/;
/** Cles portant un SIGNALEMENT terrain. */
const ISSUE_KEYS = new Set(['ISSUE_REPORTED', 'ISSUE_CONVERTED']);

export type RequestSubject =
  | { kind: 'request'; id: number }
  | { kind: 'issue'; id: number };

/** Demande ou signalement designe par une notification, ou `null`. */
export function requestSubjectOf(notification: Notification): RequestSubject | null {
  const key = notification.notificationKey ?? '';
  if (ISSUE_KEYS.has(key)) {
    const id = factId(notification, 'issueId') ?? deepLinkId(notification, { param: 'highlight' });
    return id === null ? null : { kind: 'issue', id };
  }
  if (REQUEST_KEYS.test(key)) {
    const id = factId(notification, 'serviceRequestId')
      ?? deepLinkId(notification, { param: 'highlight' });
    return id === null ? null : { kind: 'request', id };
  }
  // Les confirmations de paiement d'avant pointaient vers la DEMANDE reglee ;
  // celles d'aujourd'hui vers l'intervention, prise par l'autre panneau.
  if (key === 'PAYMENT_CONFIRMED') {
    const id = factId(notification, 'serviceRequestId')
      ?? deepLinkId(notification, { pathPrefix: '/service-requests' });
    return id === null ? null : { kind: 'request', id };
  }
  return null;
}

export type RequestDossier =
  | { kind: 'request'; request: ServiceRequest }
  | { kind: 'issue'; issue: Issue };

/**
 * Charge la demande ou le signalement.
 *
 * <p>Un echec ne fait rien echouer : `dossier` reste `null` et la fiche retombe
 * sur son message.</p>
 */
export function useNotificationRequest(subject: RequestSubject | null) {
  const [dossier, setDossier] = React.useState<RequestDossier | null>(null);
  const [loading, setLoading] = React.useState(subject !== null);

  const kind = subject?.kind ?? null;
  const id = subject?.id ?? null;

  React.useEffect(() => {
    if (kind === null || id === null) {
      setDossier(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const load = kind === 'issue'
      ? issuesApi.get(id).then((issue): RequestDossier => ({ kind: 'issue', issue }))
      : serviceRequestsApi.getById(id).then((request): RequestDossier => ({ kind: 'request', request }));
    load
      .then((loaded) => { if (active) setDossier(loaded); })
      .catch(() => { if (active) setDossier(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, id]);

  const propertyId = dossier
    ? (dossier.kind === 'issue' ? dossier.issue.propertyId : dossier.request.propertyId)
    : null;
  const { property } = useNotificationProperty(propertyId ?? null);

  return { dossier, property, loading };
}

/** Attente : la forme du panneau, pas un tourniquet centre. */
export function NotificationRequestSkeleton() {
  return (
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
  );
}

/** Le devis, ligne a ligne — ce que le total ne dit pas. */
function QuoteLines({ lines }: { lines: NonNullable<ServiceRequest['quoteLines']> }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <Caption>{t('notifications.detail.request.quote', 'Détail du devis')}</Caption>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {lines.map((line, index) => (
          <li key={`${line.label}-${index}`} className="flex items-baseline gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate text-foreground">{line.label}</span>
            {line.quantity > 1 && (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">×{line.quantity}</span>
            )}
            <span className="shrink-0 font-medium tabular-nums text-foreground">
              <Money value={line.quantity * line.unitPrice} from="EUR" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function NotificationRequestPanel({
  dossier,
  property,
  observation,
}: {
  dossier: RequestDossier;
  property: Parameters<typeof AccessBlock>[0]['property'];
  /** Motif de l'evenement — ce que le panneau ne montre pas de lui-meme. */
  observation?: string;
}) {
  const { t, currentLanguage } = useTranslation();

  const isIssue = dossier.kind === 'issue';
  const title = isIssue ? dossier.issue.title : dossier.request.title;
  const description = isIssue ? dossier.issue.description : dossier.request.description;
  // Un signalement porte une GRAVITE la ou une demande porte une priorite : deux
  // mots pour le meme degre d'urgence, ramenes au meme vocabulaire de teintes.
  const priority = isIssue ? dossier.issue.severity : dossier.request.priority;
  const tone = priorityTone(priority);
  const propertyName = (isIssue ? dossier.issue.propertyName : dossier.request.propertyName)
    ?? property?.name ?? '';

  const address = isIssue
    ? [property?.address, property?.postalCode, property?.city].filter(Boolean).join(', ')
    : dossier.request.propertyAddress
      ?? [property?.address, property?.postalCode, property?.city].filter(Boolean).join(', ');

  const request = isIssue ? null : dossier.request;

  const cost = isIssue
    ? (dossier.issue.suggestedCost ?? null)
    : (request?.estimatedCost ?? null);
  const costLabel = isIssue
    ? t('notifications.detail.request.suggestedCost', 'Coût suggéré')
    : t('notifications.detail.intervention.estimatedCost', 'Coût estimé');

  return (
    <div className="flex flex-col gap-4">
      <PriorityBanner priority={priority} />

      <section className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
        <PropertyIdentity
          property={property}
          name={propertyName}
          extra={address && <PropertyLine icon={<LocationOn />}>{address}</PropertyLine>}
          trailing={request?.serviceType ? (
            <Badge variant={tone?.badge ?? 'secondary'}>
              {getInterventionTypeLabel(request.serviceType, t)}
            </Badge>
          ) : isIssue && dossier.issue.category ? (
            <Badge variant={tone?.badge ?? 'secondary'}>{dossier.issue.category}</Badge>
          ) : undefined}
        />

        <div className="rounded-lg bg-card px-3.5 py-3">
          <Caption>
            {isIssue
              ? t('notifications.detail.request.issueNature', 'Ce qui a été constaté')
              : t('notifications.detail.request.nature', 'Nature de la demande')}
          </Caption>
          <p className="m-0 mt-1 text-sm font-medium text-pretty text-foreground">{title}</p>
          {description?.trim() && (
            <p className="m-0 mt-2 text-sm leading-relaxed text-pretty whitespace-pre-line text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {isIssue && (dossier.issue.photoUrls?.length ?? 0) > 0 && (
          <div className="flex flex-col gap-2">
            <Caption>{t('notifications.detail.intervention.photos', 'Photos')}</Caption>
            <PhotoStrip urls={dossier.issue.photoUrls!} />
          </div>
        )}

        <div className="flex flex-wrap items-end gap-x-8 gap-y-3 rounded-lg bg-card px-3.5 py-3">
          {request?.assignedToName && (
            <div className="min-w-0">
              <Caption>
                {request.assignedToType === 'team'
                  ? t('notifications.detail.request.team', 'Équipe')
                  : t('notifications.detail.metadata.assignee', 'Intervenant')}
              </Caption>
              <span className="mt-1 inline-flex min-w-0 items-center gap-1.5">
                <GuestAvatar name={request.assignedToName} size={20} />
                <span className="truncate text-sm font-medium text-foreground">
                  {request.assignedToName}
                </span>
              </span>
            </div>
          )}
          {isIssue && dossier.issue.reportedByName && (
            <div className="min-w-0">
              <Caption>{t('notifications.detail.request.reportedBy', 'Signalé par')}</Caption>
              <span className="mt-1 inline-flex min-w-0 items-center gap-1.5">
                <GuestAvatar name={dossier.issue.reportedByName} size={20} />
                <span className="truncate text-sm font-medium text-foreground">
                  {dossier.issue.reportedByName}
                </span>
              </span>
            </div>
          )}
          {request?.desiredDate && (
            <Figure label={t('notifications.detail.request.desired', 'Souhaitée le')}>
              {formatFactDate(request.desiredDate.slice(0, 10), currentLanguage)}
            </Figure>
          )}
          {!!request?.estimatedDurationHours && request.estimatedDurationHours > 0 && (
            <Figure label={t('notifications.detail.intervention.estimatedDuration', 'Durée prévue')}>
              {formatDuration(request.estimatedDurationHours * 60, t)}
            </Figure>
          )}
          {cost !== null && cost > 0 && (
            <div className="ms-auto min-w-0 text-end">
              <Caption>{costLabel}</Caption>
              <p className="m-0 mt-1 text-sm font-semibold tabular-nums text-foreground">
                <Money value={cost} from="EUR" />
              </p>
            </div>
          )}
        </div>

        {(request?.quoteLines?.length ?? 0) > 0 && <QuoteLines lines={request!.quoteLines!} />}

        <AccessBlock property={property} address={address} />

        <ObservationBand text={observation} />
      </section>
    </div>
  );
}

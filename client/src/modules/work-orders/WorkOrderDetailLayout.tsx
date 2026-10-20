import React from 'react';
import PropertyPresentation from '../../components/PropertyPresentation';
import ContactPresentation from '../../components/ContactPresentation';
import { Check, Clock3, Play, TriangleAlert, XCircle, CalendarDays, ClipboardList, KeyRound, UserRound } from '../../icons/glyphs';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import ServiceReferenceLabels from '../../components/ServiceReferenceLabels';
import StatusIcon from '../../components/StatusIcon';
import DescriptionNotesDisplay from '../../components/DescriptionNotesDisplay';
import { Money } from '../../components/Money';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDateTime, formatDuration, parseApiDate } from '../../utils/formatUtils';
import { getInterventionTypeLabel, getPropertyTypeLabel } from '../../utils/statusUtils';
import { toApiMediaUrl } from '../../utils/mediaUrl';
import { WorkOrderHeading, WORK_ORDER_ART, workOrderArt } from './WorkOrderPresentation';
import './workOrderDetails.css';
import '../service-requests/baitlyRequestDetail.css';
import './baitlyInterventionDetail.css';

export type WorkOrderAssignmentState =
  | 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'QUOTE_SUBMITTED' | 'QUOTE_APPROVED';

export interface WorkOrderProperty {
  id?: number;
  name: string;
  timezone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  type?: string;
  squareMeters?: number;
  bedroomCount?: number;
  bathroomCount?: number;
  maxGuests?: number;
  numberOfFloors?: number;
  hasExterior?: boolean;
  hasLaundry?: boolean;
  cleaningDurationMinutes?: number;
  /** Description du logement (consignes). */
  description?: string;
  /** Consignes de ménage. */
  cleaningNotes?: string;
}

export interface WorkOrderPerson {
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string | null;
  /** Rôle affiché en texte (libellé déjà traduit ou code brut). */
  roleLabel?: string;
}

export interface WorkOrderAssignee {
  avatarUrl?: string | null;
  name?: string;
  email?: string;
  phone?: string;
  type?: 'user' | 'team';
  /** Libellé du type (« Équipe », rôle, etc.) déjà résolu. */
  typeLabel?: string;
}

/** Tuile métrique secondaire (au-delà des tuiles standard type/durée/échéance). */
export interface WorkOrderMetric {
  icon: React.ReactNode;
  /** Couleur CSS de l'icône et de la valeur. Défaut : la teinte de marque. */
  tone?: string;
  value: string;
  label: string;
}

/**
 * Tache chiffree de la demande d'origine : {@code total = quantity × unitPrice}.
 * C'est le CONTENU du travail — une description generique ne le remplace pas.
 */
export interface WorkOrderTask {
  label: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Acces au logement, tel qu'il est renseigne sur la PROPRIETE.
 *
 * <p>Code de porte, stationnement, consignes d'arrivee : la seule information
 * qui laisse quelqu'un devant une porte fermee quand elle manque. Elle vivait
 * dans la fiche du logement, a deux ecrans de celui qui se deplace.</p>
 */
export interface WorkOrderAccess {
  code?: string | null;
  parking?: string | null;
  arrival?: string | null;
}

/**
 * Signalement a l'origine de l'ordre de travail.
 *
 * <p>Une intervention nee d'une anomalie ne disait pas POURQUOI elle existe :
 * l'intervenant lisait « Fuite sous evier » sans savoir qui l'avait constatee,
 * quand, ni ce qui avait ete decrit sur place.</p>
 */
export interface WorkOrderSourceIssue {
  id: number;
  title: string;
  description?: string | null;
  severity?: string | null;
  reportedByName?: string | null;
  createdAt?: string | null;
  /** Photos prises au moment du constat, avant toute intervention. */
  photoUrls?: string[];
}

/** Ligne supplémentaire dans la section « Détail du temps ». */
export interface WorkOrderTimeRow {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export interface WorkOrderViewModel {
  id?: number;
  title?: string;
  /** Photo de couverture du logement — un lieu se reconnait avant de se lire. */
  propertyPhotoUrl?: string;
  /** Taches chiffrees de la demande. Vide pour un forfait sans devis structure. */
  tasks?: WorkOrderTask[];
  /** Acces au logement, renseigne sur la propriete. */
  access?: WorkOrderAccess;
  /**
   * Reponse de l'intervenant a l'assignation. Une mission acceptee est un
   * engagement : il doit se lire dans la rangee de faits, pas seulement dans
   * un bandeau qu'on survole.
   */
  assignment?: WorkOrderAssignmentState;
  /** Signalement dont decoule ce travail, le cas echeant. */
  sourceIssue?: WorkOrderSourceIssue;
  type: string;
  serviceItemCode?: string;
  status: string;
  /** Libellé de statut déjà traduit. */
  statusLabel: string;
  description?: string;
  /** Source OTA (airbnb/booking…) → pastille logo devant la description. */
  importSource?: string;

  // Métriques
  estimatedDurationHours?: number;
  dueDate?: string;
  estimatedCost?: number;
  /** Prix conseil plateforme (moteur ménage) snapshoté à la création — badge écart. */
  recommendedCost?: number;
  actualCost?: number;
  createdAt?: string;
  /** Tuiles métriques additionnelles (ex : début/fin pour une intervention). */
  extraMetrics?: WorkOrderMetric[];

  property: WorkOrderProperty;

  requestor?: WorkOrderPerson;
  assignee?: WorkOrderAssignee;

  /** Lignes additionnelles dans « Détail du temps » (départ/arrivée voyageur, etc.). */
  extraTimeRows?: WorkOrderTimeRow[];

  /** Section Notes & consignes (omise si rien à afficher). */
  specialInstructions?: string;
  accessNotes?: string;
}

export interface WorkOrderDetailLayoutProps {
  vm: WorkOrderViewModel;
  /** Slot d'action sur la carte Propriété (ex : bouton « Voir la propriété »). */
  propertyHref?: string;
  /**
   * Contenu riche additionnel rendu sous les deux colonnes (ex : le stepper
   * interactif d'une intervention). N'a pas d'équivalent côté demande de service.
   */
  extraSection?: React.ReactNode;
  /**
   * Action principale de l'ecran, posee DANS la carte de progression — c'est le
   * premier bloc de la page, donc le seul endroit ou un « Demarrer » se voit
   * sans defiler. Optionnelle : une demande de service n'en a pas.
   */
  heroAction?: React.ReactNode;
  /**
   * Bandeau rendu JUSTE SOUS la progression : l'etat d'assignation et les gestes
   * qui s'y rattachent. Le tableau de bord dit si une mission est a confirmer,
   * la fiche restait muette — il fallait revenir en arriere pour repondre.
   */
  statusBanner?: React.ReactNode;
  /** Contenu de mission, avant le récapitulatif final. */
  detailsSection?: React.ReactNode;
  /** Décisions administratives à côté des personnes et des horaires. */
  asideSection?: React.ReactNode;
}


/** Le parcours décrit des étapes, pas un pourcentage fictif de travail réalisé. */
function stageOf(status: string) {
  switch (status) {
    case 'PENDING': case 'AWAITING_VALIDATION': return 0;
    case 'APPROVED': case 'SCHEDULED': case 'ASSIGNED': case 'AWAITING_PAYMENT': return 1;
    case 'IN_PROGRESS': return 2;
    case 'COMPLETED': return 3;
    default: return -1;
  }
}

export default function WorkOrderDetailLayout({
  vm, propertyHref, extraSection, heroAction, statusBanner, detailsSection, asideSection,
}: WorkOrderDetailLayoutProps) {
  const { t, currentLanguage } = useTranslation();
  const p = vm.property;
  const status = vm.status.toUpperCase();
  const stage = stageOf(status);
  const cancelled = status === 'CANCELLED' || status === 'REJECTED';
  const currentIcon = cancelled ? XCircle : status === 'COMPLETED' ? Check : status === 'IN_PROGRESS' ? Play : Clock3;
  const currentTone = cancelled ? 'destructive' : status === 'COMPLETED' ? 'success' : status === 'IN_PROGRESS' ? 'info' : 'warning';
  const steps = [
    t('serviceRequests.progressLabels.pending', 'En attente'),
    t('serviceRequests.progressLabels.approved', 'Approuvé'),
    t('serviceRequests.progressLabels.inProgress', 'En cours'),
    t('serviceRequests.progressLabels.completed', 'Terminé'),
  ];
  const addressLine = [p.address, [p.postalCode, p.city].filter(Boolean).join(' '), p.country].filter(Boolean).join(', ');
  const hasActualCost = vm.actualCost != null && vm.actualCost >= 0;
  const hasAccess = !!(vm.access?.code || vm.access?.parking || vm.access?.arrival || vm.accessNotes);
  const hasNotes = !!(p.description || p.cleaningNotes || vm.specialInstructions);
  const tasksTotal = (vm.tasks ?? []).reduce((sum, task) => sum + task.unitPrice * task.quantity, 0);
  const otherCharacteristics = [
    p.type ? getPropertyTypeLabel(p.type, t) : null,
    p.numberOfFloors && p.numberOfFloors > 1 ? p.numberOfFloors + ' ' + t('serviceRequests.layout.floorsShort', 'étages') : null,
    p.hasExterior ? t('serviceRequests.layout.exterior', 'Extérieur') : null,
    p.hasLaundry ? t('serviceRequests.layout.laundry', 'Linge') : null,
  ].filter((value): value is string => Boolean(value));
  const date = (value: string, options: Intl.DateTimeFormatOptions) => {
    const parsed = parseApiDate(value);
    if (!Number.isFinite(parsed.getTime())) return t('requestDetail.unscheduled');
    try { return new Intl.DateTimeFormat(currentLanguage, { ...options, timeZone: p.timezone }).format(parsed); }
    catch { return new Intl.DateTimeFormat(currentLanguage, options).format(parsed); }
  };
  const due = vm.dueDate ? parseApiDate(vm.dueDate) : undefined;
  const plannedEnd = due && Number.isFinite(due.getTime()) && (vm.estimatedDurationHours ?? 0) > 0
    ? new Date(due.getTime() + vm.estimatedDurationHours! * 3600000).toISOString() : undefined;
  const assignmentLabels = {
    PENDING: 'En attente', ACCEPTED: 'Acceptée', DECLINED: 'Refusée',
    QUOTE_SUBMITTED: 'Devis soumis', QUOTE_APPROVED: 'Devis accepté',
  };

  const scaleGap = !hasActualCost && vm.estimatedCost != null && vm.recommendedCost != null && vm.recommendedCost > 0
    ? (() => {
      const delta = vm.estimatedCost! - vm.recommendedCost!;
      const percentage = Math.round(delta / vm.recommendedCost! * 100);
      return <Tooltip><TooltipTrigger asChild>
        <span tabIndex={0} className="wo-scale-gap">
          {Math.abs(delta) <= 5 ? t('workOrders.recommended.conform')
            : (percentage > 0 ? '+' : '') + percentage + ' % ' + t('workOrders.recommended.vsScale')}
        </span>
      </TooltipTrigger><TooltipContent>{t('workOrders.recommended.scale')}: <Money value={vm.recommendedCost!} from="EUR" /></TooltipContent></Tooltip>;
    })() : null;

  return <div className="wo-detail baitly-request-detail baitly-intervention-detail">
    <section className="baitly-request-tracking" data-closed={cancelled || undefined}>
      <div className="baitly-request-tracking__heading">
        <div><p className="baitly-request-eyebrow">{t('workOrderDetails.progress', 'Avancement de la mission')}{vm.id != null && <> · #{vm.id}</>}</p>
          <h2>{vm.statusLabel}</h2>
        </div>
        <div className="baitly-intervention-actions">
          <StatusIcon icon={currentIcon} tone={currentTone} label={vm.statusLabel} />
          {heroAction}
        </div>
      </div>
      {stage >= 0 && <ol className="baitly-request-progress" aria-label={t('workOrderDetails.progress', 'Avancement de la mission')}>
        {steps.map((label, index) => <li key={label} data-completed={index < stage || undefined}
          aria-current={index === stage ? 'step' : undefined}>
          <div className="baitly-request-progress__track">
            <span className="baitly-request-progress__number" aria-hidden="true">{index < stage ? <Check size={13} /> : index + 1}</span>
            {index < 3 && <span className="baitly-request-progress__line" aria-hidden="true" />}
          </div>
          <span className="baitly-request-progress__label">{label}</span>
        </li>)}
      </ol>}
      {stage >= 0 && <p className="baitly-request-mobile-step">{t('requestDetail.currentStep')} · {steps[stage]}</p>}
    </section>
    {statusBanner && <div className="wo-banner">{statusBanner}</div>}
    <div className="baitly-request-layout">
      <div className="wo-main baitly-request-main">
        <PropertyPresentation name={p.name} address={addressLine} photoUrl={vm.propertyPhotoUrl}
          propertyHref={propertyHref} squareMeters={p.squareMeters} bedrooms={p.bedroomCount}
          bathrooms={p.bathroomCount} guests={p.maxGuests} details={otherCharacteristics} />
        <section className="wo-section">
          <WorkOrderHeading icon={<ClipboardList />} art={workOrderArt(vm.type)} title={t('workOrderDetails.mission', 'La mission')} />
          {vm.title && <p className="baitly-intervention-service">{vm.title}</p>}
          <p className={vm.title ? 'baitly-intervention-type' : 'baitly-intervention-service'}>{vm.serviceItemCode ? <ServiceReferenceLabels codes={[vm.serviceItemCode]} /> : getInterventionTypeLabel(vm.type, t)}</p>
          {vm.description ? <p className="wo-copy">{vm.description}</p>
            : <p className="wo-muted">{t('workOrderDetails.noDescription', 'Aucune consigne particulière renseignée.')}</p>}
          {vm.importSource && <p className="wo-muted">{t('workOrderDetails.source', 'Source')} : {vm.importSource}</p>}
          {!!vm.tasks?.length && <div className="wo-task-list">
            <h3>{t('serviceRequests.details.tasks', 'Prestations demandées')}</h3>
            {vm.tasks.map((task, index) => <div className="wo-task" key={index}>
              <span>{task.label}<small> × {task.quantity}</small></span>
              <strong><Money value={task.unitPrice * task.quantity} /></strong>
            </div>)}
            {vm.tasks.length > 1 && <div className="wo-task wo-task--total"><strong>{t('field.proposals.total', 'Total')}</strong><strong><Money value={tasksTotal} /></strong></div>}
          </div>}
          {hasNotes && <div className="wo-notes">
            <h3>{t('serviceRequests.details.notesInstructions')}</h3>
            {(p.description || p.cleaningNotes) && <DescriptionNotesDisplay description={p.description} notes={p.cleaningNotes}
              variant={workOrderArt(vm.type) === WORK_ORDER_ART.cleaning ? 'cleaning' : 'other'} />}
            {vm.specialInstructions && <p className="wo-copy">{vm.specialInstructions}</p>}
          </div>}
        </section>

        {hasAccess && <section className="wo-section wo-access">
          <WorkOrderHeading icon={<KeyRound />} art={WORK_ORDER_ART.access} title={t('serviceRequests.details.accessSection', 'Accès au logement')} />
          <dl className="wo-info">
            {vm.access?.code && <div><dt>{t('serviceRequests.details.accessCode', 'Code')}</dt><dd><code className="wo-access-code">{vm.access.code}</code></dd></div>}
            {vm.access?.parking && <div><dt>{t('serviceRequests.details.accessParking', 'Stationnement')}</dt><dd>{vm.access.parking}</dd></div>}
            {vm.access?.arrival && <div><dt>{t('serviceRequests.details.accessArrival', 'Arrivée')}</dt><dd>{vm.access.arrival}</dd></div>}
            {vm.accessNotes && <div><dt>{t('serviceRequests.details.accessNotes')}</dt><dd>{vm.accessNotes}</dd></div>}
          </dl>
        </section>}

        {vm.sourceIssue && <section className="wo-section">
          <WorkOrderHeading art={WORK_ORDER_ART['property-maintenance']} title={t('serviceRequests.details.sourceIssue', 'Signalement à l’origine')} />
          <div className="wo-issue-title"><h3>{vm.sourceIssue.title}</h3>
            {vm.sourceIssue.severity && <StatusIcon icon={TriangleAlert}
              tone={['HIGH', 'CRITICAL'].includes(vm.sourceIssue.severity) ? 'destructive' : 'warning'}
              label={t('issues.severity.' + vm.sourceIssue.severity.toLowerCase(), vm.sourceIssue.severity)} />}
          </div>
          {vm.sourceIssue.description && <p className="wo-copy">{vm.sourceIssue.description}</p>}
          {!!vm.sourceIssue.photoUrls?.length && <div className="wo-issue-photos">{vm.sourceIssue.photoUrls.map((url, index) =>
            <a key={url} href={toApiMediaUrl(url)} target="_blank" rel="noopener noreferrer">
              <img src={toApiMediaUrl(url)} alt={t('serviceRequests.details.issuePhotoAlt', 'Photo du signalement {{index}}', { index: index + 1 })} loading="lazy" />
            </a>)}</div>}
          <p className="wo-muted">{[
            vm.sourceIssue.reportedByName && t('serviceRequests.details.reportedBy', 'Signalé par {{name}}', { name: vm.sourceIssue.reportedByName }),
            vm.sourceIssue.createdAt && formatDateTime(vm.sourceIssue.createdAt),
          ].filter(Boolean).join(' · ')}</p>
        </section>}
        {detailsSection && <div className="wo-details-slot">{detailsSection}</div>}
        {(vm.extraTimeRows?.length || vm.extraMetrics?.length || vm.createdAt || p.cleaningDurationMinutes) ? <section className="wo-section wo-time-log">
          <WorkOrderHeading icon={<Clock3 />} art={WORK_ORDER_ART.duration} title={t('serviceRequests.layout.timeDetail', 'Détail du temps')} />
          <dl className="wo-info wo-info--compact">
            {p.cleaningDurationMinutes != null && p.cleaningDurationMinutes > 0 && <div>
              <dt>{t('serviceRequests.layout.propertyCleaningDuration', 'Durée ménage (propriété)')}</dt><dd>{formatDuration(p.cleaningDurationMinutes / 60)}</dd>
            </div>}
            {vm.extraMetrics?.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}
            {vm.extraTimeRows?.map((row, index) => <div key={index}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
            {vm.createdAt && <div><dt>{t('serviceRequests.createdAtLabel')}</dt><dd>{formatDateTime(vm.createdAt)}</dd></div>}
          </dl>
        </section> : null}

        {asideSection && <div className="wo-admin-slot">{asideSection}</div>}
      </div>

      <aside className="wo-aside baitly-request-sidebar" aria-label={t('workOrderDetails.organization', 'Organisation de la mission')}>
        <section className="baitly-request-schedule">
          <h2 className="flex items-center gap-2"><CalendarDays className="size-4" aria-hidden />{t('requestDetail.schedule')}</h2>
          <p className="baitly-request-schedule__date">{vm.dueDate ? date(vm.dueDate, { dateStyle: 'full' }) : t('requestDetail.unscheduled')}</p>
          {vm.dueDate && <p className="m-0 flex flex-wrap items-center gap-2 tabular-nums"><Clock3 className="size-4" aria-hidden />
            {date(vm.dueDate, { timeStyle: 'short' })}{plannedEnd && <> – {date(plannedEnd, { timeStyle: 'short' })}</>}
            {vm.estimatedDurationHours != null && <span className="text-sm text-muted-foreground">· {formatDuration(vm.estimatedDurationHours)}</span>}
          </p>}
          {p.timezone && <p className="mt-3 mb-0 text-xs text-muted-foreground">{t('requestDetail.localTime')} · {p.timezone}</p>}
        </section>
        <section className="wo-section baitly-intervention-pricing">
          <h2>{t('requestDetail.price')}</h2>
          <span className="wo-label">{hasActualCost ? t('serviceRequests.details.actualCost') : t('serviceRequests.details.estimatedCost')}</span>
          <p className="baitly-intervention-price">{hasActualCost ? <Money value={vm.actualCost!} from="EUR" />
            : vm.estimatedCost != null ? <Money value={vm.estimatedCost} from="EUR" /> : t('requestDetail.notProvided')}</p>
          {scaleGap}
          <dl className="wo-info wo-info--compact">
            {hasActualCost && vm.estimatedCost != null && <div><dt>{t('serviceRequests.details.estimatedCost')}</dt><dd><Money value={vm.estimatedCost} from="EUR" /></dd></div>}
            {vm.recommendedCost != null && <div><dt>{t('requestDetail.recommended')}</dt><dd><Money value={vm.recommendedCost} from="EUR" /></dd></div>}
          </dl>
        </section>
        {(vm.requestor || vm.assignee) && <section className="wo-section">
          <WorkOrderHeading icon={<UserRound />} art={WORK_ORDER_ART.people} title={t('serviceRequests.peopleInvolved')} />
          <div>
            {vm.assignee && <ContactPresentation name={vm.assignee.name || t('serviceRequests.fields.noAssignment')}
              pending={!vm.assignee.name} photoUrl={vm.assignee.avatarUrl} label={t('requestDetail.provider')}
              role={vm.assignee.typeLabel} team={vm.assignee.type === 'team'} email={vm.assignee.email} phone={vm.assignee.phone} />}
            {vm.requestor && <ContactPresentation name={vm.requestor.name} photoUrl={vm.requestor.avatarUrl}
              label={t('serviceRequests.fields.requestor')} role={vm.requestor.roleLabel}
              email={vm.requestor.email} phone={vm.requestor.phone} />}
          </div>
          {vm.assignment && <div className="wo-assignment">
            <span className="wo-label">{t('interventions.detail.assignmentLabel', 'Votre réponse')}</span>
            <StatusIcon icon={vm.assignment === 'DECLINED' ? XCircle : vm.assignment === 'PENDING' || vm.assignment === 'QUOTE_SUBMITTED' ? Clock3 : Check}
              tone={vm.assignment === 'DECLINED' ? 'destructive' : vm.assignment === 'PENDING' || vm.assignment === 'QUOTE_SUBMITTED' ? 'warning' : 'success'}
              label={t('interventions.detail.assignment.' + vm.assignment, assignmentLabels[vm.assignment])} />
            <span className="text-sm font-medium">{t('interventions.detail.assignment.' + vm.assignment, assignmentLabels[vm.assignment])}</span>
          </div>}
        </section>}
      </aside>
    </div>
    {extraSection}
  </div>;
}

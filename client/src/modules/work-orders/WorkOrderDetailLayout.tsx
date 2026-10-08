import React from 'react';
import { Check, Clock3, MapPin, Play, TriangleAlert, XCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import ServiceReferenceLabels from '../../components/ServiceReferenceLabels';
import StatusIcon from '../../components/StatusIcon';
import DescriptionNotesDisplay from '../../components/DescriptionNotesDisplay';
import { Money } from '../../components/Money';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDateTime, formatDuration } from '../../utils/formatUtils';
import { getInterventionTypeLabel, getPropertyTypeLabel } from '../../utils/statusUtils';
import { toApiMediaUrl } from '../../utils/mediaUrl';
import { WorkOrderHeading, WORK_ORDER_ART, workOrderArt } from './WorkOrderPresentation';
import './workOrderDetails.css';

export type WorkOrderAssignmentState =
  | 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'QUOTE_SUBMITTED' | 'QUOTE_APPROVED';

export interface WorkOrderProperty {
  id?: number;
  name: string;
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
  avatarUrl?: string | null;
  /** Rôle affiché en texte (libellé déjà traduit ou code brut). */
  roleLabel?: string;
}

export interface WorkOrderAssignee {
  avatarUrl?: string | null;
  name?: string;
  email?: string;
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
  propertyAction?: React.ReactNode;
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


function initialsOf(name: string) {
  return name.replace(/^\s*\[[^\]]*\]\s*/, '').split(/[\s-]+/).filter(Boolean)
    .slice(0, 2).map(word => word[0]).join('').toUpperCase() || '?';
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

function Fact({ art, label, children }: { art: string; label: string; children: React.ReactNode }) {
  return <div className="wo-fact">
    <img src={art} alt="" width={42} height={42} decoding="async" />
    <div><span className="wo-label">{label}</span><div className="wo-fact__value">{children}</div></div>
  </div>;
}

export default function WorkOrderDetailLayout({
  vm, propertyAction, extraSection, heroAction, statusBanner, detailsSection, asideSection,
}: WorkOrderDetailLayoutProps) {
  const { t } = useTranslation();
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
  const hasActualCost = vm.actualCost != null && vm.actualCost > 0;
  const hasAccess = !!(vm.access?.code || vm.access?.parking || vm.access?.arrival || vm.accessNotes);
  const hasNotes = !!(p.description || p.cleaningNotes || vm.specialInstructions);
  const tasksTotal = (vm.tasks ?? []).reduce((sum, task) => sum + task.unitPrice * task.quantity, 0);
  const characteristics = [
    { value: p.bedroomCount, art: WORK_ORDER_ART.bedrooms, label: t('serviceRequests.layout.bedroomsShort', 'ch.') },
    { value: p.bathroomCount, art: WORK_ORDER_ART.bathrooms, label: t('serviceRequests.layout.bathroomsShort', 'SDB') },
    { value: p.squareMeters, art: WORK_ORDER_ART.surface, label: 'm²' },
    { value: p.maxGuests, art: WORK_ORDER_ART.capacity, label: t('serviceRequests.layout.guestsShort', 'voyag.') },
  ].filter(item => item.value != null);
  const otherCharacteristics = [
    p.type ? getPropertyTypeLabel(p.type, t) : null,
    p.numberOfFloors && p.numberOfFloors > 1 ? p.numberOfFloors + ' ' + t('serviceRequests.layout.floorsShort', 'étages') : null,
    p.hasExterior ? t('serviceRequests.layout.exterior', 'Extérieur') : null,
    p.hasLaundry ? t('serviceRequests.layout.laundry', 'Linge') : null,
  ].filter(Boolean);
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

  return <div className="wo-detail">
    <section className="wo-overview">
      <div className="wo-property">
        <img className={vm.propertyPhotoUrl ? 'wo-property__photo' : 'wo-property__art'}
          src={vm.propertyPhotoUrl ? toApiMediaUrl(vm.propertyPhotoUrl) : WORK_ORDER_ART.property}
          alt="" width={76} height={76} />
        <div className="wo-property__identity">
          <h2>{p.name}</h2>
          {addressLine && <p><MapPin size={14} aria-hidden="true" /><span>{addressLine}</span></p>}
          <div className="wo-property__links">
            {propertyAction}
            {addressLine && <a href={'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(addressLine)}
              target="_blank" rel="noopener noreferrer"><MapPin size={14} aria-hidden="true" />{t('serviceRequests.details.directions', 'Itinéraire')}</a>}
          </div>
        </div>
        <div className="wo-property__state">
          <StatusIcon icon={currentIcon} tone={currentTone} label={vm.statusLabel} />
          {heroAction}
        </div>
      </div>
      {stage >= 0 && <ol className="wo-stages" aria-label={t('workOrderDetails.progress', 'Avancement de la mission')}>
        {steps.map((label, index) => <li key={label} data-state={index < stage ? 'done' : index === stage ? 'current' : 'next'}
          aria-current={index === stage ? 'step' : undefined}>
          <span className="wo-stage-mark" aria-hidden="true">{index < stage ? <Check size={13} /> : index + 1}</span><span>{label}</span>
        </li>)}
      </ol>}
      <div className="wo-facts">
        <Fact art={workOrderArt(vm.type)} label={t('common.type')}>
          {vm.serviceItemCode ? <ServiceReferenceLabels codes={[vm.serviceItemCode]} /> : getInterventionTypeLabel(vm.type, t)}
        </Fact>
        <Fact art={WORK_ORDER_ART.calendar} label={t('serviceRequests.dueDateShort')}>
          {vm.dueDate ? formatDateTime(vm.dueDate) : '—'}
        </Fact>
        <Fact art={WORK_ORDER_ART.duration} label={t('serviceRequests.estimatedDurationLabel')}>
          {vm.estimatedDurationHours != null ? formatDuration(vm.estimatedDurationHours) : '—'}
        </Fact>
        <Fact art={WORK_ORDER_ART.payment} label={hasActualCost ? t('serviceRequests.details.actualCost') : t('serviceRequests.details.estimatedCost')}>
          {hasActualCost ? <Money value={vm.actualCost!} from="EUR" />
            : vm.estimatedCost != null ? <Money value={vm.estimatedCost} from="EUR" /> : '—'}
          {scaleGap}
        </Fact>
        {vm.extraMetrics?.map(metric => <div className="wo-fact" key={metric.label}>
          <span aria-hidden="true">{metric.icon}</span><div><span className="wo-label">{metric.label}</span><div className="wo-fact__value">{metric.value}</div></div>
        </div>)}
      </div>
    </section>

    {statusBanner && <div className="wo-banner">{statusBanner}</div>}

    <div className="wo-columns">
      <div className="wo-main">
        <section className="wo-section">
          <WorkOrderHeading art={workOrderArt(vm.type)} title={t('workOrderDetails.mission', 'La mission')} />
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
          <WorkOrderHeading art={WORK_ORDER_ART.access} title={t('serviceRequests.details.accessSection', 'Accès au logement')} />
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
        {detailsSection}
      </div>

      <aside className="wo-aside" aria-label={t('workOrderDetails.organization', 'Organisation de la mission')}>
        {(vm.requestor || vm.assignee) && <section className="wo-section">
          <WorkOrderHeading art={WORK_ORDER_ART.people} title={t('serviceRequests.peopleInvolved')} />
          {vm.assignee && <div className="wo-person">
            <Avatar className="size-10">
              {vm.assignee.avatarUrl && <AvatarImage src={toApiMediaUrl(vm.assignee.avatarUrl)} alt="" />}
              <AvatarFallback>{initialsOf(vm.assignee.name || '')}</AvatarFallback>
            </Avatar>
            <div><span className="wo-label">{t('serviceRequests.assignedTo')}</span>
              <strong>{vm.assignee.name || t('serviceRequests.fields.noAssignment')}</strong>
              {(vm.assignee.email || vm.assignee.typeLabel) && <p>{[vm.assignee.typeLabel, vm.assignee.email].filter(Boolean).join(' · ')}</p>}
            </div>
          </div>}
          {vm.requestor && <div className="wo-person">
            <Avatar className="size-10">
              {vm.requestor.avatarUrl && <AvatarImage src={toApiMediaUrl(vm.requestor.avatarUrl)} alt="" />}
              <AvatarFallback>{initialsOf(vm.requestor.name)}</AvatarFallback>
            </Avatar>
            <div><span className="wo-label">{t('serviceRequests.fields.requestor')}</span><strong>{vm.requestor.name}</strong>
              {(vm.requestor.email || vm.requestor.roleLabel) && <p>{[vm.requestor.roleLabel, vm.requestor.email].filter(Boolean).join(' · ')}</p>}
            </div>
          </div>}
          {vm.assignment && <div className="wo-assignment">
            <span className="wo-label">{t('interventions.detail.assignmentLabel', 'Votre réponse')}</span>
            <StatusIcon icon={vm.assignment === 'DECLINED' ? XCircle : vm.assignment === 'PENDING' || vm.assignment === 'QUOTE_SUBMITTED' ? Clock3 : Check}
              tone={vm.assignment === 'DECLINED' ? 'destructive' : vm.assignment === 'PENDING' || vm.assignment === 'QUOTE_SUBMITTED' ? 'warning' : 'success'}
              label={t('interventions.detail.assignment.' + vm.assignment, assignmentLabels[vm.assignment])} />
          </div>}
        </section>}
        {(vm.extraTimeRows?.length || vm.createdAt || p.cleaningDurationMinutes) ? <section className="wo-section">
          <WorkOrderHeading art={WORK_ORDER_ART.duration} title={t('serviceRequests.layout.timeDetail', 'Détail du temps')} />
          <dl className="wo-info wo-info--compact">
            {p.cleaningDurationMinutes != null && p.cleaningDurationMinutes > 0 && <div>
              <dt>{t('serviceRequests.layout.propertyCleaningDuration', 'Durée ménage (propriété)')}</dt><dd>{formatDuration(p.cleaningDurationMinutes / 60)}</dd>
            </div>}
            {vm.extraTimeRows?.map((row, index) => <div key={index}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
            {vm.createdAt && <div><dt>{t('serviceRequests.createdAtLabel')}</dt><dd>{formatDateTime(vm.createdAt)}</dd></div>}
          </dl>
        </section> : null}
        {!!(characteristics.length || otherCharacteristics.length) && <section className="wo-section">
          <WorkOrderHeading art={WORK_ORDER_ART.property} title={t('serviceRequests.sections.property')} />
          <div className="wo-characteristics">{characteristics.map(item => <div key={item.art}>
            <img src={item.art} alt="" width={38} height={38} /><span><strong>{item.value}</strong> {item.label}</span>
          </div>)}</div>
          {!!otherCharacteristics.length && <p className="wo-muted">{otherCharacteristics.join(' · ')}</p>}
        </section>}
        {asideSection}
      </aside>
    </div>
    {extraSection}
  </div>;
}

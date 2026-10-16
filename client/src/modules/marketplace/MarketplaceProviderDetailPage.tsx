import { useMarketplacePresentation } from './useMarketplacePresentation';
import { useTranslation } from "react-i18next";
// Hors composant : la langue se lit a l'appel, pas au chargement du module.
import i18nInstance from '../../i18n/config';
import { formatDate as formatLocalizedDate } from '../quotes/quotePresentation';
import ProviderDecisionJournal from './ProviderDecisionJournal';
import ProviderDocumentaryPanel from './ProviderDocumentaryPanel';
import ProviderRetentionPanel from './ProviderRetentionPanel';
import BaitlyProviderEditor from './BaitlyProviderEditor';
import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import StatusChip from '../../components/baitly/StatusChip';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Textarea,
} from '../../components/ui';
import {
  ArrowBack,
  Edit,
  Business,
  Email,
  LocationOn,
  OpenInNew,
  PersonSearch,
  Phone,
  Description,
  Verified,
  WarningAmber,
} from '../../icons';
import { cn } from '../../utils/cn';
import { BaitlyProviderIdentity, BaitlyProviderOffers as OffersByCategory, BaitlyProfileSection as Section } from './BaitlyProviderProfile';
import ProviderNotificationStatus from './ProviderNotificationStatus';
import ProviderProvisioningPanel from './ProviderProvisioningPanel';
import {
  useMarketplaceProvider,
  useProviderDocuments,
  useProviderExposureRules,
  useRemoveProviderExposureRule,
  useSetProviderExposureRule,
  useReviewProviderDocument,
  useUpdateProviderEngagement,
  useUpdateProviderStatus,
} from '../../hooks/useMarketplaceProviders';
import { marketplaceProvidersApi } from '../../services/api/marketplaceProvidersApi';
import type {
  ExposureEffect,
  ProviderDetailDto,
  ProviderOfferDto,
  ProviderStatus,
} from '../../services/api/marketplaceProvidersApi';
import { declaredDays, summariseWeek } from './providerAvailability';
import {
  COMPLIANCE_TONES,
  complianceState,
  ENGAGEMENT_ORDER,
  ENGAGEMENT_TONES,
  STATUS_ORDER,
  STATUS_TONES,
} from './providerPresentation';

/**
 * Motif d'un refus de changement d'état.
 *
 * <p>Les refus de cet écran sont des règles métier — adresse non confirmée,
 * motif de refus manquant — et le serveur les rédige déjà pour un humain. Seul
 * un échec sans message (réseau, 500) mérite un « réessayez » : lui seul peut
 * réussir au second essai.</p>
 */
function statusErrorMessage(error: unknown): string {
  const message = (error as { message?: string } | null)?.message;
  return message && message.trim().length > 0
    ? message
    : i18nInstance.t('marketplaceAdmin.stateChangeFailed');
}

// ─── Blocs de présentation ──────────────────────────────────────────────────

/**
 * Section de la fiche.
 *
 * <p>{@code shrink-0} : le conteneur de page est un {@code flex flex-col} en
 * {@code overflow-auto}. Sans lui, une section se COMPRIME pour tenir dans la
 * hauteur restante au lieu de faire défiler — c'est ce qui tranchait le bandeau
 * d'identité en deux, chips et réputation coupés au milieu.</p>
 */
/**
 * Couples libellé / valeur, **vides exclus**.
 *
 * <p>La version précédente rendait chaque champ, renseigné ou non. Sur une fiche
 * reprise d'un compte existant — le cas de toutes celles importées — cela
 * donnait neuf lignes de tirets sur deux cartes, soit la moitié de l'écran
 * occupée par l'absence d'information. Ici une ligne vide ne s'affiche pas, et
 * la section dit en une phrase ce qui manque.</p>
 */
function DataList({ rows, emptyLabel }: {
  rows: Array<{ label: string; value: React.ReactNode }>;
  emptyLabel: string;
}) {
  const filled = rows.filter(
    (row) => row.value !== null && row.value !== undefined && row.value !== '');

  if (filled.length === 0) {
    return <p className="m-0 text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
      {filled.map((row) => (
        <React.Fragment key={row.label}>
          <dt className="text-xs text-muted-foreground">{row.label}</dt>
          <dd className="m-0 text-end text-sm text-foreground">{row.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

const DOCUMENT_TONES = {
  PENDING: 'warn',
  APPROVED: 'ok',
  REJECTED: 'err',
} as const;

/**
 * Justificatifs déposés par un candidat qui n'a pas encore de compte.
 *
 * <p>La section ne s'affiche que s'il y a des pièces : une fiche reprise d'un
 * compte interne n'en a aucune ici — les siennes sont rattachées à son compte —
 * et un cadre vide laisserait croire à un dossier incomplet.</p>
 */
export function ApplicationDocuments({ providerId, emailConfirmed }: { providerId: number; emailConfirmed: boolean }) {
  const { t, i18n } = useTranslation();
  const { data: documents, isError: loadFailed } = useProviderDocuments(providerId);
  const review = useReviewProviderDocument();
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [note, setNote] = useState('');

  const [openFailed, setOpenFailed] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);
  const openDocument = async (id: number) => {
    if (opening !== null) return;
    setOpening(id); setOpenFailed(false);
    try { await marketplaceProvidersApi.openDocument(providerId, id); }
    catch { setOpenFailed(true); }
    finally { setOpening(null); }
  };
  if (loadFailed) return <p role="alert">{t('marketplaceDocuments.loadFailed')}</p>;
  if (!documents || documents.length === 0) return null;

  return (
    <Section title={t("marketplaceDocuments.title")}>
      {openFailed && <p role="alert">{t("marketplaceDocuments.openFailed")}</p>}
      {!emailConfirmed && <p role="status" className="text-sm text-muted-foreground">{t("marketplace.review.confirmEmailFirst")}</p>}
      {review.isError && <p role="alert" className="text-sm text-destructive-ink">{t("marketplaceDocuments.reviewFailed")}</p>}
      <ul className="m-0 flex list-none flex-col p-0">
        {documents.map((document) => (
          <li
            key={document.id}
            className="flex flex-col gap-1.5 border-b border-border py-2.5 last:border-b-0"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 flex items-center gap-1.5 text-sm font-medium text-foreground [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-primary">
                  <Description />
                  {t('marketplaceDocuments.types.' + document.documentType)}
                </p>
                <p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">
                  {document.fileName}
                  {' · '}
                  {formatLocalizedDate(document.createdAt, i18n.language)}
                  {document.expiresAt && <> · {t('marketplaceDocuments.expires', { date: formatLocalizedDate(document.expiresAt, i18n.language) })}</>}
                </p>
              </div>
              <StatusChip
                size="sm"
                tone={DOCUMENT_TONES[document.status]}
                label={t('marketplaceDocuments.status.' + document.status)}
              />
            </div>

            {document.reviewNote && (
              <p className="m-0 rounded-md bg-muted px-2.5 py-1.5 text-xs leading-relaxed text-muted-foreground">
                {document.reviewNote}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={opening !== null}
                onClick={() => { void openDocument(document.id); }}
              >
                {t('marketplaceDocuments.open')}
              </Button>
              {document.status !== 'APPROVED' && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!emailConfirmed || review.isPending}
                  onClick={() => review.mutate({
                    id: providerId, documentId: document.id, status: 'APPROVED',
                  })}
                >
                  {t('marketplaceDocuments.approve')}
                </Button>
              )}
              {document.status !== 'REJECTED' && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!emailConfirmed || review.isPending}
                  onClick={() => { setRejecting(document.id); setNote(''); }}
                >
                  {t('marketplaceDocuments.reject')}
                </Button>
              )}
            </div>

            {rejecting === document.id && (
              <div className="flex flex-col gap-2">
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder={t("marketplaceDocuments.reasonRequired")}
                  aria-label={t("marketplaceDocuments.reason")}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    // Un refus sans motif condamne le candidat à redéposer la
                    // même pièce : le bouton reste fermé tant qu'il est vide.
                    disabled={!emailConfirmed || note.trim().length === 0 || review.isPending}
                    onClick={() => review.mutate(
                      {
                        id: providerId,
                        documentId: document.id,
                        status: 'REJECTED',
                        reviewNote: note.trim(),
                      },
                      { onSuccess: () => { setRejecting(null); setNote(''); } },
                    )}
                  >
                    {t('marketplaceDocuments.confirmReject')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRejecting(null)}>
                    {t('marketplaceDocuments.cancel')}
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/**
 * Qui voit cette fiche.
 *
 * <p>Le défaut est OUVERT : une fiche active est visible de toutes les
 * organisations. Ce panneau ne montre donc que les <strong>exceptions</strong>,
 * et une liste vide est l'état normal — le dire évite qu'on cherche la règle
 * manquante.</p>
 */
function ExposurePanel({ providerId }: { providerId: number }) {
  const { t } = useMarketplacePresentation();
  const { data: rules, isError, isLoading } = useProviderExposureRules(providerId);
  const setRule = useSetProviderExposureRule();
  const removeRule = useRemoveProviderExposureRule();

  const [open, setOpen] = useState(false);
  const [effect, setEffect] = useState<ExposureEffect>('DENY');
  const [organizationId, setOrganizationId] = useState('');
  const [reason, setReason] = useState('');

  const canSubmit = reason.trim().length > 0 && !setRule.isPending;

  const submit = () => {
    setRule.mutate(
      {
        id: providerId,
        effect,
        reason: reason.trim(),
        organizationId: organizationId.trim() ? Number(organizationId.trim()) : null,
      },
      { onSuccess: () => { setOpen(false); setReason(''); setOrganizationId(''); } },
    );
  };

  return (
    <Section title={t('marketplaceAdmin.exposure')}>
      {isError ? <p role="alert">{t('marketplaceAdmin.failed')}</p> : isLoading ? <Skeleton className="h-12 w-full" /> : <>
      {(setRule.isError || removeRule.isError) && <p role="alert">{t('marketplaceAdmin.failed')}</p>}
      {!rules || rules.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">{t('marketplaceAdmin.noExceptions')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-b-0">
              <div className="min-w-0">
                <p className="m-0 flex items-center gap-1.5 text-sm text-foreground">
                  <StatusChip
                    size="sm"
                    tone={rule.effect === 'DENY' ? 'err' : 'ok'}
                    label={rule.effect === 'DENY' ? t('marketplaceAdmin.hidden') : t('marketplaceAdmin.visible')}
                  />
                  {rule.organizationName ?? `${t("marketplaceAdmin.organization")} #${rule.organizationId}`}
                </p>
                <p className="m-0 mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {rule.reason}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={removeRule.isPending}
                onClick={() => removeRule.mutate({ id: providerId, ruleId: rule.id })}
              >{t('marketplaceAdmin.remove')}</Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 border-t border-border pt-3">
        {!open ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{t('marketplaceAdmin.addException')}</Button>
        ) : (
          <div className="flex flex-col gap-2">
            <Select value={effect} onValueChange={(value) => setEffect(value as ExposureEffect)}>
              <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DENY">{t('marketplaceAdmin.hideProfile')}</SelectItem>
                <SelectItem value="ALLOW">{t('marketplaceAdmin.overrideHidden')}</SelectItem>
              </SelectContent>
            </Select>

            <input
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              inputMode="numeric"
              placeholder={t('marketplaceAdmin.orgPlaceholder')}
              aria-label={t('marketplaceAdmin.targetOrg')}
              className="h-8 rounded-md border border-border bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />

            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              rows={2}
              placeholder={t('marketplaceAdmin.ruleReasonPlaceholder')}
              aria-label={t('marketplaceAdmin.ruleReason')}
            />

            <div className="flex gap-2">
              <Button size="sm" disabled={!canSubmit} onClick={submit}>{t('marketplaceAdmin.apply')}</Button>
              <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setReason(''); }}>{t('marketplaceAdmin.cancel')}</Button>
            </div>

            {reason.trim().length === 0 && (
              <p className="m-0 text-xs text-warning-ink">
                {/* Le serveur refuse aussi : le dire ici évite de perdre la saisie. */}
                {t("marketplaceAdmin.ruleHint")}
              </p>
            )}
          </div>
        )}
      </div>
      </>}
    </Section>
  );
}

/** Prestations groupées par métier : une ligne de prix par prestation. */
/**
 * Où et quand le professionnel intervient.
 *
 * <p>Zones et disponibilités étaient deux cartes distinctes ; c'est une seule
 * question — « puis-je le faire venir ici, ce jour-là ? ». Les réunir supprime
 * aussi la colonne morte qui s'étirait sous la seconde.</p>
 */
function Coverage({ provider }: { provider: ProviderDetailDto }) {
  const { t, locale, DAY_NAMES, DAY_INITIALS } = useMarketplacePresentation();
  const spans = useMemo(() => summariseWeek(provider.availability, locale), [provider.availability, locale]);
  const openDays = useMemo(() => declaredDays(provider.availability), [provider.availability]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="m-0 mb-1.5 text-sm font-semibold text-foreground">{t('marketplaceAdmin.zones')}</h3>
        {provider.zones.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">{t('marketplaceAdmin.noZones')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {provider.zones.map((zone) => (
              <li
                key={zone.id}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs',
                  zone.primary
                    ? 'bg-primary-soft font-medium text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                <LocationOn className="size-3" />
                {[zone.city, zone.arrondissement ?? zone.postalCode, zone.department].filter(Boolean).join(' · ')
                  || zone.countryCode}
                {zone.radiusKm ? ` (${zone.radiusKm} km)` : ''}
              </li>
            ))}
          </ul>
        )}
        {provider.travelRadiusKm != null && (
          <p className="m-0 mt-2 text-xs text-muted-foreground">
            {t('marketplaceAdmin.radius', { count: provider.travelRadiusKm })}
          </p>
        )}
      </div>

      <div className="border-t border-border pt-3.5">
        <h3 className="m-0 mb-2 text-sm font-semibold text-foreground">{t('marketplaceAdmin.availability')}</h3>

        {spans.length === 0 ? (
          // Aucune déclaration vaut DISPONIBLE dans tout le produit : sept cases
          // grises se liraient comme « ne travaille jamais ».
          <p className="m-0 text-sm text-muted-foreground">
            {provider.weeklyRestricted
              ? t('marketplaceAdmin.noSlots')
              : t('marketplaceAdmin.unrestricted')}
          </p>
        ) : (
          <>
            <div className="baitly-profile-week">
              {DAY_INITIALS.map((initial, index) => {
                const open = openDays.has(index + 1);
                return (
                  <span
                    key={`${initial}-${index}`}
                    title={DAY_NAMES[index]}
                    aria-label={DAY_NAMES[index]}
                    className={cn(
                      'inline-flex size-7 items-center justify-center rounded-md text-xs font-semibold',
                      open ? 'bg-success-soft text-success-ink' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {DAY_NAMES[index].slice(0,3)}
                  </span>
                );
              })}
            </div>
            {/* Les jours consécutifs aux mêmes horaires sont fusionnés : une
                semaine régulière tient sur une ligne au lieu de six. */}
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {spans.map((span) => (
                <li key={span.days} className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="text-foreground">{span.days}</span>
                  <span className="tabular-nums text-muted-foreground">{span.hours}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Écran ──────────────────────────────────────────────────────────────────

export default function MarketplaceProviderDetailPage() {
  const { t, STATUS_LABELS, ENGAGEMENT_LABELS, ENGAGEMENT_HINTS, COMPLIANCE_LABELS, SOURCE_LABELS, formatDate, formatMoney } = useMarketplacePresentation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams,setSearchParams]=useSearchParams();
  const providerId = id ? Number(id) : undefined;

  const { data: provider, isLoading, isError } = useMarketplaceProvider(providerId);
  const updateStatus = useUpdateProviderStatus();
  const updateEngagement = useUpdateProviderEngagement();
  const [editing,setEditing]=useState(() => searchParams.get('edit')==='1');
  const finishEditing=() => {
    setEditing(false);
    if(searchParams.has('edit')) {
      const next=new URLSearchParams(searchParams);next.delete('edit');setSearchParams(next,{replace:true});
    }
  };

  const [pendingStatus, setPendingStatus] = useState<ProviderStatus | ''>('');
  const [reviewNote, setReviewNote] = useState('');
  const [decisionMessage, setDecisionMessage] = useState('');

  // Un refus sans motif est refusé par le serveur : la contrainte est répétée
  // ici pour la dire AVANT l'envoi plutôt qu'en message d'erreur après.
  const noteRequired = pendingStatus === 'REJECTED';
  const canSubmitStatus =
    pendingStatus !== '' &&
    pendingStatus !== provider?.status &&
    (!['ACTIVE', 'REJECTED'].includes(pendingStatus) || !!provider?.emailConfirmedAt) &&
    (!noteRequired || (decisionMessage.trim().length > 0 && reviewNote.trim().length > 0));

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-28 w-full shrink-0 rounded-lg" />
        <div className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-3">
          <Skeleton className="h-80 w-full rounded-lg lg:col-span-2" />
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError || !provider) {
    return (
      <EmptyState
        icon={<PersonSearch />}
        title={t(isError ? 'marketplaceAdmin.failed' : 'marketplaceAdmin.notFound')}
        description={isError ? undefined : t('marketplaceAdmin.notFoundHint')}
        action={
          <Button variant="outline" size="sm" onClick={() => navigate('/marketplace/providers')}>
            <ArrowBack className="size-4" />{t('marketplaceAdmin.backCatalogue')}</Button>
        }
      />
    );
  }

  const insurance = complianceState(provider.insuranceExpiresAt);
  const vigilance = complianceState(provider.vigilanceExpiresAt);
  const location = [provider.baseAddress, provider.basePostalCode, provider.baseCity]
    .filter(Boolean).join(', ');

  return (
    <>
      <PageHeader
        title={provider.displayName}
        subtitle={provider.headline ?? provider.legalName ?? t('marketplaceAdmin.professional')}
        actions={
          <><Button variant="outline" size="sm" onClick={() => navigate('/marketplace/providers')}>
            <ArrowBack className="size-4" />{t('marketplaceAdmin.catalogue')}</Button>
            {!editing && <Button size="sm" onClick={() => setEditing(true)}><Edit className="size-4" />{t('providerEdit.edit')}</Button>}</>
        }
      />

      {/* ─── Identité ────────────────────────────────────────────────── */}
      {editing ? <BaitlyProviderEditor key={provider.id} provider={provider} onCancel={finishEditing} onSaved={finishEditing} /> : <>
      <div className="baitly-provider-profile">
      <BaitlyProviderIdentity name={provider.displayName} headline={provider.headline ?? provider.legalName}
        bio={provider.bio} url={provider.avatarUrl} categoryCodes={provider.offers.map(o => o.categoryCode)}
        location={location} languages={provider.languages} rating={provider.ratingAvg}
        ratingCount={provider.ratingCount} completedMissions={provider.completedMissions}
        badges={<>
          <StatusChip dot tone={STATUS_TONES[provider.status]} label={STATUS_LABELS[provider.status]} />
          <StatusChip tone={ENGAGEMENT_TONES[provider.engagementMode]} label={ENGAGEMENT_LABELS[provider.engagementMode]} />
          {provider.verified && <StatusChip tone="ok" icon={<Verified />} label={t('marketplaceAdmin.verified')} />}
          {provider.complianceAlert && <StatusChip tone="err" icon={<WarningAmber />} label={t('marketplaceAdmin.renew')} />}
          {provider.acceptsUrgent && <StatusChip tone="info" label={t('marketplaceAdmin.urgent')} />}
        </>}>
        <a href={`mailto:${provider.email}`}><Email size={16} />{provider.email}</a>
        {provider.phone && <a href={`tel:${provider.phone}`}><Phone size={16} />{provider.phone}</a>}
        {provider.website && <a href={provider.website} target="_blank" rel="noopener noreferrer"><OpenInNew size={16} />{t('marketplaceAdmin.website')}</a>}
        {provider.avgResponseMinutes != null && <span className="tabular-nums">{t('marketplaceAdmin.response')} : {provider.avgResponseMinutes} min</span>}
      </BaitlyProviderIdentity>

      <div className="baitly-profile-layout">
        <div>
          <Section
            title={t('marketplaceAdmin.services')}
            aside={
              <span className="text-xs text-muted-foreground">
                {t('marketplaceAdmin.serviceCount', { count: provider.offers.length })}
              </span>
            }
          >
            <OffersByCategory offers={provider.offers} />

            {/* Les conditions QUALIFIENT ces prix : les loger dans une carte
                séparée de l'autre colonne obligeait à faire l'aller-retour pour
                lire un tarif complet. */}
            <div className="mt-4 border-t border-border pt-3">
              <h4 className="m-0 mb-2 text-xs font-medium text-muted-foreground">{t('marketplaceAdmin.commercialTerms')}</h4>
              <DataList
                emptyLabel={t('marketplaceAdmin.noTerms', { currency: provider.currency })}
                rows={[
                  {
                    label: t('marketplaceAdmin.minimumCharge'),
                    value: provider.minimumCharge != null
                      ? formatMoney(provider.minimumCharge, provider.currency) : null,
                  },
                  {
                    label: t('marketplaceAdmin.travelFee'),
                    value: provider.travelFee != null
                      ? formatMoney(provider.travelFee, provider.currency) : null,
                  },
                  {
                    label: t('marketplaceAdmin.leadTime'),
                    value: provider.leadTimeHours != null ? `${provider.leadTimeHours} h` : null,
                  },
                  {
                    label: t('marketplaceAdmin.cancelNotice'),
                    value: provider.cancellationNoticeHours != null
                      ? `${provider.cancellationNoticeHours} h` : null,
                  },
                ]}
              />
            </div>
          </Section>

          <Section title={t('marketplaceAdmin.coverageAvailability')}>
            <Coverage provider={provider} />
          </Section>
        </div>

        {/* ─── Colonne de droite ─────────────────────────────────────── */}
        <aside>
          <Section
            title={t('marketplace.review.documentDates')}
            aside={provider.complianceAlert
              ? <StatusChip size="sm" tone="warn" label={t('marketplace.review.checkExpiry')} />
              : undefined}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{t('marketplaceAdmin.insurance')}{provider.insuranceExpiresAt && (
                    <span className="ms-1 tabular-nums">({formatDate(provider.insuranceExpiresAt)})</span>
                  )}
                </span>
                <StatusChip size="sm" tone={COMPLIANCE_TONES[insurance]} label={COMPLIANCE_LABELS[insurance]} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{t('marketplaceAdmin.vigilance')}{provider.vigilanceExpiresAt && (
                    <span className="ms-1 tabular-nums">({formatDate(provider.vigilanceExpiresAt)})</span>
                  )}
                </span>
                <StatusChip size="sm" tone={COMPLIANCE_TONES[vigilance]} label={COMPLIANCE_LABELS[vigilance]} />
              </div>
            </div>

            <div className="mt-3 border-t border-border pt-3">
              <DataList
                emptyLabel={t('marketplaceAdmin.noBusinessIdentity')}
                rows={[
                  { label: 'SIRET / ICE', value: provider.registrationNumber },
                  { label: t('marketplaceAdmin.vat'), value: provider.vatNumber },
                  { label: t('marketplaceAdmin.insurer'), value: provider.insuranceCompany },
                  { label: t('marketplaceAdmin.policy'), value: provider.insurancePolicyNumber },
                ]}
              />
            </div>

            <p className="m-0 mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
              {t('marketplace.review.documentPolicyPending')}
            </p>
          </Section>

          <Section title={t('marketplaceAdmin.affiliation')}>
            <DataList
              emptyLabel={t('marketplaceAdmin.noAffiliation')}
              rows={[
                {
                  label: t('marketplaceAdmin.homeOrg'),
                  value: provider.homeOrganizationName ? (
                    <span className="inline-flex items-center gap-1">
                      <Business className="size-3.5 text-muted-foreground" />
                      {provider.homeOrganizationName}
                    </span>
                  ) : null,
                },
                { label: t('marketplaceAdmin.userAccount'), value: provider.userId != null ? `#${provider.userId}` : null },
                { label: t('marketplaceAdmin.source'), value: SOURCE_LABELS[provider.source] ?? provider.source },
                { label: t('marketplaceAdmin.registeredAt'), value: formatDate(provider.createdAt) },
                {
                  label: t('marketplaceAdmin.lastActive'),
                  value: provider.lastActiveAt ? formatDate(provider.lastActiveAt) : null,
                },
              ]}
            />

            <div className="mt-3 border-t border-border pt-3">
              <p className="m-0 mb-2 text-xs leading-relaxed text-muted-foreground">
                {ENGAGEMENT_HINTS[provider.engagementMode]}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ENGAGEMENT_ORDER.map((mode) => (
                  <Button
                    key={mode}
                    size="sm"
                    variant={mode === provider.engagementMode ? 'default' : 'outline'}
                    disabled={
                      mode === provider.engagementMode ||
                      updateEngagement.isPending ||
                      // Rattacher exige une organisation : sans elle le serveur
                      // refuse, et proposer le bouton promettrait l'impossible.
                      (mode !== 'INDEPENDENT' && provider.homeOrganizationId == null)
                    }
                    title={
                      mode !== 'INDEPENDENT' && provider.homeOrganizationId == null
                        ? t('marketplaceAdmin.linkOrgFirst')
                        : ENGAGEMENT_HINTS[mode]
                    }
                    onClick={() => updateEngagement.mutate({
                      id: provider.id,
                      engagementMode: mode,
                      organizationId: provider.homeOrganizationId ?? null,
                    })}
                  >
                    {ENGAGEMENT_LABELS[mode]}
                  </Button>
                ))}
              </div>
            </div>
          </Section>

        </aside>
      </div>
      <details className="baitly-profile-management">
        <summary>{t('providerProfile.management')}</summary>
        <div className="baitly-profile-management__body">
          <div>
            <ProviderProvisioningPanel key={provider.id} provider={provider} />
            <ProviderNotificationStatus providerId={provider.id} />
            <ProviderDecisionJournal providerId={provider.id} />
          </div>
          <div>
          <ApplicationDocuments providerId={provider.id} emailConfirmed={!!provider.emailConfirmedAt} />
          <ProviderDocumentaryPanel key={provider.id} providerId={provider.id} />

          <ExposurePanel providerId={provider.id} />

          <Section title={t('marketplaceAdmin.moderation')}>
            <DataList
              emptyLabel={t('marketplaceAdmin.neverReviewed')}
              rows={[
                { label: t('marketplaceAdmin.application'), value: provider.submittedAt ? formatDate(provider.submittedAt) : null },
                { label: t('marketplaceAdmin.publication'), value: provider.activatedAt ? formatDate(provider.activatedAt) : null },
                { label: t('marketplaceAdmin.suspension'), value: provider.suspendedAt ? formatDate(provider.suspendedAt) : null },
                { label: t('marketplaceAdmin.verification'), value: provider.verifiedAt ? formatDate(provider.verifiedAt) : null },
                {
                  label: t('marketplaceAdmin.confirmedEmail'),
                  value: provider.emailConfirmedAt ? formatDate(provider.emailConfirmedAt) : null,
                },
                {
                  // Absente sur les fiches reprises d'un compte interne :
                  // personne n'a rien accepté pour elles, et la ligne ne
                  // s'affiche donc pas plutôt que d'annoncer une fausse preuve.
                  label: t('marketplaceAdmin.acceptedTerms'),
                  value: provider.termsAcceptedAt
                    ? `${formatDate(provider.termsAcceptedAt)}${provider.termsVersion ? ` · version ${provider.termsVersion}` : ''}`
                    : null,
                },
              ]}
            />

            <ProviderRetentionPanel key={provider.id} providerId={provider.id} />

            {provider.reviewNote && (
              <div className="mt-2.5 rounded-md bg-muted px-2.5 py-2">
                <p className="m-0 mb-1 text-xs font-semibold  text-muted-foreground">{t('marketplaceAdmin.internalNote')}</p>
                <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                  {provider.reviewNote}
                </p>
              </div>
            )}

            {provider.decisionMessage && (
              <div className="mt-2 rounded-md border border-border px-2.5 py-2">
                <p className="m-0 mb-1 text-xs font-semibold  text-muted-foreground">
                  {/* La date d'envoi est ce qui distingue un message rédigé d'un
                      message effectivement parti — sans elle on réécrit une
                      décision déjà annoncée. */}
                  {provider.decisionSentAt
                    ? t('marketplaceAdmin.sentAt', { date: formatDate(provider.decisionSentAt) })
                    : t('marketplaceAdmin.draftMessage')}
                </p>
                <p className="m-0 whitespace-pre-line text-xs leading-relaxed text-foreground">
                  {provider.decisionMessage}
                </p>
              </div>
            )}

            {!provider.emailConfirmedAt && provider.status !== 'ACTIVE' && (
              <p className="m-0 mt-2.5 flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning-soft px-2.5 py-2 text-xs leading-relaxed text-warning-ink [&>svg]:mt-0.5 [&>svg]:size-3.5 [&>svg]:shrink-0">
                <WarningAmber />
                {/* Le dire ici, et pas seulement au moment du refus serveur :
                    un modérateur qui découvre la règle en la heurtant perd son
                    texte de décision au passage. */}
                {t('marketplace.review.confirmEmailFirst')}
              </p>
            )}

            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
              <Select
                value={pendingStatus || undefined}
                onValueChange={(value) => setPendingStatus(value as ProviderStatus)}
              >
                <SelectTrigger size="sm">
                  <SelectValue placeholder={t('marketplaceAdmin.changeStatus')} />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.filter((status) => status !== provider.status).map((status) => (
                    <SelectItem key={status} value={status} disabled={!provider.emailConfirmedAt && ['ACTIVE', 'REJECTED'].includes(status)}>{STATUS_LABELS[status]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {pendingStatus && (
                <>
                  {/* Deux champs parce qu'il y a deux lecteurs. Un seul
                      donnait soit une note franche qu'on n'ose pas envoyer,
                      soit un message diplomatique inutile à l'équipe. */}
                  <Textarea
                    value={decisionMessage}
                    onChange={(event) => setDecisionMessage(event.target.value)}
                    maxLength={2000}
                    rows={4}
                    placeholder={noteRequired
                      ? t('marketplaceAdmin.messageRequired')
                      : t('marketplaceAdmin.messageOptional')}
                    aria-label={t('marketplaceAdmin.candidateMessage')}
                  />
                  <Textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder={t('marketplaceAdmin.internalNoteHint')}
                    aria-label={t('marketplaceAdmin.moderationNote')}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!canSubmitStatus || updateStatus.isPending}
                      onClick={() => updateStatus.mutate(
                        {
                          id: provider.id,
                          status: pendingStatus as ProviderStatus,
                          reviewNote: reviewNote.trim() || undefined,
                          decisionMessage: decisionMessage.trim() || undefined,
                        },
                        {
                          onSuccess: () => {
                            setPendingStatus(''); setReviewNote(''); setDecisionMessage('');
                          },
                        },
                      )}
                    >{t('marketplaceAdmin.apply')}</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setPendingStatus(''); setReviewNote(''); setDecisionMessage('');
                      }}
                    >{t('marketplaceAdmin.cancel')}</Button>
                  </div>
                  {noteRequired && (decisionMessage.trim().length === 0 || reviewNote.trim().length === 0) && (
                    <p className="m-0 text-xs text-warning-ink">
                      {t('marketplace.review.rejectionRequiresBoth')}
                    </p>
                  )}
                </>
              )}

              {updateStatus.isError && (
                <p className="m-0 text-xs text-destructive-ink">
                  {/* Le serveur explique POURQUOI il refuse — une adresse non
                      confirmée, un motif manquant. Afficher « Réessayez » par
                      dessus invitait à une action qui ne pouvait pas aboutir. */}
                  {statusErrorMessage(updateStatus.error)}
                </p>
              )}
            </div>
          </Section>
          </div>
        </div>
      </details>
      </div>
      </>}
    </>
  );
}

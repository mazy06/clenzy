import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Alert as UiAlert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import {
  Spinner,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { useTabKeyParam } from '../../components/tabKeyParam';
import { useNotification } from '../../hooks/useNotification';
import {  Edit,
  Home,
  LocationOn,
  Bed,
  Bathroom,
  SquareFoot,
  Person,
  CleaningServices,
  Build,
  Info,
  CalendarMonth,
  Schedule,
  Stairs,
  Deck,
  LocalLaundryService,
  Timer,
  Payments,
  Window,
  Iron,
  Kitchen,
  Sanitizer,
  Login,
  Logout,
  Flag,
  Group,
  Hub,
  Sync,
  CheckCircle,
  Error as ErrorMuiIcon,
  FlightLand,
  Wifi,
  VpnKey,
  LocalParking,
  Gavel,
  Phone,
  OpenInNew,
  PhotoLibrary,
  Inventory2,
  GppGood,
  Send,
  Star,
} from '../../icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { documentsApi } from '../../services/api/documentsApi';
import { usePropertyDetails } from '../../hooks/usePropertyDetails';
import type { PropertyDetailsData } from '../../hooks/usePropertyDetails';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import { Money } from '../../components/Money';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDate } from '../../utils/formatUtils';
import DescriptionNotesDisplay from '../../components/DescriptionNotesDisplay';
import CheckInInstructionsForm from '../channels/CheckInInstructionsForm';
import PropertyPhotosTab from './PropertyPhotosTab';
import PropertyInventoryTab from './PropertyInventoryTab';
import PropertyComplianceTab from './PropertyComplianceTab';
import PropertyInterventionsTab from './PropertyInterventionsTab';
import ReviewList from '../channels/reviews/ReviewList';
import airbnbLogoSmall from '../../assets/logo/airbnb-logo-small.svg';
import bookingLogoSmall from '../../assets/logo/booking-logo-small.svg';
import hotelsComLogo from '../../assets/logo/hotels-com-logo-small.svg';
import agodaLogo from '../../assets/logo/agoda-logo-small.svg';
import vrboLogo from '../../assets/logo/vrbo-logo-small.svg';
import abritelLogo from '../../assets/logo/abritel-logo-small.svg';
import expediaLogo from '../../assets/logo/expedia-logo.png';
import {
  getPropertyStatusLabel,
  getPropertyTypeLabel,
  getCleaningFrequencyLabel,
} from '../../utils/statusUtils';
import { propertyStatusTokens, FIELD_TOKENS, FIELD_CHIP_CLASS } from './propertiesListConstants';
import { airbnbApi } from '../../services/api/airbnbApi';
import { MapboxPropertyMap } from '../../components/MapboxPropertyMap';
import { PropertyImageCarousel } from '../../components/PropertyImageCarousel';
import { propertyPhotosApi } from '../../services/api/propertyPhotosApi';
import { useQuery } from '@tanstack/react-query';

// ─── Gabarits de la fiche bien (Baitly UI) ──────────────────────────────────

// Tuile KPI centrée : pastille d'icône `primary-soft`, valeur display
// tabular-nums, libellé en sur-ligne. Le survol se dit par le fond, jamais par
// un liseré coloré.
const METRIC_CARD_CLASS =
  'flex flex-col items-center justify-center text-center py-[14px] px-3 bg-card '
  + 'border border-solid border-border rounded-xl min-h-[72px] '
  + 'transition-colors duration-150 motion-reduce:transition-none hover:bg-muted/40';

const METRIC_ICON_BADGE_CLASS =
  'w-8 h-8 rounded-md bg-primary-soft text-primary flex items-center justify-center mb-2';

const METRIC_VALUE_CLASS =
  '[font-family:var(--font-display)] text-lg font-semibold text-foreground leading-[1.2] tabular-nums tracking-[-0.01em]';

const METRIC_LABEL_CLASS = 'text-2xs font-semibold text-faint uppercase tracking-wide mt-[3px]';

// Sur-ligne de section (recette « overline » de l'échelle typographique).
const SECTION_TITLE_CLASS = 'text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5';

// Bloc label/valeur : icône primaire, libellé muted, valeur en encre de corps.
const INFO_ROW_CLASS = 'flex items-center gap-1.5 py-[4.5px]';

const INFO_LABEL_CLASS = 'text-xs font-medium text-muted-foreground';

const INFO_VALUE_CLASS = 'text-sm font-semibold text-foreground mt-px';

/** Icône inline d'un bloc label/valeur. */
const INFO_ICON_CLASS = 'inline-flex text-primary';

// Carte hairline plate.
// `border-solid` est obligatoire : sans preflight Tailwind, `border` seul donne une
// largeur mais un style `none` — bordure invisible.
const CARD_CLASS =
  'border border-solid border-border bg-card shadow-none rounded-xl py-4 px-[18px]';

// ─── Cleaning price estimation (mirrored from CleaningPriceEstimator) ───────

const SURFACE_BASE_PRICE: { maxSurface: number | null; base: number }[] = [
  { maxSurface: 30, base: 35 },
  { maxSurface: 50, base: 45 },
  { maxSurface: 70, base: 55 },
  { maxSurface: 100, base: 70 },
  { maxSurface: 150, base: 90 },
  { maxSurface: null, base: 110 },
];

const SURCHARGES = {
  perBedroom: 5,
  perBathroom: 4,
  perFloor: 8,
  exterior: 12,
  laundry: 8,
  perGuestAbove4: 3,
} as const;

function getSurfaceBasePrice(sqm: number): number {
  for (const tier of SURFACE_BASE_PRICE) {
    if (tier.maxSurface === null || sqm <= tier.maxSurface) return tier.base;
  }
  return SURFACE_BASE_PRICE[SURFACE_BASE_PRICE.length - 1].base;
}

function computeCleaningEstimate(
  sqm: number,
  bedrooms: number,
  bathrooms: number,
  maxGuests: number,
  floors: number | undefined,
  hasExterior: boolean,
  hasLaundry: boolean,
  cleaningBasePrice: number | undefined,
): { min: number; max: number } {
  const base = (cleaningBasePrice != null && cleaningBasePrice > 0)
    ? cleaningBasePrice
    : getSurfaceBasePrice(sqm);

  let surcharge = 0;
  surcharge += Math.max(0, bedrooms - 1) * SURCHARGES.perBedroom;
  surcharge += Math.max(0, bathrooms - 1) * SURCHARGES.perBathroom;
  if (floors != null && floors > 1) surcharge += (floors - 1) * SURCHARGES.perFloor;
  if (hasExterior) surcharge += SURCHARGES.exterior;
  if (hasLaundry) surcharge += SURCHARGES.laundry;
  if (maxGuests > 4) surcharge += (maxGuests - 4) * SURCHARGES.perGuestAbove4;

  const raw = base + surcharge;
  const min = Math.max(30, Math.round(raw / 5) * 5);
  const max = min; // Standard type (coeff 1.0)
  return { min, max };
}

// ─── Re-export type for backward compatibility ─────────────────────────────

export type { PropertyDetailsData };

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(time: string | undefined): string {
  if (!time) return '—';
  // Handle "HH:mm:ss" or "HH:mm" formats
  return time.substring(0, 5);
}

// Onglets de la fiche bien — `key` stable pour l'URL (?tab=<key>) ; useTabKeyParam derive
// l'index visible depuis la cle.
//
// DOIT rester aligne, dans le meme ORDRE, avec les `options` passees a <PageTabs> plus bas :
// un onglet absent d'ici est inatteignable. `tabKeyFromIndex` renvoie alors `undefined`,
// `useTabKeyParam` efface le parametre `tab`, et le clic renvoie sur "Vue d'ensemble" —
// exactement ce qui arrivait a "Conformite", jamais declaree ici.
const detailTabs = [
  { key: 'overview', hidden: false },
  { key: 'interventions', hidden: false },
  { key: 'channels', hidden: false },
  { key: 'check-in', hidden: false },
  { key: 'photos', hidden: false },
  { key: 'inventory', hidden: false },
  { key: 'compliance', hidden: false },
  { key: 'reviews', hidden: false },
];

// ─── Main component ─────────────────────────────────────────────────────────

const PropertyDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();

  // ─── React Query ────────────────────────────────────────────────────────
  const { property, interventions, isLoading, isError, error } = usePropertyDetails(id);

  // ─── Photos pour le carrousel (source de verite : endpoint photos) ──────
  const photosQuery = useQuery({
    queryKey: ['property-photos', id],
    queryFn: () => propertyPhotosApi.list(Number(id)),
    enabled: !!id,
    staleTime: 60_000,
  });

  const photoUrls = useMemo(() => {
    const photos = photosQuery.data ?? [];
    return [...photos]
      .sort((a, b) => {
        const s = a.sortOrder - b.sortOrder;
        return s !== 0 ? s : a.id - b.id;
      })
      .map((p) => propertyPhotosApi.getPhotoUrl(Number(id), p.id));
  }, [photosQuery.data, id]);

  const [canEdit, setCanEdit] = useState(false);
  // Devis ménage (Moteur Ménage 3A) : confirmation + envoi au propriétaire.
  const [cleaningQuoteDialogOpen, setCleaningQuoteDialogOpen] = useState(false);
  const [cleaningQuoteSending, setCleaningQuoteSending] = useState(false);
  const { notify } = useNotification();

  const handleSendCleaningQuote = async () => {
    setCleaningQuoteSending(true);
    try {
      await documentsApi.sendCleaningQuote(Number(id));
      notify.success(t('properties.cleaningQuote.sent'));
      setCleaningQuoteDialogOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error && err.message ? err.message : t('properties.cleaningQuote.error');
      notify.error(message);
    } finally {
      setCleaningQuoteSending(false);
    }
  };
  const [tabValue, setTabValue] = useTabKeyParam(detailTabs);
  const [channelStatus, setChannelStatus] = useState<{ airbnb: { linked: boolean; syncEnabled: boolean; lastSyncAt: string | null; status: string } } | null>(null);

  // ─── Permissions (lightweight, kept as useEffect) ───────────────────────
  useEffect(() => {
    const checkPermissions = async () => {
      const canEditPermission = await hasPermissionAsync('properties:edit');
      setCanEdit(canEditPermission);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  // ─── Channel status ───────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    airbnbApi.getPropertyChannelStatus(Number(id))
      .then(setChannelStatus)
      .catch(() => { /* No channel data yet */ });
  }, [id]);

  // ─── Cleaning price estimation ───────────────────────────────────────────
  const cleaningEstimate = useMemo(() => {
    if (!property) return null;
    const sqm = property.surfaceArea ?? 0;
    const bedrooms = property.bedrooms ?? 1;
    if (sqm <= 0 && !(property.cleaningBasePrice != null && property.cleaningBasePrice > 0)) return null;

    return computeCleaningEstimate(
      sqm,
      bedrooms,
      property.bathrooms ?? 1,
      property.maxGuests ?? 2,
      property.numberOfFloors ?? undefined,
      property.hasExterior ?? false,
      property.hasLaundry ?? false,
      property.cleaningBasePrice ?? undefined,
    );
  }, [property]);

  // ─── Feature chips (active options) ─────────────────────────────────────
  const featureChips = useMemo(() => {
    if (!property) return [];
    const chips: { label: string }[] = [];

    if (property.hasExterior) chips.push({ label: t('properties.hasExterior') });
    if (property.hasLaundry) chips.push({ label: t('properties.hasLaundry') });
    if ((property.windowCount ?? 0) > 0 || (property.frenchDoorCount ?? 0) > 0 || (property.slidingDoorCount ?? 0) > 0) {
      const parts = [
        (property.windowCount ?? 0) > 0 && `${property.windowCount} ${t('properties.addOnServices.windowCountShort')}`,
        (property.frenchDoorCount ?? 0) > 0 && `${property.frenchDoorCount} ${t('properties.addOnServices.frenchDoorCountShort')}`,
        (property.slidingDoorCount ?? 0) > 0 && `${property.slidingDoorCount} ${t('properties.addOnServices.slidingDoorCountShort')}`,
      ].filter(Boolean).join(', ');
      chips.push({ label: `${t('properties.addOnServices.windows')}: ${parts}` });
    }
    if (property.hasIroning) chips.push({ label: t('properties.addOnServices.hasIroning') });
    if (property.hasDeepKitchen) chips.push({ label: t('properties.addOnServices.hasDeepKitchen') });
    if (property.hasDisinfection) chips.push({ label: t('properties.addOnServices.hasDisinfection') });
    if (property.numberOfFloors != null && property.numberOfFloors > 1) {
      chips.push({ label: `${property.numberOfFloors} ${t('properties.numberOfFloors').toLowerCase()}` });
    }

    return chips;
  }, [property, t]);

  // ─── Loading / Error states ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Spinner className="size-7" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-3">
        <UiAlert variant="destructive" className="py-1 text-[0.8125rem]">
          <TriangleAlert />
          <AlertDescription>{error || t('properties.loadError')}</AlertDescription>
        </UiAlert>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="p-3">
        <UiAlert variant="warning" className="py-1 text-[0.8125rem]">
          <TriangleAlert />
          <AlertDescription>{t('properties.notFound')}</AlertDescription>
        </UiAlert>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0">
        <PageHeader
          title={property.name}
          subtitle={`${getPropertyTypeLabel(property.propertyType, t)} · ${property.city}`}
          iconBadge={<Home />}
          backPath="/properties"
          actions={
            <div className="flex items-center gap-1">
              {canEdit && (
                <Button
                  variant="outline"
                  onClick={() => setCleaningQuoteDialogOpen(true)}
                  size="sm"
                  title={t('properties.cleaningQuote.button')}
                >
                  <Send size={16} strokeWidth={1.75} />
                  {t('properties.cleaningQuote.button')}
                </Button>
              )}
              {canEdit && (
                <Button
                  onClick={() => navigate(`/properties/${id}/edit`)}
                  size="sm"
                  title={t('properties.modify')}
                >
                  <Edit size={16} strokeWidth={1.75} />
                  {t('properties.modify')}
                </Button>
              )}
            </div>
          }
        />
      </div>

      {/* ─── Tabs (primitive PageTabs — onglets niveau 1 soulignés accent) ── */}
      <div className="shrink-0">
        <PageTabs
          ariaLabel={t('properties.details')}
          mb={0}
          options={[
            { key: 'overview', label: t('properties.tabs.overview'), icon: <Info /> },
            { key: 'interventions', label: `${t('properties.tabs.interventions')} (${interventions.length})`, icon: <Build /> },
            { key: 'channels', label: t('channels.title'), icon: <Hub /> },
            { key: 'check-in', label: t('channels.checkIn.title'), icon: <FlightLand /> },
            { key: 'photos', label: t('properties.tabs.photos'), icon: <PhotoLibrary /> },
            { key: 'inventory', label: 'Inventaire', icon: <Inventory2 /> },
            { key: 'compliance', label: t('properties.tabs.compliance', 'Conformité'), icon: <GppGood /> },
            // Ajouté EN FIN de liste : les panneaux sont adressés par index,
            // insérer ailleurs décalerait silencieusement tous les suivants.
            { key: 'reviews', label: t('properties.tabs.reviews', 'Avis'), icon: <Star /> },
          ]}
          value={tabValue}
          onChange={setTabValue}
        />
      </div>

      {/* ─── Tab 0: Vue d'ensemble ───────────────────────────────────────── */}
      {tabValue === 0 && (
        <div className="pt-2 flex-1 min-h-0 overflow-auto" role="tabpanel" id="property-tabpanel-0" aria-labelledby="property-tab-0">
          {/* ── Key metrics grid ──────────────────────────────────────── */}
          <div className={cn('grid grid-cols-12 gap-1.5', featureChips.length > 0 ? 'mb-1.5' : 'mb-[9px]')}>
            <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(METRIC_CARD_CLASS, 'cursor-help')}>
                    <div className={METRIC_ICON_BADGE_CLASS}><Payments size={16} strokeWidth={1.75} /></div>
                    <p className={METRIC_VALUE_CLASS}>
                      {cleaningEstimate ? <Money value={cleaningEstimate.min} from="EUR" decimals={0} /> : '—'}
                    </p>
                    <p className={METRIC_LABEL_CLASS}>{t('properties.cleaningEstimate')}</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">{t('properties.cleaningEstimateTooltip')}</TooltipContent>
              </Tooltip>
            </div>
            <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-2">
              <div className={METRIC_CARD_CLASS}>
                <div className={METRIC_ICON_BADGE_CLASS}><Bed size={16} strokeWidth={1.75} /></div>
                <p className={METRIC_VALUE_CLASS}>{property.bedrooms}</p>
                <p className={METRIC_LABEL_CLASS}>{t('properties.bedrooms')}</p>
              </div>
            </div>
            <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-2">
              <div className={METRIC_CARD_CLASS}>
                <div className={METRIC_ICON_BADGE_CLASS}><Bathroom size={16} strokeWidth={1.75} /></div>
                <p className={METRIC_VALUE_CLASS}>{property.bathrooms}</p>
                <p className={METRIC_LABEL_CLASS}>{t('properties.bathroomCount')}</p>
              </div>
            </div>
            <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-2">
              <div className={METRIC_CARD_CLASS}>
                <div className={METRIC_ICON_BADGE_CLASS}><SquareFoot size={16} strokeWidth={1.75} /></div>
                <p className={METRIC_VALUE_CLASS}>{property.surfaceArea} m²</p>
                <p className={METRIC_LABEL_CLASS}>{t('properties.surface')}</p>
              </div>
            </div>
            <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-2">
              <div className={METRIC_CARD_CLASS}>
                <div className={METRIC_ICON_BADGE_CLASS}><Group size={16} strokeWidth={1.75} /></div>
                <p className={METRIC_VALUE_CLASS}>{property.maxGuests}</p>
                <p className={METRIC_LABEL_CLASS}>{t('properties.maxCapacity')}</p>
              </div>
            </div>
            <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-2">
              <div className={METRIC_CARD_CLASS}>
                <div className={METRIC_ICON_BADGE_CLASS}><CleaningServices size={16} strokeWidth={1.75} /></div>
                {/* leading-[1.2] repose apres la taille : tailwind-merge
                    supprime un `leading-*` place avant une classe `text-[taille]`. */}
                <p className={cn(METRIC_VALUE_CLASS, 'text-[12.5px] leading-[1.2]')}>
                  {getCleaningFrequencyLabel(property.cleaningFrequency, t)}
                </p>
                <p className={METRIC_LABEL_CLASS}>{t('properties.cleaningFrequency')}</p>
              </div>
            </div>
          </div>

          {/* ── Prestations à la carte chips ──────────────────────────── */}
          {featureChips.length > 0 && (
            <div className="flex items-center flex-wrap gap-1 mb-1.5">
              <p className={cn(SECTION_TITLE_CLASS, 'mb-0 me-[3px]')}>
                {t('properties.addOnServices.title')}
              </p>
              {featureChips.map((chip) => (
                <StatusChip
                  key={chip.label}
                  tokens={FIELD_TOKENS}
                  label={chip.label}
                  className={FIELD_CHIP_CLASS}
                />
              ))}
            </div>
          )}

          {/* ── Équipements chips ──────────────────────────────────── */}
          {property.amenities && property.amenities.length > 0 && (
            <div className="flex items-center flex-wrap gap-1 mb-2">
              <p className={cn(SECTION_TITLE_CLASS, 'mb-0 me-[3px]')}>
                {t('properties.amenities.title')}
              </p>
              {property.amenities.map((amenity) => (
                <StatusChip
                  key={amenity}
                  tokens={FIELD_TOKENS}
                  label={t(`properties.amenities.items.${amenity}`)}
                  className={FIELD_CHIP_CLASS}
                />
              ))}
            </div>
          )}

          {/* ── Row 1: Photos | Informations + Tarification | Configuration ── */}
          <div className={cn(CARD_CLASS, 'mb-[9px]')}>
            <div className="flex gap-3 items-stretch">
              {/* ── Col 1: Photos (carrousel + plein ecran au clic) ──── */}
              <div className="flex-1 min-w-0 flex">
                <PropertyImageCarousel
                  photoUrls={photoUrls}
                  alt={property.name}
                  width="100%"
                  height={{ xs: 240, sm: 280, md: 340 }}
                  alwaysShowNav
                  enableFullscreen
                  showCounter
                  sx={{ width: '100%' }}
                />
              </div>

              <Separator orientation="vertical" />

              {/* ── Col 2: Informations generales + Tarification menage ── */}
              <div className="flex-1 min-w-0">
                <p className={SECTION_TITLE_CLASS}>
                  {t('properties.informationsGeneral')}
                </p>
                <div className={INFO_ROW_CLASS}>
                  <span className={INFO_ICON_CLASS}><LocationOn size={16} strokeWidth={1.75} /></span>
                  <div className="flex-1">
                    <p className={INFO_LABEL_CLASS}>{t('properties.address')}</p>
                    <p className={INFO_VALUE_CLASS}>
                      {property.address}, {property.city} {property.postalCode}
                    </p>
                  </div>
                </div>
                {property.country && (
                  <>
                    <Separator className="my-[3px]" />
                    <div className={INFO_ROW_CLASS}>
                      <span className={INFO_ICON_CLASS}><Flag size={16} strokeWidth={1.75} /></span>
                      <div className="flex-1">
                        <p className={INFO_LABEL_CLASS}>{t('properties.country')}</p>
                        <p className={INFO_VALUE_CLASS}>{property.country}</p>
                      </div>
                    </div>
                  </>
                )}
                <Separator className="my-[3px]" />
                <div className={INFO_ROW_CLASS}>
                  <span className={INFO_ICON_CLASS}><Home size={16} strokeWidth={1.75} /></span>
                  <div className="flex-1">
                    <p className={INFO_LABEL_CLASS}>{t('properties.type')}</p>
                    <p className={INFO_VALUE_CLASS}>{getPropertyTypeLabel(property.propertyType, t)}</p>
                  </div>
                </div>
                {property.createdAt && (
                  <>
                    <Separator className="my-[3px]" />
                    <div className={INFO_ROW_CLASS}>
                      <span className={INFO_ICON_CLASS}><CalendarMonth size={16} strokeWidth={1.75} /></span>
                      <div className="flex-1">
                        <p className={INFO_LABEL_CLASS}>{t('properties.createdAt')}</p>
                        <p className={INFO_VALUE_CLASS}>{formatDate(property.createdAt)}</p>
                      </div>
                    </div>
                  </>
                )}

                <p className={cn(SECTION_TITLE_CLASS, 'mt-[9px]')}>
                  {t('properties.cleaningPricing')}
                </p>
                <div className="flex flex-col gap-0.5">
                  {property.cleaningBasePrice != null && property.cleaningBasePrice > 0 && (
                    <div className={INFO_ROW_CLASS}>
                      <span className={INFO_ICON_CLASS}><Payments size={16} strokeWidth={1.75} /></span>
                      <div>
                        <p className={INFO_LABEL_CLASS}>{t('properties.cleaningBasePrice')}</p>
                        <p className={cn(INFO_VALUE_CLASS, 'tabular-nums [font-family:var(--font-display)]')}><Money value={property.cleaningBasePrice} from="EUR" decimals={0} /></p>
                      </div>
                    </div>
                  )}
                  {property.cleaningDurationMinutes != null && property.cleaningDurationMinutes > 0 && (
                    <div className={INFO_ROW_CLASS}>
                      <span className={INFO_ICON_CLASS}><Timer size={16} strokeWidth={1.75} /></span>
                      <div>
                        <p className={INFO_LABEL_CLASS}>{t('properties.cleaningDuration')}</p>
                        <p className={INFO_VALUE_CLASS}>
                          {property.cleaningDurationMinutes >= 60
                            ? `${Math.floor(property.cleaningDurationMinutes / 60)}h${property.cleaningDurationMinutes % 60 > 0 ? String(property.cleaningDurationMinutes % 60).padStart(2, '0') : ''}`
                            : `${property.cleaningDurationMinutes} min`}
                        </p>
                      </div>
                    </div>
                  )}
                  {property.numberOfFloors != null && property.numberOfFloors > 0 && (
                    <div className={INFO_ROW_CLASS}>
                      <span className={INFO_ICON_CLASS}><Stairs size={16} strokeWidth={1.75} /></span>
                      <div>
                        <p className={INFO_LABEL_CLASS}>{t('properties.numberOfFloors')}</p>
                        <p className={INFO_VALUE_CLASS}>{property.numberOfFloors}</p>
                      </div>
                    </div>
                  )}
                  {property.hasExterior && (
                    <div className={INFO_ROW_CLASS}>
                      <span className={INFO_ICON_CLASS}><Deck size={16} strokeWidth={1.75} /></span>
                      <p className={INFO_VALUE_CLASS}>{t('properties.hasExterior')}</p>
                    </div>
                  )}
                  {property.hasLaundry && (
                    <div className={INFO_ROW_CLASS}>
                      <span className={INFO_ICON_CLASS}><LocalLaundryService size={16} strokeWidth={1.75} /></span>
                      <p className={INFO_VALUE_CLASS}>{t('properties.hasLaundry')}</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator orientation="vertical" />

              {/* ── Col 3: Configuration ───────────────────────────── */}
              <div className="flex-1 min-w-0">
                <p className={SECTION_TITLE_CLASS}>
                  {t('properties.configuration')}
                </p>
                <div className={INFO_ROW_CLASS}>
                  <div>
                    <p className={INFO_LABEL_CLASS}>{t('properties.status')}</p>
                    <StatusChip
                      tokens={propertyStatusTokens(property.status)}
                      label={getPropertyStatusLabel(property.status, t)}
                      className="mt-0.5"
                    />
                  </div>
                </div>
                {property.ownerName && (
                  <>
                    <Separator className="my-[3px]" />
                    <div className={INFO_ROW_CLASS}>
                      <span className={INFO_ICON_CLASS}><Person size={16} strokeWidth={1.75} /></span>
                      <div className="flex-1">
                        <p className={INFO_LABEL_CLASS}>{t('properties.owner')}</p>
                        <p className={INFO_VALUE_CLASS}>{property.ownerName}</p>
                      </div>
                    </div>
                  </>
                )}
                {(property.defaultCheckInTime || property.defaultCheckOutTime) && (
                  <>
                    <Separator className="my-[3px]" />
                    <div className="flex flex-col gap-0.5">
                      {property.defaultCheckInTime && (
                        <div className={INFO_ROW_CLASS}>
                          <span className={INFO_ICON_CLASS}><Login size={16} strokeWidth={1.75} /></span>
                          <div>
                            <p className={INFO_LABEL_CLASS}>{t('properties.checkInTime')}</p>
                            <p className={INFO_VALUE_CLASS}>{formatTime(property.defaultCheckInTime)}</p>
                          </div>
                        </div>
                      )}
                      {property.defaultCheckOutTime && (
                        <div className={INFO_ROW_CLASS}>
                          <span className={INFO_ICON_CLASS}><Logout size={16} strokeWidth={1.75} /></span>
                          <div>
                            <p className={INFO_LABEL_CLASS}>{t('properties.checkOutTime')}</p>
                            <p className={INFO_VALUE_CLASS}>{formatTime(property.defaultCheckOutTime)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
                <Separator className="my-[3px]" />
                <div className={INFO_ROW_CLASS}>
                  <span className={INFO_ICON_CLASS}><CleaningServices size={16} strokeWidth={1.75} /></span>
                  <div className="flex-1">
                    <p className={INFO_LABEL_CLASS}>{t('properties.cleaningFrequency')}</p>
                    <p className={INFO_VALUE_CLASS}>{getCleaningFrequencyLabel(property.cleaningFrequency, t)}</p>
                  </div>
                </div>
                {property.lastCleaning && (
                  <>
                    <Separator className="my-[3px]" />
                    <div className={INFO_ROW_CLASS}>
                      <span className={INFO_ICON_CLASS}><Schedule size={16} strokeWidth={1.75} /></span>
                      <div className="flex-1">
                        <p className={INFO_LABEL_CLASS}>{t('properties.lastCleaning')}</p>
                        <p className={INFO_VALUE_CLASS}>{formatDate(property.lastCleaning)}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

            </div>
          </div>

          {/* ── Row 2: Map + Description | Instructions voyageur ────── */}
          <div className="flex gap-2 mb-2">
            {/* ── Left column: Map + Description ──────────────────── */}
            <div className="flex-[6] min-w-0 flex flex-col gap-[9px]">
              {/* Mini-carte Mapbox */}
              {property.latitude != null && property.longitude != null && (
                <div className={cn(CARD_CLASS, 'p-0 overflow-hidden')}>
                  <MapboxPropertyMap
                    properties={[{
                      lat: property.latitude,
                      lng: property.longitude,
                      name: property.name,
                      id: Number(property.id),
                      type: 'property',
                    }]}
                    center={[property.longitude, property.latitude]}
                    zoom={15}
                    height={220}
                  />
                </div>
              )}

              {/* Description du logement & Consignes de ménage */}
              {(property.description || property.cleaningNotes) && (
                <DescriptionNotesDisplay
                  description={property.description}
                  notes={property.cleaningNotes}
                  variant="cleaning"
                />
              )}
            </div>

            {/* ── Right column: Instructions voyageur ─────────────── */}
            {property.checkInInstructions && (() => {
              const ci = property.checkInInstructions;
              const hasAnyField = ci.accessCode || ci.wifiName || ci.wifiPassword || ci.parkingInfo
                || ci.arrivalInstructions || ci.departureInstructions || ci.houseRules || ci.emergencyContact;
              if (!hasAnyField) return null;

              const fields: { icon: React.ReactNode; label: string; value: string | null }[] = [
                { icon: <span className={INFO_ICON_CLASS}><VpnKey size={16} strokeWidth={1.75} /></span>, label: t('channels.checkIn.accessCode'), value: ci.accessCode },
                { icon: <span className={INFO_ICON_CLASS}><Wifi size={16} strokeWidth={1.75} /></span>, label: t('channels.checkIn.wifiName'), value: ci.wifiName },
                { icon: <span className={INFO_ICON_CLASS}><Wifi size={16} strokeWidth={1.75} /></span>, label: t('channels.checkIn.wifiPassword'), value: ci.wifiPassword },
                { icon: <span className={INFO_ICON_CLASS}><LocalParking size={16} strokeWidth={1.75} /></span>, label: t('channels.checkIn.parkingInfo'), value: ci.parkingInfo },
                { icon: <span className={INFO_ICON_CLASS}><Login size={16} strokeWidth={1.75} /></span>, label: t('channels.checkIn.arrivalInstructions'), value: ci.arrivalInstructions },
                { icon: <span className={INFO_ICON_CLASS}><Logout size={16} strokeWidth={1.75} /></span>, label: t('channels.checkIn.departureInstructions'), value: ci.departureInstructions },
                { icon: <span className={INFO_ICON_CLASS}><Gavel size={16} strokeWidth={1.75} /></span>, label: t('channels.checkIn.houseRules'), value: ci.houseRules },
                { icon: <span className={INFO_ICON_CLASS}><Phone size={16} strokeWidth={1.75} /></span>, label: t('channels.checkIn.emergencyContact'), value: ci.emergencyContact },
              ];

              // Split: first 4 fields in 2-col grid, rest full-width
              const compactFields = fields.slice(0, 4).filter(f => f.value);
              const fullWidthFields = fields.slice(4).filter(f => f.value);

              if (compactFields.length === 0 && fullWidthFields.length === 0) return null;

              return (
                <div className="flex-[6] min-w-0">
                  <div className={CARD_CLASS}>
                    <div className="flex justify-between items-center mb-1.5">
                      <p className={SECTION_TITLE_CLASS}>
                        {t('channels.checkIn.title')}
                      </p>
                      {/* Raccourci discret en tete de carte : `xs` remplace le gabarit 26 px du sx. */}
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setTabValue(3)}
                      >
                        {t('properties.modify')}
                        <OpenInNew size={12} strokeWidth={1.75} />
                      </Button>
                    </div>

                    {/* Compact fields: 2 columns */}
                    {compactFields.length > 0 && (
                      <div className={cn('grid grid-cols-[1fr_1fr] gap-1.5', fullWidthFields.length > 0 ? 'mb-1.5' : 'mb-0')}>
                        {compactFields.map((field) => (
                          <div key={field.label} className={INFO_ROW_CLASS}>
                            {field.icon}
                            <div className="flex-1">
                              <p className={INFO_LABEL_CLASS}>{field.label}</p>
                              <p className={INFO_VALUE_CLASS}>{field.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Full-width fields */}
                    {fullWidthFields.map((field) => (
                      <React.Fragment key={field.label}>
                        <Separator className="my-[3px]" />
                        <div className={INFO_ROW_CLASS}>
                          {field.icon}
                          <div className="flex-1">
                            <p className={INFO_LABEL_CLASS}>{field.label}</p>
                            <p className={cn(INFO_VALUE_CLASS, 'whitespace-pre-line')}>{field.value}</p>
                          </div>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─── Tab 1: Interventions ────────────────────────────────────────── */}
      {tabValue === 1 && (
        <div className="pt-2 flex-1 min-h-0 overflow-auto" role="tabpanel" id="property-tabpanel-1" aria-labelledby="property-tab-1">
          <PropertyInterventionsTab interventions={interventions} propertyId={String(id)} />
        </div>
      )}

      {/* ─── Tab 2: Channels ──────────────────────────────────────────── */}
      {tabValue === 2 && (
        <div className="pt-2 flex-1 min-h-0 overflow-auto" role="tabpanel" id="property-tabpanel-2" aria-labelledby="property-tab-2">
          <div className="grid grid-cols-[repeat(auto-fill,_minmax(280px,_1fr))] gap-[9px]">
            {/* Airbnb — with real status */}
            <div className={CARD_CLASS}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <img className="w-[21px] h-[21px] rounded-[7px] object-contain" src={airbnbLogoSmall} alt="Airbnb" />
                <p className={cn(SECTION_TITLE_CLASS, 'mb-0')}>Airbnb</p>
                <StatusChip tone={channelStatus?.airbnb?.linked ? 'ok' : 'neutral'} label={channelStatus?.airbnb?.linked ? t('channels.connected') : t('channels.notConnected')} className="ms-auto h-[20px]" />
              </div>
              {channelStatus?.airbnb?.linked ? (
                <div className="flex flex-col gap-0.5">
                  <div className={INFO_ROW_CLASS}>
                    <span className={cn('inline-flex', channelStatus.airbnb.syncEnabled ? 'text-success' : 'text-muted-foreground')}><Sync size={16} strokeWidth={1.75} /></span>
                    <div className="flex-1">
                      <p className={INFO_LABEL_CLASS}>{t('channels.syncStatus.title')}</p>
                      <p className={INFO_VALUE_CLASS}>
                        {channelStatus.airbnb.syncEnabled ? t('channels.syncStatus.syncOn') : t('channels.syncStatus.syncOff')}
                      </p>
                    </div>
                  </div>
                  {channelStatus.airbnb.lastSyncAt && (
                    <div className={INFO_ROW_CLASS}>
                      <span className={INFO_ICON_CLASS}><Schedule size={16} strokeWidth={1.75} /></span>
                      <div className="flex-1">
                        <p className={INFO_LABEL_CLASS}>{t('channels.syncStatus.lastSync')}</p>
                        <p className={INFO_VALUE_CLASS}>{new Date(channelStatus.airbnb.lastSyncAt).toLocaleString('fr-FR')}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => navigate('/channels')}>
                  <Hub size={14} strokeWidth={1.75} />
                  {t('channels.listings.linkProperty')}
                </Button>
              )}
            </div>

            {/* Other channels — static cards */}
            {[
              { name: 'Booking.com', logo: bookingLogoSmall },
              { name: 'Expedia', logo: expediaLogo },
              { name: 'Hotels.com', logo: hotelsComLogo },
              { name: 'Agoda', logo: agodaLogo },
              { name: 'Vrbo', logo: vrboLogo },
              { name: 'Abritel', logo: abritelLogo },
            ].map((ch) => (
              <div key={ch.name} className={CARD_CLASS}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <img className="w-[21px] h-[21px] rounded-[7px] object-contain" src={ch.logo} alt={ch.name} />
                  <p className={cn(SECTION_TITLE_CLASS, 'mb-0')}>{ch.name}</p>
                  <StatusChip tone="neutral" label={t('channels.notConnected')} className="ms-auto h-[20px]" />
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate('/channels')}>
                  <Hub size={14} strokeWidth={1.75} />
                  {t('channels.listings.linkProperty')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Tab 3: Instructions voyageur ─────────────────────────────── */}
      {tabValue === 3 && (
        <div className="pt-2 flex-1 min-h-0 overflow-auto" role="tabpanel" id="property-tabpanel-3" aria-labelledby="property-tab-3">
          <CheckInInstructionsForm propertyId={Number(id)} />
        </div>
      )}

      {/* ─── Tab 4: Photos ─────────────────────────────────────────────── */}
      {tabValue === 4 && (
        <div className="pt-2 flex-1 min-h-0 overflow-auto" role="tabpanel" id="property-tabpanel-4" aria-labelledby="property-tab-4">
          <PropertyPhotosTab propertyId={Number(id)} />
        </div>
      )}

      {/* ─── Tab 5: Inventaire ───────────────────────────────────────────── */}
      {tabValue === 5 && (
        <div className="pt-2 flex-1 min-h-0 overflow-auto" role="tabpanel" id="property-tabpanel-5" aria-labelledby="property-tab-5">
          <PropertyInventoryTab propertyId={Number(id)} canEdit={canEdit} />
        </div>
      )}

      {/* ─── Tab 6: Conformité (licences & autorisations, vague M-A) ─────── */}
      {tabValue === 6 && (
        <div className="pt-2 flex-1 min-h-0 overflow-auto" role="tabpanel" id="property-tabpanel-6" aria-labelledby="property-tab-6">
          <PropertyComplianceTab propertyId={Number(id)} canEdit={canEdit} />
        </div>
      )}

      {/* ─── Tab 7: Avis voyageurs (même liste que /channels/reviews, filtrée) ─ */}
      {tabValue === 7 && (
        <div className="pt-2 flex-1 min-h-0 overflow-auto" role="tabpanel" id="property-tabpanel-7" aria-labelledby="property-tab-7">
          <ReviewList propertyId={Number(id)} showStats />
        </div>
      )}

      {/* Devis ménage : confirmation avant envoi au propriétaire */}
      <Dialog open={cleaningQuoteDialogOpen} onOpenChange={(next) => { if (!next) setCleaningQuoteDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('properties.cleaningQuote.confirmTitle')}</DialogTitle>
            <DialogDescription>{t('properties.cleaningQuote.confirmBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setCleaningQuoteDialogOpen(false)} disabled={cleaningQuoteSending}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleSendCleaningQuote}
              disabled={cleaningQuoteSending}
            >
              {cleaningQuoteSending ? <Spinner className="size-3.5" /> : <Send size={14} strokeWidth={1.75} />}
              {t('properties.cleaningQuote.confirmSend')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PropertyDetails;

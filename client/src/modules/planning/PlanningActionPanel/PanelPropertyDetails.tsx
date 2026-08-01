import React, { useState } from 'react';
import StatusChip, { STATUS_TONES } from '../../../components/StatusChip';
import { Spinner } from '../../../components/ui';
import { Typography, Divider, Button, Accordion, AccordionSummary, AccordionDetails, Alert } from '@mui/material';
import {
  Apartment,
  Bed,
  Bathtub,
  SquareFoot,
  People,
  Stairs,
  Schedule,
  AttachMoney,
  CleaningServices,
  ExpandMore,
  OpenInNew,
  Handyman,
  Assignment,
  ArrowForward,
  Lock,
  Wifi,
} from '../../../icons';
import { useNavigate } from 'react-router-dom';
import { usePropertyDetails } from '../../../hooks/usePropertyDetails';
import { useTranslation } from '../../../hooks/useTranslation';
import type { PanelView } from '../types';
import { PropertyImageCarousel } from '../../../components/PropertyImageCarousel';
import { MapboxPropertyMap } from '../../../components/MapboxPropertyMap';
import { formatShortDate, formatTimeFromDate } from '../../../utils/formatUtils';
import { getCleaningFrequencyLabel } from '../../../utils/statusUtils';
import PageTabs from '../../../components/PageTabs';

// ─── Type scale du panneau ───────────────────────────────────────────────────
//
// Hiérarchie à 4 paliers stricts (mêmes constantes que le PropertyTooltip
// pour cohérence visuelle entre les surfaces) :
//
//   TITLE   = 0.875rem (14px)  — nom du logement, panel anchor
//   BODY    = 0.75rem  (12px)  — texte de contenu (adresse, titre d'item,
//                                 valeur d'info config ménage)
//   LABEL   = 0.625rem (10px)  — section headings uppercase, sub-info meta
//   MICRO   = 0.5625rem (9px)  — labels de stat tiles, chips,
//                                 footer "Voir tout"

const TITLE_FS = '0.875rem';
const BODY_FS  = '0.75rem';
const LABEL_FS = '0.625rem';
const MICRO_FS = '0.5625rem';

const SECTION_TITLE_SX = {
  fontSize: LABEL_FS,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: 'text.secondary',
  mb: 0.75,
};

// ─── Amenity categorization & color palette ──────────────────────────────────
//
// Mapping amenity → categorie semantique (aligne sur i18n properties.amenities.categories)
// + couleur sobre par categorie. Les chips restent discrets (background 8-10%
// + border 30%) — pas du "rainbow slop", chaque couleur a un sens.

type AmenityCategory = 'comfort' | 'kitchen' | 'appliances' | 'outdoor' | 'safetyFamily';

const AMENITY_TO_CATEGORY: Record<string, AmenityCategory> = {
  WIFI: 'comfort',
  TV: 'comfort',
  AIR_CONDITIONING: 'comfort',
  HEATING: 'comfort',
  EQUIPPED_KITCHEN: 'kitchen',
  DISHWASHER: 'kitchen',
  MICROWAVE: 'kitchen',
  OVEN: 'kitchen',
  WASHING_MACHINE: 'appliances',
  DRYER: 'appliances',
  IRON: 'appliances',
  HAIR_DRYER: 'appliances',
  PARKING: 'outdoor',
  POOL: 'outdoor',
  JACUZZI: 'outdoor',
  GARDEN_TERRACE: 'outdoor',
  BARBECUE: 'outdoor',
  SAFE: 'safetyFamily',
  BABY_BED: 'safetyFamily',
  HIGH_CHAIR: 'safetyFamily',
};

const CATEGORY_PALETTE: Record<AmenityCategory, { color: string; bgAlpha: number; borderAlpha: number }> = {
  comfort:       { color: '#0288D1', bgAlpha: 0.10, borderAlpha: 0.32 }, // bleu — connectivite / climat
  kitchen:       { color: '#4A9B8E', bgAlpha: 0.12, borderAlpha: 0.35 }, // sage — cuisine
  appliances:    { color: '#ED6C02', bgAlpha: 0.10, borderAlpha: 0.32 }, // orange — electromenager
  outdoor:       { color: '#6B8A4F', bgAlpha: 0.12, borderAlpha: 0.35 }, // olive — exterieur
  safetyFamily:  { color: '#7B5EA7', bgAlpha: 0.10, borderAlpha: 0.32 }, // purple — securite / famille
};

const FALLBACK_PALETTE = { color: '#6B8A9A', bgAlpha: 0.08, borderAlpha: 0.30 };

function getAmenityChipStyle(amenity: string) {
  const cat = AMENITY_TO_CATEGORY[amenity];
  return cat ? CATEGORY_PALETTE[cat] : FALLBACK_PALETTE;
}

function hexToRgbaTuple(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format un datetime ISO en "25 juil. · 11h" / "25 juil." si pas d'heure. */
function formatItemDate(dateString: string | undefined | null): string {
  if (!dateString) return '—';
  const d = formatShortDate(dateString);
  const t = formatTimeFromDate(dateString);
  return t ? `${d} · ${t}` : d;
}

// ─── Status mappings ─────────────────────────────────────────────────────────

const SR_STATUS_COLORS: Record<string, string> = {
  PENDING:           '#ED6C02',
  ASSIGNED:          '#8B5CF6',
  AWAITING_PAYMENT:  '#F59E0B',
  IN_PROGRESS:       '#1565C0',
  COMPLETED:         '#4A9B8E',
  REJECTED:          '#757575',
  CANCELLED:         '#757575',
};

const SR_STATUS_LABELS: Record<string, string> = {
  PENDING:           'En attente',
  ASSIGNED:          'Assignée',
  AWAITING_PAYMENT:  'En attente de paiement',
  IN_PROGRESS:       'En cours',
  COMPLETED:         'Terminée',
  REJECTED:          'Rejetée',
  CANCELLED:         'Annulée',
};

const INTERVENTION_STATUS_COLORS: Record<string, string> = {
  completed:    '#4A9B8E',
  in_progress:  '#1565C0',
  cancelled:    '#C97A7A',
  pending:      '#ED6C02',
};

const INTERVENTION_STATUS_LABELS: Record<string, string> = {
  completed:    'Terminée',
  in_progress:  'En cours',
  cancelled:    'Annulée',
  pending:      'En attente',
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface PanelPropertyDetailsProps {
  propertyId: number;
  onDrillDown?: (view: PanelView) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PanelPropertyDetails: React.FC<PanelPropertyDetailsProps> = ({
  propertyId,
  onDrillDown,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<'requests' | 'interventions'>('requests');
  const { property, interventions, serviceRequests = [], isLoading, isError, error } = usePropertyDetails(
    propertyId?.toString(),
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner className="size-7" />
      </div>
    );
  }

  if (isError || !property) {
    return <Alert severity="error" sx={{ fontSize: BODY_FS }}>{error || 'Impossible de charger le logement'}</Alert>;
  }

  const metrics = [
    { icon: <Bed size={13} strokeWidth={1.75} />,        label: 'Chambres', value: property.bedrooms },
    { icon: <Bathtub size={13} strokeWidth={1.75} />,    label: 'SDB',      value: property.bathrooms },
    { icon: <SquareFoot size={13} strokeWidth={1.75} />, label: 'm²',       value: property.surfaceArea || '—' },
    { icon: <People size={13} strokeWidth={1.75} />,     label: 'Capacité', value: property.maxGuests },
    ...(property.numberOfFloors
      ? [{ icon: <Stairs size={13} strokeWidth={1.75} />, label: 'Étages', value: property.numberOfFloors }]
      : []),
  ];

  const cleaningFeatures = [
    property.hasExterior && 'Extérieur',
    property.hasLaundry && 'Linge',
    property.hasIroning && 'Repassage',
    property.hasDeepKitchen && 'Cuisine profonde',
    property.hasDisinfection && 'Désinfection',
  ].filter(Boolean);

  const isActive = property.status === 'active';

  // Héro : aperçu carte si la propriété est géolocalisée, sinon placeholder icône.
  const hasCoords = typeof property.latitude === 'number' && typeof property.longitude === 'number';

  // Ligne méta maquette : « ville · m² · ch » (seulement les données dispo).
  const metaLine = [
    property.city,
    property.surfaceArea ? `${property.surfaceArea} m²` : null,
    property.bedrooms ? `${property.bedrooms} ch` : null,
  ].filter(Boolean).join(' · ');

  // Section « ACCÈS » : uniquement les données existantes, sinon omise.
  const accessRows = [
    property.checkInInstructions?.accessCode
      ? { icon: <Lock size={13} strokeWidth={1.75} />, label: 'Digicode', value: property.checkInInstructions.accessCode }
      : null,
    property.numberOfFloors
      ? { icon: <Stairs size={13} strokeWidth={1.75} />, label: 'Étage', value: String(property.numberOfFloors) }
      : null,
    property.checkInInstructions?.wifiName
      ? { icon: <Wifi size={13} strokeWidth={1.75} />, label: 'Wi-Fi', value: property.checkInInstructions.wifiName }
      : null,
  ].filter((r): r is { icon: React.ReactElement; label: string; value: string } => r !== null);

  return (
    <div>
      {/* ─── HÉRO : aperçu carte (propriété géolocalisée) sinon icône ─── */}
      {hasCoords ? (
        <div className="rounded-[14px] overflow-hidden border border-[var(--line)] mb-2">
          <MapboxPropertyMap
            properties={[{
              lat: property.latitude as number,
              lng: property.longitude as number,
              name: property.name,
              type: 'property',
            }]}
            center={[property.longitude as number, property.latitude as number]}
            zoom={14}
            height={150}
          />
        </div>
      ) : (
        <div className="h-[96px] rounded-[14px] bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center mb-2">
          <Apartment size={40} strokeWidth={1.5} />
        </div>
      )}

      {/* Nom + statut + ligne « ville · m² · ch » */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <Typography
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: TITLE_FS,
            fontWeight: 700,
            flex: 1,
            lineHeight: 1.25,
            letterSpacing: '-0.01em',
            color: 'var(--ink)',
          }}
        >
          {property.name}
        </Typography>
        <StatusChip
          pill
          size="sm"
          tokens={isActive ? STATUS_TONES.ok : STATUS_TONES.neutral}
          label={property.status}
          className="text-[0.5625rem]"
        />
      </div>

      {metaLine && (
        <Typography sx={{ fontSize: BODY_FS, color: 'var(--muted)', display: 'block', mb: 0.25 }}>
          {metaLine}
        </Typography>
      )}
      <Typography sx={{ fontSize: LABEL_FS, color: 'text.secondary', display: 'block', mb: 1.5 }}>
        {property.address}, {property.city} {property.postalCode}
      </Typography>

      {/* ─── ACCÈS : Digicode / Étage / Wi-Fi (si données) ───────────── */}
      {accessRows.length > 0 && (
        <div className="mb-2">
          <Typography sx={SECTION_TITLE_SX}>Accès</Typography>
          <div className="[&>*+*]:[border-top:1px_solid_var(--line)]">
            {accessRows.map((row) => (
              <div className="flex items-center gap-1.5 py-[7px]" key={row.label}>
                <span className="inline-flex text-[var(--muted)] shrink-0">
                  {row.icon}
                </span>
                <Typography sx={{ fontSize: BODY_FS, color: 'var(--muted)', flexShrink: 0 }}>
                  {row.label}
                </Typography>
                <Typography
                  sx={{
                    ml: 'auto',
                    fontSize: BODY_FS,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.value}
                </Typography>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── STAT TILES : grid uniforme ────────────────────────────── */}
      <div className="grid gap-[3px] mb-[9px]" style={{ gridTemplateColumns: `repeat(${metrics.length}, 1fr)` }}>
        {metrics.map((m) => (
          <div className="px-0.5 py-1 flex flex-col items-center text-center border border-[var(--line)] rounded-[1px] min-w-0 gap-0" key={m.label}>
            <span className="inline-flex text-muted-foreground">{m.icon}</span>
            <Typography sx={{ fontSize: BODY_FS, fontWeight: 700, lineHeight: 1 }}>{m.value}</Typography>
            <Typography sx={{ fontSize: MICRO_FS, color: 'text.secondary', lineHeight: 1.1 }}>{m.label}</Typography>
          </div>
        ))}
      </div>

      {/* ─── PHOTOS ────────────────────────────────────────────────── */}
      <div className="mb-2">
        <PropertyImageCarousel
          photoUrls={property.photoUrls}
          alt={property.name}
          width="100%"
          height={132}
          alwaysShowNav
          enableFullscreen
          showCounter
          sx={{ width: '100%', borderRadius: 1.5, overflow: 'hidden' }}
        />
      </div>

      {/* ─── ÉQUIPEMENTS : chips colores par categorie semantique ────────
            5 categories (comfort / kitchen / appliances / outdoor / safetyFamily),
            chaque chip prend la couleur de sa categorie avec un background tres
            leger (10-12% opacite) et une bordure 30-35% : distinction visuelle
            par categorie sans surcharge "rainbow". */}
      {property.amenities.length > 0 && (
        <div className="mb-2">
          <Typography sx={SECTION_TITLE_SX}>Équipements</Typography>
          <div className="flex flex-wrap gap-0.5">
            {property.amenities.map((a) => {
              const palette = getAmenityChipStyle(a);
              return (
                <StatusChip
                  key={a}
                  tokens={{ color: palette.color, bg: hexToRgbaTuple(palette.color, palette.bgAlpha) }}
                  label={t(`properties.amenities.items.${a}`)}
                  // Teinte de bordure derivee de la palette : calculee, donc en
                  // style inline plutot qu'en classe arbitraire.
                  sx={{ borderColor: hexToRgbaTuple(palette.color, palette.borderAlpha) }}
                  className="h-[20px] border border-solid text-[0.5625rem]"
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ─── CONFIGURATION MÉNAGE (accordion) ─────────────────────── */}
      <Accordion
        disableGutters
        elevation={0}
        sx={{
          '&:before': { display: 'none' },
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '8px !important',
          mb: 1.5,
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMore size={14} strokeWidth={1.75} />}
          sx={{ minHeight: 34, '& .MuiAccordionSummary-content': { my: 0.5 } }}
        >
          <div className="flex items-center gap-1">
            <span className="inline-flex text-primary">
              <CleaningServices size={14} strokeWidth={1.75} />
            </span>
            <Typography sx={{ fontSize: BODY_FS, fontWeight: 600 }}>Configuration ménage</Typography>
          </div>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, pb: 1.25, px: 1.25 }}>
          <div className="flex flex-col gap-0.5">
            <ConfigRow icon={<Schedule size={12} strokeWidth={1.75} />} label="Fréquence">
              {property.cleaningFrequency ? getCleaningFrequencyLabel(property.cleaningFrequency, t) : '—'}
            </ConfigRow>
            {property.cleaningBasePrice != null && (
              <ConfigRow icon={<AttachMoney size={12} strokeWidth={1.75} />} label="Prix base">
                {property.cleaningBasePrice} EUR
              </ConfigRow>
            )}
            {property.cleaningDurationMinutes != null && (
              <ConfigRow icon={<Schedule size={12} strokeWidth={1.75} />} label="Durée">
                {property.cleaningDurationMinutes} min
              </ConfigRow>
            )}
            {(property.defaultCheckInTime || property.defaultCheckOutTime) && (
              <ConfigRow label="Check-in / out">
                <span className="font-semibold">{property.defaultCheckInTime || '—'}</span>
                {' / '}
                <span className="font-semibold">{property.defaultCheckOutTime || '—'}</span>
              </ConfigRow>
            )}
            {cleaningFeatures.length > 0 && (
              <div className="flex flex-wrap gap-0.5 mt-0.5">
                {cleaningFeatures.map((f) => (
                  <StatusChip
                    key={f as string}
                    size="sm"
                    tokens={{ color: 'var(--body)', bg: 'transparent' }}
                    label={f as string}
                    // Le fond passait par une fonction du theme MUI ; la variante
                    // `dark` de Tailwind dit la meme chose sans passer par lui.
                    className="border border-solid border-border bg-[rgba(107,138,154,0.08)] text-[0.5625rem] dark:bg-[rgba(255,255,255,0.06)]"
                  />
                ))}
              </div>
            )}
          </div>
        </AccordionDetails>
      </Accordion>

      {/* ─── NOTES MÉNAGE (accordion optionnel) ───────────────────── */}
      {property.cleaningNotes && (
        <Accordion
          disableGutters
          elevation={0}
          sx={{
            '&:before': { display: 'none' },
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '8px !important',
            mb: 1.5,
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore size={14} strokeWidth={1.75} />}
            sx={{ minHeight: 34, '& .MuiAccordionSummary-content': { my: 0.5 } }}
          >
            <Typography sx={{ fontSize: BODY_FS, fontWeight: 600 }}>Notes ménage</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, px: 1.25, pb: 1.25 }}>
            <Typography sx={{ fontSize: BODY_FS, color: 'text.secondary', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {property.cleaningNotes}
            </Typography>
          </AccordionDetails>
        </Accordion>
      )}

      <Divider sx={{ my: 1.5 }} />

      {/* ─── SUB-TABS : Demandes / Interventions ──────────────────── */}
      <PageTabs
        options={[
          {
            value: 'requests',
            label: 'Demandes',
            icon: <Assignment />,
            badge: serviceRequests.length,
            badgeColor: 'primary',
          },
          {
            value: 'interventions',
            label: 'Interventions',
            icon: <Handyman />,
            badge: interventions.length,
            badgeColor: 'primary',
          },
        ]}
        value={activeSubTab}
        onChange={setActiveSubTab}
        size="compact"
        mb={1}
        trail={false}
      />

      {/* ─── LIST : Demandes ──────────────────────────────────────── */}
      {activeSubTab === 'requests' && (
        <>
          {serviceRequests.length === 0 ? (
            <Typography sx={{ fontSize: BODY_FS, color: 'text.secondary', fontStyle: 'italic', textAlign: 'center', py: 1 }}>
              Aucune demande de service
            </Typography>
          ) : (
            <div className="flex flex-col gap-0.5">
              {[...serviceRequests]
                .sort((a, b) => new Date(b.desiredDate || '').getTime() - new Date(a.desiredDate || '').getTime())
                .slice(0, 5)
                .map((sr) => {
                  const c = SR_STATUS_COLORS[sr.status] || '#ED6C02';
                  return (
                    <ListItemCard
                      key={sr.id}
                      onClick={() => navigate(`/service-requests/${sr.id}`)}
                      icon={<Assignment size={13} strokeWidth={1.75} />}
                      title={sr.title}
                      meta={`${(sr.serviceType ?? '').replace(/_/g, ' ').toLowerCase()} · ${formatItemDate(sr.desiredDate)}`}
                      statusLabel={SR_STATUS_LABELS[sr.status] || sr.status}
                      statusColor={c}
                    />
                  );
                })}
              {serviceRequests.length > 5 && (
                <FooterLink onClick={() => navigate(`/service-requests?propertyId=${propertyId}`)}>
                  Voir les {serviceRequests.length} demandes
                </FooterLink>
              )}
              {serviceRequests.length <= 5 && (
                <FooterLink onClick={() => navigate(`/service-requests?propertyId=${propertyId}`)}>
                  Voir toutes les demandes
                </FooterLink>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── LIST : Interventions ─────────────────────────────────── */}
      {activeSubTab === 'interventions' && (
        <>
          {interventions.length === 0 ? (
            <Typography sx={{ fontSize: BODY_FS, color: 'text.secondary', fontStyle: 'italic', textAlign: 'center', py: 1 }}>
              Aucune intervention planifiée
            </Typography>
          ) : (
            <div className="flex flex-col gap-0.5">
              {[...interventions]
                .sort((a, b) => new Date(b.scheduledDate || '').getTime() - new Date(a.scheduledDate || '').getTime())
                .slice(0, 5)
                .map((intv) => {
                  const c = INTERVENTION_STATUS_COLORS[intv.status] || '#ED6C02';
                  return (
                    <ListItemCard
                      key={intv.id}
                      onClick={() => onDrillDown?.({ type: 'intervention-detail', interventionId: Number(intv.id) })}
                      icon={<Handyman size={13} strokeWidth={1.75} />}
                      title={intv.description || intv.type}
                      meta={`${formatItemDate(intv.scheduledDate)}${intv.assignedTo ? ` · ${intv.assignedTo}` : ''}`}
                      statusLabel={INTERVENTION_STATUS_LABELS[intv.status] || intv.status}
                      statusColor={c}
                    />
                  );
                })}
              {interventions.length > 5 && (
                <FooterLink onClick={() => navigate(`/interventions?propertyId=${propertyId}`)}>
                  Voir les {interventions.length} interventions
                </FooterLink>
              )}
              {interventions.length <= 5 && (
                <FooterLink onClick={() => navigate(`/interventions?propertyId=${propertyId}`)}>
                  Voir toutes les interventions
                </FooterLink>
              )}
            </div>
          )}
        </>
      )}

      <Divider sx={{ my: 1.5 }} />

      {/* ─── CTA : page complète ──────────────────────────────────── */}
      <Button
        variant="outlined"
        size="small"
        fullWidth
        startIcon={<OpenInNew size={13} strokeWidth={1.75} />}
        onClick={() => navigate(`/properties/${propertyId}`)}
        sx={{
          textTransform: 'none',
          fontSize: BODY_FS,
          fontWeight: 600,
          borderRadius: 'var(--radius-sm)',
          color: 'var(--ink)',
          borderColor: 'var(--line-2)',
          '&:hover': { borderColor: 'var(--ink)', backgroundColor: 'var(--hover)' },
        }}
      >
        Ouvrir la fiche logement
      </Button>
    </div>
  );
};

// ─── Sous-composants ────────────────────────────────────────────────────────

/**
 * Ligne d'info dans la config ménage : icône optionnelle + label + valeur.
 * Toutes à `BODY_FS` pour cohérence.
 */
function ConfigRow({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      {icon && (
        <span className="inline-flex text-muted-foreground">
          {icon}
        </span>
      )}
      <Typography sx={{ fontSize: BODY_FS, color: 'text.secondary', minWidth: 90 }}>
        {label} :
      </Typography>
      <Typography sx={{ fontSize: BODY_FS, fontWeight: 600, color: 'text.primary', flex: 1 }}>
        {children}
      </Typography>
    </div>
  );
}

/**
 * Card cliquable d'item de liste (demande ou intervention).
 * Hiérarchie typo cohérente : title `BODY_FS` weight 600, meta `MICRO_FS`,
 * chip statut `MICRO_FS`. Layout : icon | title+meta | status chip à droite.
 */
function ListItemCard({
  icon,
  title,
  meta,
  statusLabel,
  statusColor,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  statusLabel: string;
  statusColor: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-1.5 px-1.5 py-[4.5px] border border-solid border-[var(--line)] rounded-lg cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-[var(--hover)] hover:border-[var(--muted)]"
    >
      <span className="inline-flex text-muted-foreground shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <Typography
          sx={{
            fontSize: BODY_FS,
            fontWeight: 600,
            color: 'text.primary',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.3,
          }}
        >
          {title}
        </Typography>
        <Typography
          sx={{
            fontSize: MICRO_FS,
            color: 'text.secondary',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.3,
            textTransform: 'capitalize',
          }}
        >
          {meta}
        </Typography>
      </div>
      <StatusChip
        size="sm"
        tokens={{ color: statusColor, bg: `${statusColor}18` }}
        label={statusLabel}
        sx={{ borderColor: `${statusColor}40` }}
        className="shrink-0 border border-solid text-[0.5625rem]"
      />
    </div>
  );
}

/** Lien "Voir tout" footer commun aux 2 listes. */
function FooterLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <Button
      size="small"
      endIcon={<ArrowForward size={12} strokeWidth={1.75} />}
      onClick={onClick}
      sx={{
        fontSize: LABEL_FS,
        textTransform: 'none',
        alignSelf: 'center',
        mt: 0.25,
        color: 'text.secondary',
        '&:hover': { color: 'primary.main', backgroundColor: 'transparent' },
      }}
    >
      {children}
    </Button>
  );
}

export default PanelPropertyDetails;

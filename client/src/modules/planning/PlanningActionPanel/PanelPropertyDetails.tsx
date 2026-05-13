import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Divider,
  CircularProgress,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Home,
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
} from '../../../icons';
import { useNavigate } from 'react-router-dom';
import { usePropertyDetails } from '../../../hooks/usePropertyDetails';
import { useTranslation } from '../../../hooks/useTranslation';
import type { PanelView } from '../types';
import { PropertyImageCarousel } from '../../../components/PropertyImageCarousel';
import { formatShortDate, formatTimeFromDate } from '../../../utils/formatUtils';
import { getCleaningFrequencyLabel } from '../../../utils/statusUtils';

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
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress size={28} />
      </Box>
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

  const statusColor = property.status === 'active' ? '#4A9B8E' : '#757575';

  return (
    <Box>
      {/* ─── HEADER : icône + nom + statut ──────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, mb: 0.5 }}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}>
          <Home size={15} strokeWidth={1.75} />
        </Box>
        <Typography sx={{ fontSize: TITLE_FS, fontWeight: 700, flex: 1, lineHeight: 1.25, letterSpacing: '-0.01em' }}>
          {property.name}
        </Typography>
        <Chip
          label={property.status}
          size="small"
          sx={{
            fontSize: MICRO_FS,
            height: 18,
            fontWeight: 600,
            backgroundColor: `${statusColor}18`,
            color: statusColor,
            border: `1px solid ${statusColor}40`,
            borderRadius: '6px',
            '& .MuiChip-label': { px: 0.625 },
          }}
        />
      </Box>

      <Typography sx={{ fontSize: LABEL_FS, color: 'text.secondary', display: 'block', mb: 1.5 }}>
        {property.address}, {property.city} {property.postalCode}
      </Typography>

      {/* ─── STAT TILES : grid uniforme ────────────────────────────── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${metrics.length}, 1fr)`,
          gap: 0.5,
          mb: 1.5,
        }}
      >
        {metrics.map((m) => (
          <Box
            key={m.label}
            sx={{
              px: 0.5,
              py: 0.625,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              minWidth: 0,
              gap: 0.125,
            }}
          >
            <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}>{m.icon}</Box>
            <Typography sx={{ fontSize: BODY_FS, fontWeight: 700, lineHeight: 1 }}>{m.value}</Typography>
            <Typography sx={{ fontSize: MICRO_FS, color: 'text.secondary', lineHeight: 1.1 }}>{m.label}</Typography>
          </Box>
        ))}
      </Box>

      {/* ─── PHOTOS ────────────────────────────────────────────────── */}
      <Box sx={{ mb: 1.5 }}>
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
      </Box>

      {/* ─── ÉQUIPEMENTS : chips uniformisés (un seul registre couleur) ── */}
      {property.amenities.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <Typography sx={SECTION_TITLE_SX}>Équipements</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {property.amenities.map((a) => (
              <Chip
                key={a}
                label={t(`properties.amenities.items.${a}`)}
                size="small"
                sx={{
                  // Couleur neutre uniforme — anti-pattern AI-slop "rainbow chips".
                  // L'info "amenité présente" est binaire : l'affichage suffit.
                  backgroundColor: (th) => th.palette.mode === 'dark'
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(107,138,154,0.08)',
                  color: 'text.primary',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '6px',
                  fontWeight: 500,
                  fontSize: MICRO_FS,
                  height: 20,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            ))}
          </Box>
        </Box>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}>
              <CleaningServices size={14} strokeWidth={1.75} />
            </Box>
            <Typography sx={{ fontSize: BODY_FS, fontWeight: 600 }}>Configuration ménage</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, pb: 1.25, px: 1.25 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
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
                <Box component="span" sx={{ fontWeight: 600 }}>{property.defaultCheckInTime || '—'}</Box>
                {' / '}
                <Box component="span" sx={{ fontWeight: 600 }}>{property.defaultCheckOutTime || '—'}</Box>
              </ConfigRow>
            )}
            {cleaningFeatures.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                {cleaningFeatures.map((f) => (
                  <Chip
                    key={f as string}
                    label={f as string}
                    size="small"
                    sx={{
                      fontSize: MICRO_FS,
                      height: 18,
                      fontWeight: 600,
                      backgroundColor: (th) => th.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(107,138,154,0.08)',
                      color: 'text.primary',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: '6px',
                      '& .MuiChip-label': { px: 0.625 },
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
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
      <Tabs
        value={activeSubTab}
        onChange={(_, v) => setActiveSubTab(v)}
        variant="fullWidth"
        sx={{
          minHeight: 30,
          mb: 1,
          '& .MuiTab-root': {
            minHeight: 30,
            fontSize: LABEL_FS,
            textTransform: 'none',
            fontWeight: 600,
            py: 0.25,
            gap: 0.5,
          },
        }}
      >
        <Tab
          icon={<Assignment size={12} strokeWidth={1.75} />}
          iconPosition="start"
          label={`Demandes (${serviceRequests.length})`}
          value="requests"
        />
        <Tab
          icon={<Handyman size={12} strokeWidth={1.75} />}
          iconPosition="start"
          label={`Interventions (${interventions.length})`}
          value="interventions"
        />
      </Tabs>

      {/* ─── LIST : Demandes ──────────────────────────────────────── */}
      {activeSubTab === 'requests' && (
        <>
          {serviceRequests.length === 0 ? (
            <Typography sx={{ fontSize: BODY_FS, color: 'text.secondary', fontStyle: 'italic', textAlign: 'center', py: 1 }}>
              Aucune demande de service
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
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
            </Box>
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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
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
            </Box>
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
      >
        Voir la fiche logement
      </Button>
    </Box>
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
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {icon && (
        <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}>
          {icon}
        </Box>
      )}
      <Typography sx={{ fontSize: BODY_FS, color: 'text.secondary', minWidth: 90 }}>
        {label} :
      </Typography>
      <Typography sx={{ fontSize: BODY_FS, fontWeight: 600, color: 'text.primary', flex: 1 }}>
        {children}
      </Typography>
    </Box>
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
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.75,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        cursor: 'pointer',
        transition: 'background-color 150ms, border-color 150ms',
        '&:hover': {
          backgroundColor: 'action.hover',
          borderColor: 'text.secondary',
        },
      }}
    >
      <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', flexShrink: 0 }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
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
      </Box>
      <Chip
        label={statusLabel}
        size="small"
        sx={{
          fontSize: MICRO_FS,
          height: 18,
          fontWeight: 600,
          backgroundColor: `${statusColor}18`,
          color: statusColor,
          border: `1px solid ${statusColor}40`,
          borderRadius: '6px',
          flexShrink: 0,
          '& .MuiChip-label': { px: 0.625 },
        }}
      />
    </Box>
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

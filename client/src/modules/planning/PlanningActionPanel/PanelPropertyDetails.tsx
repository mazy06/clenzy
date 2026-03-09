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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { usePropertyDetails } from '../../../hooks/usePropertyDetails';
import { useTranslation } from '../../../hooks/useTranslation';
import type { PanelView } from '../types';

import { getAmenityHex } from '../../../utils/statusUtils';

// ─── Section styles ─────────────────────────────────────────────────────────

const SECTION_TITLE_SX = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: 'text.secondary',
  mb: 1,
};

const INFO_ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  py: 0.5,
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
    return <Alert severity="error" sx={{ fontSize: '0.75rem' }}>{error || 'Impossible de charger le logement'}</Alert>;
  }

  const metrics = [
    { icon: <Bed sx={{ fontSize: 16 }} />, label: 'Chambres', value: property.bedrooms },
    { icon: <Bathtub sx={{ fontSize: 16 }} />, label: 'SDB', value: property.bathrooms },
    { icon: <SquareFoot sx={{ fontSize: 16 }} />, label: 'm²', value: property.surfaceArea || '—' },
    { icon: <People sx={{ fontSize: 16 }} />, label: 'Capacité', value: property.maxGuests },
    ...(property.numberOfFloors ? [{ icon: <Stairs sx={{ fontSize: 16 }} />, label: 'Étages', value: property.numberOfFloors }] : []),
  ];

  const cleaningFeatures = [
    property.hasExterior && 'Extérieur',
    property.hasLaundry && 'Linge',
    property.hasIroning && 'Repassage',
    property.hasDeepKitchen && 'Cuisine profonde',
    property.hasDisinfection && 'Désinfection',
  ].filter(Boolean);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Home sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.875rem', flex: 1 }}>
          {property.name}
        </Typography>
        {(() => { const c = property.status === 'active' ? '#4A9B8E' : '#757575'; return (
        <Chip
          label={property.status}
          size="small"
          sx={{ fontSize: '0.625rem', height: 20, fontWeight: 600, backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
        />
        ); })()}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontSize: '0.6875rem' }}>
        {property.address}, {property.city} {property.postalCode}
      </Typography>

      {/* Metrics grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 0.75,
          mb: 2,
        }}
      >
        {metrics.map((m) => (
          <Box
            key={m.label}
            sx={{
              p: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.5,
            }}
          >
            {m.icon}
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, mt: 0.25 }}>
              {m.value}
            </Typography>
            <Typography sx={{ fontSize: '0.5625rem', color: 'text.secondary' }}>
              {m.label}
            </Typography>
          </Box>
        ))}
      </Box>

      <Divider sx={{ my: 1.5 }} />

      {/* Amenities */}
      {property.amenities.length > 0 && (
        <>
          <Typography sx={SECTION_TITLE_SX}>Équipements</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            {property.amenities.map((a) => {
              const c = getAmenityHex(a);
              return (
              <Chip
                key={a}
                label={t(`properties.amenities.items.${a}`)}
                size="small"
                sx={{
                  backgroundColor: `${c}18`,
                  color: c,
                  border: `1px solid ${c}40`,
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.5625rem',
                  height: 22,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
              );
            })}
          </Box>
        </>
      )}

      {/* Cleaning config */}
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
        <AccordionSummary expandIcon={<ExpandMore sx={{ fontSize: 16 }} />} sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <CleaningServices sx={{ fontSize: 16, color: 'primary.main' }} />
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Configuration ménage</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, pb: 1 }}>
          <Box sx={INFO_ROW_SX}>
            <Schedule sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>Fréquence :</Typography>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600 }}>{property.cleaningFrequency?.replace(/_/g, ' ')}</Typography>
          </Box>
          {property.cleaningBasePrice != null && (
            <Box sx={INFO_ROW_SX}>
              <AttachMoney sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>Prix base :</Typography>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600 }}>{property.cleaningBasePrice} EUR</Typography>
            </Box>
          )}
          {property.cleaningDurationMinutes != null && (
            <Box sx={INFO_ROW_SX}>
              <Schedule sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>Durée :</Typography>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600 }}>{property.cleaningDurationMinutes} min</Typography>
            </Box>
          )}
          {property.defaultCheckInTime && (
            <Box sx={INFO_ROW_SX}>
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>Check-in :</Typography>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600 }}>{property.defaultCheckInTime}</Typography>
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', ml: 1 }}>Check-out :</Typography>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600 }}>{property.defaultCheckOutTime || '—'}</Typography>
            </Box>
          )}
          {cleaningFeatures.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {cleaningFeatures.map((f) => (
                <Chip key={f as string} label={f as string} size="small" sx={{ fontSize: '0.5625rem', height: 20, fontWeight: 600, backgroundColor: '#75757518', color: '#757575', border: '1px solid #75757540', borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }} />
              ))}
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Cleaning notes */}
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
          <AccordionSummary expandIcon={<ExpandMore sx={{ fontSize: 16 }} />} sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Notes ménage</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Typography sx={{ fontSize: '0.6875rem', whiteSpace: 'pre-wrap' }}>{property.cleaningNotes}</Typography>
          </AccordionDetails>
        </Accordion>
      )}

      <Divider sx={{ my: 1.5 }} />

      {/* Sub-tabs: Demandes / Interventions */}
      <Tabs
        value={activeSubTab}
        onChange={(_, v) => setActiveSubTab(v)}
        variant="fullWidth"
        sx={{
          minHeight: 32,
          mb: 1.5,
          '& .MuiTab-root': {
            minHeight: 32,
            fontSize: '0.6875rem',
            textTransform: 'none',
            fontWeight: 600,
            py: 0.5,
          },
        }}
      >
        <Tab
          icon={<Assignment sx={{ fontSize: 14 }} />}
          iconPosition="start"
          label={`Demandes (${serviceRequests.length})`}
          value="requests"
        />
        <Tab
          icon={<Handyman sx={{ fontSize: 14 }} />}
          iconPosition="start"
          label={`Interventions (${interventions.length})`}
          value="interventions"
        />
      </Tabs>

      {activeSubTab === 'requests' && (
        <>
          {serviceRequests.length === 0 ? (
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', fontStyle: 'italic' }}>
              Aucune demande de service
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {[...serviceRequests]
                .sort((a, b) => new Date(b.desiredDate || '').getTime() - new Date(a.desiredDate || '').getTime())
                .slice(0, 5)
                .map((sr) => {
                  const statusColors: Record<string, string> = {
                    PENDING: '#ED6C02',
                    ASSIGNED: '#8B5CF6',
                    AWAITING_PAYMENT: '#F59E0B',
                    IN_PROGRESS: '#1565C0',
                    COMPLETED: '#4A9B8E',
                    REJECTED: '#757575',
                    CANCELLED: '#757575',
                  };
                  const c = statusColors[sr.status] || '#ED6C02';
                  const statusLabels: Record<string, string> = {
                    PENDING: "En attente d'assignation",
                    ASSIGNED: 'Assignée',
                    AWAITING_PAYMENT: 'En attente de paiement',
                    IN_PROGRESS: 'En cours',
                    COMPLETED: 'Terminée',
                    REJECTED: 'Rejetée',
                    CANCELLED: 'Annulée',
                  };
                  return (
                    <Box
                      key={sr.id}
                      onClick={() => navigate(`/service-requests/${sr.id}`)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        cursor: 'pointer',
                        '&:hover': { backgroundColor: 'action.hover' },
                      }}
                    >
                      <Assignment sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sr.title}
                        </Typography>
                        <Typography sx={{ fontSize: '0.5625rem', color: 'text.secondary' }}>
                          {sr.serviceType?.replace(/_/g, ' ')} · {sr.desiredDate}
                        </Typography>
                      </Box>
                      <Chip
                        label={statusLabels[sr.status] || sr.status}
                        size="small"
                        sx={{ fontSize: '0.5625rem', height: 20, fontWeight: 600, backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
                      />
                    </Box>
                  );
                })}
              <Button
                size="small"
                endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
                onClick={() => navigate(`/service-requests?propertyId=${propertyId}`)}
                sx={{ fontSize: '0.6875rem', textTransform: 'none', mt: 0.5, alignSelf: 'center' }}
              >
                Voir toutes les demandes
              </Button>
            </Box>
          )}
        </>
      )}

      {activeSubTab === 'interventions' && (
        <>
          {interventions.length === 0 ? (
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', fontStyle: 'italic' }}>
              Aucune intervention planifiée
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {[...interventions]
                .sort((a, b) => new Date(b.scheduledDate || '').getTime() - new Date(a.scheduledDate || '').getTime())
                .slice(0, 5)
                .map((intv) => (
                  <Box
                    key={intv.id}
                    onClick={() => onDrillDown?.({ type: 'intervention-detail', interventionId: Number(intv.id) })}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: 'action.hover' },
                    }}
                  >
                    <Handyman sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {intv.description || intv.type}
                      </Typography>
                      <Typography sx={{ fontSize: '0.5625rem', color: 'text.secondary' }}>
                        {intv.scheduledDate} {intv.assignedTo ? `· ${intv.assignedTo}` : ''}
                      </Typography>
                    </Box>
                    {(() => { const c = intv.status === 'completed' ? '#4A9B8E' : intv.status === 'in_progress' ? '#0288d1' : intv.status === 'cancelled' ? '#d32f2f' : '#ED6C02'; return (
                    <Chip
                      label={intv.status}
                      size="small"
                      sx={{ fontSize: '0.5625rem', height: 20, fontWeight: 600, backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
                    />
                    ); })()}
                  </Box>
                ))}
              <Button
                size="small"
                endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
                onClick={() => navigate(`/interventions?propertyId=${propertyId}`)}
                sx={{ fontSize: '0.6875rem', textTransform: 'none', mt: 0.5, alignSelf: 'center' }}
              >
                Voir toutes les interventions
              </Button>
            </Box>
          )}
        </>
      )}

      <Divider sx={{ my: 1.5 }} />

      <Button
        variant="outlined"
        size="small"
        fullWidth
        startIcon={<OpenInNew sx={{ fontSize: 14 }} />}
        onClick={() => navigate(`/properties/${propertyId}`)}
        sx={{ fontSize: '0.6875rem', textTransform: 'none' }}
      >
        Voir page complète
      </Button>
    </Box>
  );
};

export default PanelPropertyDetails;

import React from 'react';
import { Box, Button, Chip, LinearProgress, Popover, Typography, useMediaQuery } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  Business,
  LocationOn,
  Close,
  Visibility,
  People,
  Bed,
  Euro,
  AccessTime,
  CleaningServices,
  Person,
  CalendarMonth,
  Speed,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { getCleaningFrequencyLabel } from '../../utils/statusUtils';
import { Money } from '../../components/Money';
import type { PropertyPerformance } from '../../services/api/propertiesApi';
import type { PlanningProperty } from './types';

// ─── Popover logement (maquette Signature) ───────────────────────────────────
//
// Carte ~270px ouverte au clic sur le nom du logement (colonne). Fusion (2026-06)
// de l'ancien tooltip de survol : on garde le design du popover (héro radius 10
// fond var(--accent-soft) + icône bâtiment var(--accent) et nom en overlay, pied
// « Fermer » + « Voir la fiche ») et on y intègre les informations riches qui
// étaient au survol (type, propriétaire, stats voyageurs/nuits/prix/ménage,
// heures de check-in/out, fréquence ménage). Plus de tooltip hover séparé.

const ICON_SIZE = 13;
const STAT_ICON_SIZE = 11;
const LABEL_FS = '0.5625rem';
const BODY_FS = '0.6875rem';

interface PropertyPopoverProps {
  anchorEl: HTMLElement;
  property: PlanningProperty;
  /**
   * Performance déjà résolue (fournie par le parent) — le popover est purement
   * présentationnel : il n'attend rien, il affiche tout en une fois. {@code null}
   * = pas de perf (mode démo / indisponible) → la section n'est pas rendue.
   */
  performance: PropertyPerformance | null;
  onClose: () => void;
}

const PropertyPopover: React.FC<PropertyPopoverProps> = ({ anchorEl, property, performance: perf, onClose }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const address = [property.address, property.city].filter(Boolean).join(', ');
  const currency = property.currency || 'EUR';
  const fmt = React.useMemo(
    () => new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }),
    [currency],
  );

  const hasStats =
    property.maxGuests != null
    || (property.minimumNights != null && property.minimumNights > 0)
    || (property.nightlyPrice != null && property.nightlyPrice > 0)
    || (property.cleaningBasePrice != null && property.cleaningBasePrice > 0);
  const hasTimes = Boolean(property.defaultCheckInTime || property.defaultCheckOutTime);

  return (
    <Popover
      open
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
      transformOrigin={{ vertical: 'center', horizontal: 'left' }}
      transitionDuration={reduceMotion ? 0 : undefined}
      slotProps={{
        paper: {
          sx: {
            width: 270,
            borderRadius: '14px',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow-pop)',
            backgroundColor: 'var(--card)',
            backgroundImage: 'none',
            overflow: 'hidden',
            ml: 1,
          },
        },
      }}
    >
      {/* Héro : fond accent-soft, icône bâtiment, nom en overlay */}
      <Box
        sx={{
          position: 'relative',
          m: '10px',
          height: 72,
          borderRadius: '10px',
          backgroundColor: 'var(--accent-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ display: 'inline-flex', color: 'var(--accent)', opacity: 0.55, mb: '14px' }}>
          <Business size={26} strokeWidth={1.5} />
        </Box>
        <Box
          component="span"
          sx={{
            position: 'absolute',
            left: 10,
            right: 10,
            bottom: 7,
            fontSize: '0.8125rem',
            fontWeight: 700,
            color: 'var(--ink)',
            lineHeight: 1.25,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {property.name}
        </Box>
      </Box>

      {/* Type + adresse + propriétaire */}
      {(property.type || address || property.ownerName) && (
        <Box sx={{ px: '14px', py: '8px', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {property.type && (
            <Chip
              label={property.type}
              size="small"
              sx={{
                alignSelf: 'flex-start',
                height: 18,
                fontSize: LABEL_FS,
                fontWeight: 600,
                bgcolor: 'var(--accent-soft)',
                color: 'var(--accent)',
                textTransform: 'capitalize',
                '& .MuiChip-label': { px: 0.625 },
              }}
            />
          )}
          {address && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
              <Box sx={{ display: 'inline-flex', color: 'var(--muted)', flexShrink: 0, mt: '1px' }}>
                <LocationOn size={STAT_ICON_SIZE} strokeWidth={1.75} />
              </Box>
              <Box component="span" sx={{ fontSize: BODY_FS, color: 'var(--muted)', lineHeight: 1.4 }}>
                {address}
              </Box>
            </Box>
          )}
          {property.ownerName && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ display: 'inline-flex', color: 'var(--muted)', flexShrink: 0 }}>
                <Person size={STAT_ICON_SIZE} strokeWidth={1.75} />
              </Box>
              <Box component="span" sx={{ fontSize: BODY_FS, color: 'var(--muted)' }}>
                {property.ownerName}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Stats + heures + fréquence ménage */}
      {(hasStats || hasTimes || property.cleaningFrequency) && (
        <Box sx={{ px: '14px', py: '10px', borderTop: '1px solid var(--line)' }}>
          {hasStats && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              {property.maxGuests != null && (
                <StatPill
                  icon={<People size={STAT_ICON_SIZE} strokeWidth={1.75} />}
                  label="Voyageurs max"
                  value={`${property.maxGuests}`}
                />
              )}
              {property.minimumNights != null && property.minimumNights > 0 && (
                <StatPill
                  icon={<Bed size={STAT_ICON_SIZE} strokeWidth={1.75} />}
                  label="Nuits min."
                  value={`${property.minimumNights}`}
                />
              )}
              {property.nightlyPrice != null && property.nightlyPrice > 0 && (
                <StatPill
                  icon={<Euro size={STAT_ICON_SIZE} strokeWidth={1.75} />}
                  label="Prix / nuit"
                  value={fmt.format(property.nightlyPrice)}
                  highlight
                />
              )}
              {property.cleaningBasePrice != null && property.cleaningBasePrice > 0 && (
                <StatPill
                  icon={<CleaningServices size={STAT_ICON_SIZE} strokeWidth={1.75} />}
                  label="Ménage"
                  value={fmt.format(property.cleaningBasePrice)}
                />
              )}
            </Box>
          )}

          {hasTimes && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: hasStats ? 1 : 0, flexWrap: 'wrap' }}>
              {property.defaultCheckInTime && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'var(--ok)' }}>
                    <AccessTime size={STAT_ICON_SIZE} strokeWidth={1.75} />
                  </Box>
                  <Box component="span" sx={{ fontSize: BODY_FS, color: 'var(--muted)' }}>
                    Check-in <Box component="strong" sx={{ color: 'var(--ink)' }}>{property.defaultCheckInTime.slice(0, 5)}</Box>
                  </Box>
                </Box>
              )}
              {property.defaultCheckOutTime && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'var(--warn)' }}>
                    <AccessTime size={STAT_ICON_SIZE} strokeWidth={1.75} />
                  </Box>
                  <Box component="span" sx={{ fontSize: BODY_FS, color: 'var(--muted)' }}>
                    Check-out <Box component="strong" sx={{ color: 'var(--ink)' }}>{property.defaultCheckOutTime.slice(0, 5)}</Box>
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {property.cleaningFrequency && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, mt: (hasStats || hasTimes) ? 0.75 : 0 }}>
              <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}>
                <CalendarMonth size={STAT_ICON_SIZE} strokeWidth={1.75} />
              </Box>
              <Box component="span" sx={{ fontSize: BODY_FS, color: 'var(--muted)' }}>
                Fréquence ménage : <Box component="strong" sx={{ color: 'var(--ink)' }}>{getCleaningFrequencyLabel(property.cleaningFrequency, t)}</Box>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Performance sur fenêtre glissante — même représentation que la carte
          « Performance par logement » (score /100 + barre + lignes label/valeur). */}
      {perf && (
        <Box sx={{ px: '14px', py: '10px', borderTop: '1px solid var(--line)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: '8px' }}>
            <Box sx={{ display: 'inline-flex', color: 'var(--accent)' }}>
              <Speed size={STAT_ICON_SIZE} strokeWidth={1.75} />
            </Box>
            <Box component="span" sx={{ fontSize: LABEL_FS, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--muted)' }}>
              Performance · {perf.windowDays} j
            </Box>
          </Box>

          {/* Score + barre de progression */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
            <Box component="span" sx={{ fontSize: LABEL_FS, color: 'var(--muted)' }}>Score</Box>
            <Box component="span" sx={{ fontSize: BODY_FS, fontWeight: 700, color: scoreColor(perf.score), fontVariantNumeric: 'tabular-nums' }}>
              {perf.score}/100
            </Box>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.max(0, Math.min(100, perf.score))}
            sx={{
              height: 4,
              borderRadius: 2,
              mb: '10px',
              bgcolor: 'var(--line)',
              '& .MuiLinearProgress-bar': { bgcolor: scoreColor(perf.score), borderRadius: 2, transition: reduceMotion ? 'none' : undefined },
            }}
          />

          {/* Lignes label / valeur */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <PerfRow label="RevPAN" value={<Money value={perf.revPan} from="EUR" decimals={2} />} />
            <PerfRow label="Taux d'occupation" value={`${Math.round(perf.occupancyRate)} %`} />
            <PerfRow label="Revenu total" value={<Money value={perf.revenue} from="EUR" decimals={0} />} />
            <PerfRow
              label="Marge nette"
              value={`${Math.round(perf.netMargin)} %`}
              valueColor={perf.netMargin >= 60 ? '#4A9B8E' : perf.netMargin >= 40 ? '#D4A574' : '#C97A7A'}
            />
          </Box>
        </Box>
      )}

      {/* Pied : Fermer (outlined neutre) + Voir la fiche (outlined accent) */}
      <Box sx={{ display: 'flex', gap: 1, p: '10px 14px', borderTop: '1px solid var(--line)' }}>
        <Button
          size="small"
          variant="outlined"
          fullWidth
          startIcon={<Close size={ICON_SIZE} strokeWidth={1.75} />}
          onClick={onClose}
          sx={{
            textTransform: 'none',
            fontSize: '0.75rem',
            fontWeight: 600,
            borderRadius: '9px',
            color: 'var(--ink)',
            borderColor: 'var(--line-2)',
            '&:hover': { borderColor: 'var(--ink)', backgroundColor: 'var(--hover)' },
          }}
        >
          Fermer
        </Button>
        <Button
          size="small"
          variant="outlined"
          fullWidth
          startIcon={<Visibility size={ICON_SIZE} strokeWidth={1.75} />}
          onClick={() => {
            onClose();
            navigate(`/properties/${property.id}`);
          }}
          sx={{
            textTransform: 'none',
            fontSize: '0.75rem',
            fontWeight: 600,
            borderRadius: '9px',
            color: 'var(--accent)',
            borderColor: 'var(--accent)',
            '&:hover': { borderColor: 'var(--accent-deep)', backgroundColor: 'var(--accent-soft)' },
          }}
        >
          Voir la fiche
        </Button>
      </Box>
    </Popover>
  );
};

// ─── Pastille stat (reprise de l'ancien tooltip de survol) ───────────────────
// Score → couleur : vert (sain) / ambre (moyen) / rouge (faible).
// Mêmes seuils que la carte « Performance par logement » (80 / 50).
function scoreColor(score: number): string {
  if (score >= 80) return '#4A9B8E';
  if (score >= 50) return '#D4A574';
  return '#C97A7A';
}

// Ligne label (gauche, sourdine) / valeur (droite, grasse, tabular) — reprise du
// rendu de la carte « Performance par logement ».
function PerfRow({ label, value, valueColor }: { label: string; value: React.ReactNode; valueColor?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Box component="span" sx={{ fontSize: LABEL_FS, color: 'var(--muted)' }}>{label}</Box>
      <Box component="span" sx={{ fontSize: BODY_FS, fontWeight: 700, color: valueColor ?? 'var(--ink)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
        {value}
      </Box>
    </Box>
  );
}

function StatPill({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Box
      sx={{
        p: 0.875,
        borderRadius: 1,
        bgcolor: highlight ? 'var(--ok-soft)' : 'color-mix(in srgb, var(--ink) 2.5%, transparent)',
        border: '1px solid',
        borderColor: highlight ? 'var(--ok)' : 'var(--line)',
        minWidth: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, color: highlight ? 'var(--ok)' : 'var(--muted)', mb: 0.375 }}>
        {icon}
        <Box component="span" sx={{ fontSize: LABEL_FS, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: 'inherit', lineHeight: 1 }}>
          {label}
        </Box>
      </Box>
      <Typography sx={{ fontSize: '11.5px', fontWeight: 600, color: highlight ? 'var(--ok)' : 'var(--ink)', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );
}

export default PropertyPopover;

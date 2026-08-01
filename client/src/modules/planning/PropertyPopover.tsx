import React from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Button, LinearProgress, Popover, useMediaQuery } from '@mui/material';
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
      <div className="relative m-2.5 h-[72px] rounded-[10px] bg-[var(--accent-soft)] flex items-center justify-center overflow-hidden">
        <div className="inline-flex text-[var(--accent)] opacity-55 mb-3.5">
          <Business size={26} strokeWidth={1.5} />
        </div>
        <span className="absolute start-[10px] end-[10px] bottom-[7px] text-[0.8125rem] font-bold text-[var(--ink)] leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap">
          {property.name}
        </span>
      </div>

      {/* Type + adresse + propriétaire */}
      {(property.type || address || property.ownerName) && (
        <div className="px-3.5 py-2 flex flex-col gap-1.5" style={{ borderTop: '1px solid var(--line)' }}>
          {property.type && (
            <StatusChip
              tone="accent"
              size="sm"
              label={property.type}
              className="self-start text-[0.5625rem] capitalize"
            />
          )}
          {address && (
            <div className="flex items-start gap-1">
              <div className="inline-flex text-[var(--muted)] shrink-0 mt-px">
                <LocationOn size={STAT_ICON_SIZE} strokeWidth={1.75} />
              </div>
              <span className="text-[var(--muted)] leading-[1.4]" style={{ fontSize: BODY_FS }}>
                {address}
              </span>
            </div>
          )}
          {property.ownerName && (
            <div className="flex items-center gap-1">
              <div className="inline-flex text-[var(--muted)] shrink-0">
                <Person size={STAT_ICON_SIZE} strokeWidth={1.75} />
              </div>
              <span className="text-[var(--muted)]" style={{ fontSize: BODY_FS }}>
                {property.ownerName}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Stats + heures + fréquence ménage */}
      {(hasStats || hasTimes || property.cleaningFrequency) && (
        <div className="px-3.5 py-2.5" style={{ borderTop: '1px solid var(--line)' }}>
          {hasStats && (
            <div className="grid grid-cols-2 gap-1.5">
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
            </div>
          )}

          {hasTimes && (
            <div className={cn('flex items-center gap-[7.5px] flex-wrap', hasStats ? 'mt-1.5' : 'mt-0')}>
              {property.defaultCheckInTime && (
                <div className="flex items-center gap-1">
                  <span className="inline-flex text-[var(--ok)]">
                    <AccessTime size={STAT_ICON_SIZE} strokeWidth={1.75} />
                  </span>
                  <span className="text-[var(--muted)]" style={{ fontSize: BODY_FS }}>
                    Check-in <strong className="text-[var(--ink)]">{property.defaultCheckInTime.slice(0, 5)}</strong>
                  </span>
                </div>
              )}
              {property.defaultCheckOutTime && (
                <div className="flex items-center gap-1">
                  <span className="inline-flex text-[var(--warn)]">
                    <AccessTime size={STAT_ICON_SIZE} strokeWidth={1.75} />
                  </span>
                  <span className="text-[var(--muted)]" style={{ fontSize: BODY_FS }}>
                    Check-out <strong className="text-[var(--ink)]">{property.defaultCheckOutTime.slice(0, 5)}</strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {property.cleaningFrequency && (
            <div className={cn('flex items-center gap-[3.75px]', (hasStats || hasTimes) ? 'mt-[4.5px]' : 'mt-0')}>
              <span className="inline-flex text-[var(--muted)]">
                <CalendarMonth size={STAT_ICON_SIZE} strokeWidth={1.75} />
              </span>
              <span className="text-[var(--muted)]" style={{ fontSize: BODY_FS }}>
                Fréquence ménage : <strong className="text-[var(--ink)]">{getCleaningFrequencyLabel(property.cleaningFrequency, t)}</strong>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Performance sur fenêtre glissante — même représentation que la carte
          « Performance par logement » (score /100 + barre + lignes label/valeur). */}
      {perf && (
        <div className="px-3.5 py-2.5" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="flex items-center gap-[4.5px] mb-2">
            <div className="inline-flex text-[var(--accent)]">
              <Speed size={STAT_ICON_SIZE} strokeWidth={1.75} />
            </div>
            <span className="font-bold uppercase tracking-[0.3px] text-[var(--muted)]" style={{ fontSize: LABEL_FS }}>
              Performance · {perf.windowDays} j
            </span>
          </div>

          {/* Score + barre de progression */}
          <div className="flex justify-between mb-0.5">
            <span className="text-[var(--muted)]" style={{ fontSize: LABEL_FS }}>Score</span>
            <span className="font-bold tabular-nums" style={{ fontSize: BODY_FS, color: scoreColor(perf.score) }}>
              {perf.score}/100
            </span>
          </div>
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
          <div className="flex flex-col gap-0.5">
            <PerfRow label="RevPAN" value={<Money value={perf.revPan} from="EUR" decimals={2} />} />
            <PerfRow label="Taux d'occupation" value={`${Math.round(perf.occupancyRate)} %`} />
            <PerfRow label="Revenu total" value={<Money value={perf.revenue} from="EUR" decimals={0} />} />
            <PerfRow
              label="Marge nette"
              value={`${Math.round(perf.netMargin)} %`}
              valueColor={perf.netMargin >= 60 ? '#4A9B8E' : perf.netMargin >= 40 ? '#D4A574' : '#C97A7A'}
            />
          </div>
        </div>
      )}

      {/* Pied : Fermer (outlined neutre) + Voir la fiche (outlined accent) */}
      <div className="flex gap-1.5 p-[10px 14px]" style={{ borderTop: '1px solid var(--line)' }}>
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
      </div>
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
    <div className="flex justify-between items-baseline">
      <span className="text-[var(--muted)]" style={{ fontSize: LABEL_FS }}>{label}</span>
      <span className="font-bold tabular-nums text-end" style={{ fontSize: BODY_FS, color: valueColor ?? 'var(--ink)' }}>
        {value}
      </span>
    </div>
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
    <div className={cn('p-[5.25px] rounded-[8px] border border-solid min-w-0', highlight ? 'bg-[var(--ok-soft)]' : 'bg-[color-mix(in_srgb,_var(--ink)_2.5%,_transparent)]', highlight ? 'border-[var(--ok)]' : 'border-[var(--line)]')}>
      <div className={cn('flex items-center gap-[3.75px] mb-[2.25px]', highlight ? 'text-[var(--ok)]' : 'text-[var(--muted)]')}>
        {icon}
        <span className="font-bold uppercase tracking-[0.3px] text-[inherit] leading-[1]" style={{ fontSize: LABEL_FS }}>
          {label}
        </span>
      </div>
      <p className={cn('cn-text-body1 text-[11.5px] font-semibold leading-[1.2] tabular-nums', highlight ? 'text-[var(--ok)]' : 'text-[var(--ink)]')}>
        {value}
      </p>
    </div>
  );
}

export default PropertyPopover;

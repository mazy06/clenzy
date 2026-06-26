/* ============================================================
   AvailabilityResult — displayHint="availability"

   Payload backend (get_availability) :
     { propertyId, from, to, availableNights, unavailableNights,
       fullyAvailable, days: [{ date, available, status }] }
   → bandeau résumé (nuits libres/occupées) + mini-grille de jours
     colorée (vert=libre, ambre=bloqué/maintenance, rouge=réservé).
   ============================================================ */
import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { SurfaceCard, Overline } from './shared';

interface Day {
  date: string;
  available?: boolean;
  status?: string;
}
interface AvailabilityData {
  propertyId?: number;
  from?: string;
  to?: string;
  availableNights?: number;
  unavailableNights?: number;
  fullyAvailable?: boolean;
  days?: Day[];
}

const MAX_CELLS = 62; // ~2 mois ; au-delà on tronque l'affichage de la grille.

function dayColor(day: Day): { bg: string; fg: string } {
  if (day.available) return { bg: 'var(--ok-soft)', fg: 'var(--ok)' };
  const status = (day.status ?? '').toUpperCase();
  if (status === 'BOOKED') return { bg: 'var(--err-soft)', fg: 'var(--err)' };
  // BLOCKED / MAINTENANCE / autre indispo
  return { bg: 'var(--warn-soft)', fg: 'var(--warn)' };
}

function statusLabel(day: Day): string {
  if (day.available) return 'Libre';
  switch ((day.status ?? '').toUpperCase()) {
    case 'BOOKED':
      return 'Réservé';
    case 'MAINTENANCE':
      return 'Maintenance';
    case 'BLOCKED':
      return 'Bloqué';
    default:
      return 'Indisponible';
  }
}

export const AvailabilityResult: React.FC<{ data: AvailabilityData }> = ({ data }) => {
  const days = Array.isArray(data.days) ? data.days : [];
  const visible = days.slice(0, MAX_CELLS);
  const hidden = days.length - visible.length;

  const available = data.availableNights ?? days.filter((d) => d.available).length;
  const unavailable = data.unavailableNights ?? days.length - available;

  return (
    <SurfaceCard>
      {/* Bandeau résumé */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.25, flexWrap: 'wrap' }}>
        <Box>
          <Overline>Disponibilité</Overline>
          <Typography sx={{ fontSize: '12px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
            {data.fullyAvailable
              ? 'Entièrement disponible'
              : `${available} nuit${available > 1 ? 's' : ''} libre${available > 1 ? 's' : ''} · ${unavailable} occupée${unavailable > 1 ? 's' : ''}`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.25, ml: 'auto', flexWrap: 'wrap' }}>
          {[
            { c: 'var(--ok)', l: 'Libre' },
            { c: 'var(--err)', l: 'Réservé' },
            { c: 'var(--warn)', l: 'Bloqué' },
          ].map((legend) => (
            <Box key={legend.l} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: legend.c }} />
              <Typography sx={{ fontSize: '10.5px', color: 'var(--faint)' }}>{legend.l}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Mini-grille des jours */}
      {visible.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {visible.map((day) => {
            const color = dayColor(day);
            const d = new Date(day.date);
            const dayNum = Number.isNaN(d.getTime()) ? '?' : d.getDate();
            return (
              <Tooltip key={day.date} title={`${day.date} · ${statusLabel(day)}`} arrow disableInteractive>
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: '6px',
                    bgcolor: color.bg,
                    color: color.fg,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {dayNum}
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      )}

      {hidden > 0 && (
        <Typography sx={{ display: 'block', mt: 0.75, fontSize: '11px', color: 'var(--faint)', fontStyle: 'italic' }}>
          + {hidden} jour{hidden > 1 ? 's' : ''} non affiché{hidden > 1 ? 's' : ''}
        </Typography>
      )}
    </SurfaceCard>
  );
};

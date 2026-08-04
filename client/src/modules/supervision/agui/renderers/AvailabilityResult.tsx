/* ============================================================
   AvailabilityResult — displayHint="availability"

   Payload backend (get_availability) :
     { propertyId, from, to, availableNights, unavailableNights,
       fullyAvailable, days: [{ date, available, status }] }
   → bandeau résumé (nuits libres/occupées) + mini-grille de jours
     colorée (vert=libre, ambre=bloqué/maintenance, rouge=réservé).
   ============================================================ */
import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../components/ui';
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
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <div>
          <Overline>Disponibilité</Overline>
          <p className="cn-text-body1 text-[12px] text-[var(--muted)] tabular-nums">
            {data.fullyAvailable
              ? 'Entièrement disponible'
              : `${available} nuit${available > 1 ? 's' : ''} libre${available > 1 ? 's' : ''} · ${unavailable} occupée${unavailable > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex gap-2 ms-auto flex-wrap">
          {[
            { c: 'var(--ok)', l: 'Libre' },
            { c: 'var(--err)', l: 'Réservé' },
            { c: 'var(--warn)', l: 'Bloqué' },
          ].map((legend) => (
            <div className="inline-flex items-center gap-0.5" key={legend.l}>
              <div className="w-[8px] h-[8px] rounded-[2px]" style={{ backgroundColor: legend.c }} />
              <p className="cn-text-body1 text-[10.5px] text-[var(--faint)]">{legend.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Mini-grille des jours */}
      {visible.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {visible.map((day) => {
            const color = dayColor(day);
            const d = new Date(day.date);
            const dayNum = Number.isNaN(d.getTime()) ? '?' : d.getDate();
            return (
              <Tooltip key={day.date}>
                <TooltipTrigger asChild>
                  <div className="w-[26px] h-[26px] rounded-[6px] inline-flex items-center justify-center text-[11px] font-semibold tabular-nums" style={{ backgroundColor: color.bg, color: color.fg }}>
                    {dayNum}
                  </div>
                </TooltipTrigger>
                <TooltipContent>{`${day.date} · ${statusLabel(day)}`}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      )}

      {hidden > 0 && (
        <p className="cn-text-body1 block mt-1 text-[11px] text-[var(--faint)] italic">
          + {hidden} jour{hidden > 1 ? 's' : ''} non affiché{hidden > 1 ? 's' : ''}
        </p>
      )}
    </SurfaceCard>
  );
};

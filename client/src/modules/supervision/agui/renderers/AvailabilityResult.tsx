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
import { cn } from '../../../../utils/cn';
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

/** Couple fond pastel / encre foncée : la teinte vive en texte ne passe pas AA. */
function dayClasses(day: Day): string {
  if (day.available) return 'bg-success-soft text-success-ink';
  const status = (day.status ?? '').toUpperCase();
  if (status === 'BOOKED') return 'bg-destructive-soft text-destructive-ink';
  // BLOCKED / MAINTENANCE / autre indispo
  return 'bg-warning-soft text-warning-ink';
}

/** Légende : pastilles décoratives, donc teinte vive. */
const LEGEND = [
  { dot: 'bg-success', label: 'Libre' },
  { dot: 'bg-destructive', label: 'Réservé' },
  { dot: 'bg-warning', label: 'Bloqué' },
] as const;

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
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <div>
          <Overline>Disponibilité</Overline>
          <p className="text-xs tabular-nums text-muted-foreground">
            {data.fullyAvailable
              ? 'Entièrement disponible'
              : `${available} nuit${available > 1 ? 's' : ''} libre${available > 1 ? 's' : ''} · ${unavailable} occupée${unavailable > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="ms-auto flex flex-wrap gap-2">
          {LEGEND.map((legend) => (
            <div className="inline-flex items-center gap-1" key={legend.label}>
              <span className={cn('size-2 rounded-[2px]', legend.dot)} />
              <span className="text-2xs text-muted-foreground">{legend.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mini-grille des jours */}
      {visible.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {visible.map((day) => {
            const d = new Date(day.date);
            const dayNum = Number.isNaN(d.getTime()) ? '?' : d.getDate();
            return (
              <Tooltip key={day.date}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'inline-flex size-[26px] items-center justify-center rounded-md text-xs font-semibold tabular-nums',
                      dayClasses(day),
                    )}
                  >
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
        <p className="mt-1 block text-2xs italic text-muted-foreground">
          + {hidden} jour{hidden > 1 ? 's' : ''} non affiché{hidden > 1 ? 's' : ''}
        </p>
      )}
    </SurfaceCard>
  );
};

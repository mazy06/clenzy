import React from 'react';
import { cn } from '../../../utils/cn';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Check } from '../../../icons';
import type { PlanningEvent } from '../types';
import { toDate } from '../utils/dateUtils';

// ─── Cycle de vie du séjour (projection Fiche réservation) ───────────────────
//
// Stepper horizontal Confirmée → Paiement → Arrivée → Départ, repris de
// BReservationDetailSectionDemo. Chaque jalon est dérivé de données déjà
// présentes sur l'objet réservation — jamais déduit du seul calendrier :
// « Arrivée » ne passe à fait que sur un statut checked_in explicite, une date
// passée sans check-in reste un jalon à venir. Masqué sur une annulation (le
// cycle de vie d'un séjour annulé n'a plus de sens).

type StepState = 'done' | 'current' | 'todo';

interface LifecycleStep {
  label: string;
  detail?: string;
  done: boolean;
}

/** « 12 août » + « , 15:00 » quand l'heure existe. */
function fmtMilestone(iso: string, time?: string): string {
  let day: string;
  try {
    day = format(toDate(iso), 'd MMM', { locale: fr });
  } catch {
    day = iso;
  }
  return time ? `${day}, ${time.slice(0, 5)}` : day;
}

export function buildSteps(reservation: NonNullable<PlanningEvent['reservation']>): LifecycleStep[] {
  const paid = reservation.paymentStatus === 'PAID' || reservation.collectedByChannel === true;
  const arrived = reservation.status === 'checked_in' || reservation.status === 'checked_out';
  return [
    {
      label: 'Confirmée',
      done: reservation.status !== 'pending',
    },
    {
      label: 'Paiement',
      detail: reservation.collectedByChannel
        ? 'via le canal'
        : reservation.paidAt
          ? fmtMilestone(reservation.paidAt)
          : paid
            ? undefined
            : 'en attente',
      done: paid,
    },
    {
      label: 'Arrivée',
      detail: fmtMilestone(reservation.checkIn, reservation.checkInTime),
      done: arrived,
    },
    {
      label: 'Départ',
      detail: fmtMilestone(reservation.checkOut, reservation.checkOutTime),
      done: reservation.status === 'checked_out',
    },
  ];
}

interface ReservationLifecycleProps {
  reservation: NonNullable<PlanningEvent['reservation']>;
}

const ReservationLifecycle: React.FC<ReservationLifecycleProps> = ({ reservation }) => {
  if (reservation.status === 'cancelled') return null;

  const steps = buildSteps(reservation);
  // Le jalon courant est le premier non atteint ; les suivants restent à venir.
  const currentIndex = steps.findIndex((step) => !step.done);

  return (
    <div className="flex items-center rounded-[12px] border border-solid border-[var(--line)] bg-[var(--field)] px-2 py-2">
      {steps.map((step, index) => {
        const state: StepState = step.done ? 'done' : index === currentIndex ? 'current' : 'todo';
        return (
          <div key={step.label} className={cn('flex items-center min-w-0', index > 0 && 'flex-1')}>
            {index > 0 && (
              <div
                className="h-px flex-1 min-w-[8px]"
                style={{ backgroundColor: state === 'todo' ? 'var(--line)' : 'var(--accent)' }}
              />
            )}
            <div className="flex flex-col items-center gap-[3px] px-1.5 text-center">
              <span
                className={cn(
                  'inline-flex size-5 items-center justify-center rounded-full shrink-0',
                  state === 'done' && 'bg-[var(--accent)] text-[var(--on-accent)]',
                  state === 'current' && 'bg-[var(--warn-soft)] text-[var(--warn)] ring-4 ring-[color-mix(in_srgb,var(--warn)_15%,transparent)]',
                  state === 'todo' && 'bg-[var(--hover)] text-[var(--muted)]',
                )}
              >
                {state === 'done'
                  ? <Check size={11} strokeWidth={2.5} />
                  : <span className="size-[6px] rounded-full bg-current" />}
              </span>
              <span
                className={cn(
                  'text-[0.625rem] font-semibold whitespace-nowrap',
                  state === 'current' ? 'text-[var(--warn)]' : 'text-[var(--ink)]',
                )}
              >
                {step.label}
              </span>
              {step.detail && (
                <span className="text-[0.625rem] whitespace-nowrap text-[var(--muted)] tabular-nums">
                  {step.detail}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ReservationLifecycle;

import { interventionsApi } from '../../../services/api/interventionsApi';
import type { PlanningIntervention } from '../../../services/api';

export interface BaitlyScheduleUpdate {
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
}

/** L'API Baitly attend une date locale et une durée entière en heures. */
export function getBaitlySchedulePayload(intervention: PlanningIntervention, updates: BaitlyScheduleUpdate) {
  const startDate = updates.startDate ?? intervention.startDate;
  const startTime = updates.startTime ?? intervention.startTime ?? '11:00';
  const scheduledDate = `${startDate}T${startTime.length === 5 ? `${startTime}:00` : startTime}`;
  if (updates.endDate == null && updates.endTime == null) return { scheduledDate };

  // UTC sert uniquement à soustraire des heures civiles, sans changement d'heure saisonnier.
  const endDate = updates.endDate ?? intervention.endDate;
  const endTime = updates.endTime ?? intervention.endTime;
  if (!endTime) throw new Error('L’heure de fin est nécessaire pour replanifier cette intervention.');
  const duration = (Date.parse(`${endDate}T${endTime}Z`) - Date.parse(`${startDate}T${startTime}Z`)) / 3_600_000;
  if (!Number.isInteger(duration) || duration < 1) {
    throw new Error('La durée de l’intervention doit être un nombre entier d’heures, supérieur ou égal à 1.');
  }
  return { scheduledDate, estimatedDurationHours: duration };
}

export async function saveBaitlyInterventionSchedule(intervention: PlanningIntervention, updates: BaitlyScheduleUpdate) {
  return interventionsApi.update(intervention.id, getBaitlySchedulePayload(intervention, updates));
}

/** Projection de la même date et de la même durée que celles sauvegardées par l'API. */
export function getBaitlyScheduleRange(intervention: PlanningIntervention, updates: BaitlyScheduleUpdate) {
  const payload = getBaitlySchedulePayload(intervention, updates);
  const duration = payload.estimatedDurationHours ?? intervention.estimatedDurationHours
    ?? (Date.parse(`${intervention.endDate}T${intervention.endTime || '00:00'}Z`)
      - Date.parse(`${intervention.startDate}T${intervention.startTime || '00:00'}Z`)) / 3_600_000;
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('La durée de l’intervention est manquante.');
  const end = new Date(Date.parse(`${payload.scheduledDate}Z`) + duration * 3_600_000).toISOString();
  return { startDate: payload.scheduledDate.slice(0, 10), startTime: payload.scheduledDate.slice(11, 19),
    endDate: end.slice(0, 10), endTime: end.slice(11, 19) };
}

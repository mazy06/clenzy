import apiClient from '../apiClient';

// ─── Disponibilites declarees par l'intervenant ─────────────────────────────
// Semaine type + absences datees. Elles vivent sur son equipe PERSONNELLE cote
// serveur : le moteur d'affectation ne raisonne qu'en equipes.
//
// REGLE : aucune declaration = disponible. Ne rien saisir laisse le prestataire
// eligible, exactement comme avant l'existence de cette fonctionnalite.

export interface WeeklySlot {
  id: number;
  /** ISO-8601 : 1 = lundi … 7 = dimanche. */
  dayOfWeek: number;
  /** Format « HH:mm:ss ». */
  startTime: string;
  endTime: string;
}

export interface Absence {
  id: number;
  startDate: string;
  endDate: string;
  reason: string | null;
}

export interface MyAvailability {
  weekly: WeeklySlot[];
  absences: Absence[];
}

export type WeeklySlotInput = Omit<WeeklySlot, 'id'>;

export const myAvailabilityApi = {
  getMine(): Promise<MyAvailability> {
    return apiClient.get<MyAvailability>('/my-availability');
  },

  /** REMPLACE la semaine type — elle se redecrit en entier. */
  replaceWeekly(slots: WeeklySlotInput[]): Promise<WeeklySlot[]> {
    return apiClient.put<WeeklySlot[]>('/my-availability/weekly', slots);
  },

  addAbsence(startDate: string, endDate: string, reason?: string | null): Promise<Absence> {
    return apiClient.post<Absence>('/my-availability/absences', { startDate, endDate, reason: reason || null });
  },

  removeAbsence(id: number): Promise<void> {
    return apiClient.delete<void>(`/my-availability/absences/${id}`);
  },
};

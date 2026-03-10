import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkflowSettingsData {
  autoAssignInterventions: boolean;
  cancellationDeadlineHours: number;
  requireApprovalForChanges: boolean;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const workflowSettingsApi = {
  /**
   * Retourne les parametres workflow de l'organisation courante.
   * Si aucun parametre n'existe, le backend retourne les valeurs par defaut.
   */
  get() {
    return apiClient.get<WorkflowSettingsData>('/workflow-settings');
  },

  /**
   * Met a jour les parametres workflow (upsert).
   * Necessite le role SUPER_ADMIN ou SUPER_MANAGER.
   */
  update(data: Partial<WorkflowSettingsData>) {
    return apiClient.put<WorkflowSettingsData>('/workflow-settings', data);
  },
};

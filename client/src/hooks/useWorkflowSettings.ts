import { useState, useEffect } from 'react';
import storageService, { STORAGE_KEYS } from '../services/storageService';

export interface WorkflowSettings {
  cancellationDeadlineHours: number;
  autoAssignInterventions: boolean;
  requireApprovalForChanges: boolean;
}

const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettings = {
  cancellationDeadlineHours: 24, // 24 heures par défaut
  autoAssignInterventions: true,
  requireApprovalForChanges: true,
};

export const useWorkflowSettings = () => {
  const [settings, setSettings] = useState<WorkflowSettings>(DEFAULT_WORKFLOW_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Charger les paramètres depuis le localStorage au montage
  useEffect(() => {
    try {
      const parsed = storageService.getJSON<WorkflowSettings>(STORAGE_KEYS.WORKFLOW_SETTINGS);
      if (parsed) {
        setSettings({ ...DEFAULT_WORKFLOW_SETTINGS, ...parsed });
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, []); // Dépendance vide - exécuté une seule fois au montage

  // Sauvegarder les paramètres dans le localStorage
  const updateSettings = (newSettings: Partial<WorkflowSettings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);
      storageService.setJSON(STORAGE_KEYS.WORKFLOW_SETTINGS, updatedSettings);
    } catch (error) {
    }
  };

  // Vérifier si une demande peut encore être annulée
  const canCancelServiceRequest = (approvedAt: string | null | undefined): boolean => {
    try {
      if (!approvedAt) {
        return false;
      }

      const approvedDate = new Date(approvedAt);
      if (isNaN(approvedDate.getTime())) {
        return false;
      }

      const now = new Date();
      const hoursDiff = (now.getTime() - approvedDate.getTime()) / (1000 * 60 * 60);
      const canCancel = hoursDiff <= settings.cancellationDeadlineHours;

      return canCancel;
    } catch (error) {
      return false;
    }
  };

  // Obtenir le temps restant pour annuler
  const getRemainingCancellationTime = (approvedAt: string | null | undefined): number => {
    try {
      if (!approvedAt) return 0;

      const approvedDate = new Date(approvedAt);
      if (isNaN(approvedDate.getTime())) return 0;

      const now = new Date();
      const hoursDiff = (now.getTime() - approvedDate.getTime()) / (1000 * 60 * 60);

      return Math.max(0, settings.cancellationDeadlineHours - hoursDiff);
    } catch (error) {
      return 0;
    }
  };

  return {
    settings,
    updateSettings,
    canCancelServiceRequest,
    getRemainingCancellationTime,
    loading,
  };
};

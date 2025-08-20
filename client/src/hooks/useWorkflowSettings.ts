import { useState, useEffect } from 'react';

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
      console.log('🔍 useWorkflowSettings - Initialisation...');
      const savedSettings = localStorage.getItem('workflow-settings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          console.log('🔍 useWorkflowSettings - Paramètres chargés:', parsed);
          setSettings({ ...DEFAULT_WORKFLOW_SETTINGS, ...parsed });
        } catch (error) {
          console.error('🔍 useWorkflowSettings - Erreur parsing:', error);
        }
      } else {
        console.log('🔍 useWorkflowSettings - Aucun paramètre sauvegardé, utilisation des valeurs par défaut');
      }
    } catch (error) {
      console.error('🔍 useWorkflowSettings - Erreur lors de l\'initialisation:', error);
    } finally {
      setLoading(false);
    }
  }, []); // Dépendance vide - exécuté une seule fois au montage

  // Sauvegarder les paramètres dans le localStorage
  const updateSettings = (newSettings: Partial<WorkflowSettings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);
      localStorage.setItem('workflow-settings', JSON.stringify(updatedSettings));
      console.log('🔍 useWorkflowSettings - Paramètres mis à jour:', updatedSettings);
    } catch (error) {
      console.error('🔍 useWorkflowSettings - Erreur lors de la sauvegarde:', error);
    }
  };

  // Vérifier si une demande peut encore être annulée
  const canCancelServiceRequest = (approvedAt: string | null | undefined): boolean => {
    try {
      console.log('🔍 useWorkflowSettings - Vérification annulation pour:', approvedAt);
      
      if (!approvedAt) {
        console.log('🔍 useWorkflowSettings - Pas de date d\'approbation');
        return false;
      }
      
      const approvedDate = new Date(approvedAt);
      if (isNaN(approvedDate.getTime())) {
        console.log('🔍 useWorkflowSettings - Date invalide:', approvedAt);
        return false;
      }
      
      const now = new Date();
      const hoursDiff = (now.getTime() - approvedDate.getTime()) / (1000 * 60 * 60);
      const canCancel = hoursDiff <= settings.cancellationDeadlineHours;
      
      console.log('🔍 useWorkflowSettings - Heures écoulées:', hoursDiff, 'Limite:', settings.cancellationDeadlineHours, 'Peut annuler:', canCancel);
      
      return canCancel;
    } catch (error) {
      console.error('🔍 useWorkflowSettings - Erreur lors de la vérification du délai d\'annulation:', error);
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
      console.error('🔍 useWorkflowSettings - Erreur lors du calcul du temps restant:', error);
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

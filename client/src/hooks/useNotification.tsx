import React, { createContext, useContext, useCallback, useMemo, ReactNode } from 'react';
import { toast } from 'sonner';
import { Toaster } from '../components/ui';

/**
 * Système de notification centralisé (toast).
 * Remplace les gestions d'erreur/succès locales dans chaque composant.
 *
 * @example
 * // Dans un composant
 * const { notify } = useNotification();
 * notify.success('Propriété créée avec succès');
 * notify.error('Erreur lors de la sauvegarde');
 * notify.warning('Attention: données incomplètes');
 * notify.info('Chargement en cours...');
 *
 * <h3>Pourquoi une file locale a disparu</h3>
 * L'ancienne implémentation gardait les notifications dans un `useState` du
 * provider et n'en affichait qu'UNE (`notifications[0]`) : les suivantes
 * attendaient sans être visibles, et chaque toast re-rendait le provider donc
 * tout l'arbre applicatif. `sonner` empile, expire et anime les toasts hors de
 * React, si bien que le provider ne détient plus d'état du tout.
 */

/** Conservé à l'identique de l'ancienne API MUI, que 13 écrans consomment. */
export type NotificationSeverity = 'success' | 'error' | 'warning' | 'info';

interface NotificationContextType {
  notify: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
  };
  /** Afficher une notification avec un type personnalisé */
  showNotification: (message: string, severity?: NotificationSeverity, duration?: number) => void;
  /** Fermer toutes les notifications */
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/** Durées de l'ancienne implémentation, reprises telles quelles. */
const DUREE_PAR_DEFAUT = 4000;
const DUREE_ERREUR = 6000;

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const showNotification = useCallback(
    (message: string, severity: NotificationSeverity = 'info', duration: number = DUREE_PAR_DEFAUT) => {
      toast[severity](message, { duration });
    },
    [],
  );

  const clearAll = useCallback(() => {
    toast.dismiss();
  }, []);

  // La valeur ne dépend plus d'aucun état : elle est stable pour toute la vie
  // de l'application, et les consommateurs ne se re-rendent plus a chaque toast.
  const contextValue = useMemo<NotificationContextType>(() => ({
    notify: {
      success: (message: string, duration?: number) => showNotification(message, 'success', duration),
      error: (message: string, duration?: number) => showNotification(message, 'error', duration ?? DUREE_ERREUR),
      warning: (message: string, duration?: number) => showNotification(message, 'warning', duration),
      info: (message: string, duration?: number) => showNotification(message, 'info', duration),
    },
    showNotification,
    clearAll,
  }), [showNotification, clearAll]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      {/* Position reprise de l'ancien Snackbar : bas, centré. */}
      <Toaster position="bottom-center" richColors closeButton />
    </NotificationContext.Provider>
  );
};

export function useNotification(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    // Fallback silencieux si le provider n'est pas monté (pour les tests)
    return {
      notify: {
        success: () => {},
        error: () => {},
        warning: () => {},
        info: () => {},
      },
      showNotification: () => {},
      clearAll: () => {},
    };
  }
  return context;
}

export default useNotification;

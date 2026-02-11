import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Snackbar, Alert, AlertColor, Slide, SlideProps } from '@mui/material';

/**
 * Système de notification centralisé (toast/snackbar).
 * Remplace les gestions d'erreur/succès locales dans chaque composant.
 *
 * @example
 * // Dans un composant
 * const { notify } = useNotification();
 * notify.success('Propriété créée avec succès');
 * notify.error('Erreur lors de la sauvegarde');
 * notify.warning('Attention: données incomplètes');
 * notify.info('Chargement en cours...');
 */

interface Notification {
  id: string;
  message: string;
  severity: AlertColor;
  duration?: number;
}

interface NotificationContextType {
  notify: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
  };
  /** Afficher une notification avec un type personnalisé */
  showNotification: (message: string, severity?: AlertColor, duration?: number) => void;
  /** Fermer toutes les notifications */
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Transition de slide pour le Snackbar
function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="up" />;
}

// Compteur unique pour les IDs
let notificationCounter = 0;

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((message: string, severity: AlertColor = 'info', duration: number = 4000) => {
    const id = `notification-${++notificationCounter}`;
    setNotifications(prev => [...prev, { id, message, severity, duration }]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const notify = {
    success: (message: string, duration?: number) => addNotification(message, 'success', duration),
    error: (message: string, duration?: number) => addNotification(message, 'error', duration ?? 6000),
    warning: (message: string, duration?: number) => addNotification(message, 'warning', duration),
    info: (message: string, duration?: number) => addNotification(message, 'info', duration),
  };

  const currentNotification = notifications[0] || null;

  return (
    <NotificationContext.Provider value={{ notify, showNotification: addNotification, clearAll }}>
      {children}
      {currentNotification && (
        <Snackbar
          key={currentNotification.id}
          open={true}
          autoHideDuration={currentNotification.duration}
          onClose={() => removeNotification(currentNotification.id)}
          TransitionComponent={SlideTransition}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => removeNotification(currentNotification.id)}
            severity={currentNotification.severity}
            variant="filled"
            sx={{ width: '100%', minWidth: 300 }}
          >
            {currentNotification.message}
          </Alert>
        </Snackbar>
      )}
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

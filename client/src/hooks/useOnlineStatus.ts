import { useState, useEffect } from 'react';

/**
 * Hook pour détecter le statut de connexion réseau (en ligne / hors ligne).
 * Utilise `navigator.onLine` et écoute les événements `online` / `offline`.
 */
export function useOnlineStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}

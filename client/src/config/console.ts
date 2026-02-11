// Configuration de la console pour filtrer les erreurs d'extensions
export const configureConsole = (): void => {
  // Sauvegarder la console originale
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  // Filtrer les erreurs d'extensions
  console.error = (...args: unknown[]): void => {
    const message = args.join(' ');
    
    // Ignorer les erreurs d'extensions
    if (
      message.includes('FrameDoesNotExistError') ||
      message.includes('message port closed') ||
      message.includes('chrome-extension://') ||
      message.includes('Failed to load resource') ||
      message.includes('net::ERR_FILE_NOT_FOUND')
    ) {
      return;
    }
    
    // Afficher les vraies erreurs de l'application
    originalConsoleError.apply(console, args);
  };

  // Filtrer les warnings d'extensions
  console.warn = (...args: unknown[]): void => {
    const message = args.join(' ');
    
    // Ignorer les warnings d'extensions
    if (
      message.includes('Slow network is detected') ||
      message.includes('chrome-extension://') ||
      message.includes('iframe which has both allow-scripts')
    ) {
      return;
    }
    
    // Afficher les vrais warnings de l'application
    originalConsoleWarn.apply(console, args);
  };

};

// Fonction pour restaurer la console originale
export const restoreConsole = (): void => {
  const win = window as Window & { originalConsoleError?: typeof console.error; originalConsoleWarn?: typeof console.warn };
  if (win.originalConsoleError) {
    console.error = win.originalConsoleError;
  }
  if (win.originalConsoleWarn) {
    console.warn = win.originalConsoleWarn;
  }
};

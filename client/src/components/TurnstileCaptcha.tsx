import React, { useEffect, useRef, useCallback } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface TurnstileCaptchaProps {
  onVerified: (token: string) => void;
  onError?: (message: string) => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

export default function TurnstileCaptcha({ onVerified, onError }: TurnstileCaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const scriptLoadedRef = useRef(false);

  const renderWidget = useCallback(() => {
    if (!window.turnstile || !containerRef.current || widgetIdRef.current) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      theme: 'light',
      callback: (token: string) => onVerified(token),
      'error-callback': () => onError?.('Erreur de vérification. Réessayez.'),
      'expired-callback': () => onError?.('Vérification expirée. Réessayez.'),
    });
  }, [onVerified, onError]);

  useEffect(() => {
    // Si le script est déjà chargé globalement
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Vérifier si le script est déjà dans le DOM
    if (document.querySelector(`script[src*="turnstile"]`)) {
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          scriptLoadedRef.current = true;
          renderWidget();
        }
      }, 100);
      return () => clearInterval(interval);
    }

    // Charger le script Turnstile
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoadedRef.current = true;
      // turnstile peut prendre un instant après le load du script
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          renderWidget();
        }
      }, 50);
      setTimeout(() => clearInterval(interval), 5000);
    };
    script.onerror = () => onError?.('Impossible de charger la vérification.');
    document.head.appendChild(script);

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget, onError]);

  if (!SITE_KEY) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', textAlign: 'center', py: 1 }}>
        Vérification CAPTCHA non configurée.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', minHeight: 65 }}>
      <div ref={containerRef} />
      {!widgetIdRef.current && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={20} sx={{ color: 'secondary.main' }} />
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
            Chargement...
          </Typography>
        </Box>
      )}
    </Box>
  );
}

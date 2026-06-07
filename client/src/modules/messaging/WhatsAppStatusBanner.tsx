import React, { useEffect, useState } from 'react';
import { Alert, AlertTitle, Box, CircularProgress } from '@mui/material';
import { useTranslation } from '../../hooks/useTranslation';
import { whatsAppConfigApi, type WhatsAppConfig } from '../../services/api/whatsAppConfigApi';

/**
 * Bandeau read-only de statut WhatsApp pour l'org courante (HOST).
 *
 * <p>La configuration du provider WhatsApp (credentials Meta/OpenWA) est gérée
 * par la plateforme depuis l'onglet Organisation. Le HOST ne l'édite pas, mais
 * a besoin de savoir si WhatsApp est actif pour comprendre pourquoi ses
 * automatisations partent (ou non) sur ce canal — d'où ce bandeau informatif.</p>
 *
 * <p>Lit {@code GET /whatsapp/config} (org courante, sans secret). Échec
 * silencieux : un bandeau informatif ne doit pas bloquer l'écran.</p>
 */
export default function WhatsAppStatusBanner() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await whatsAppConfigApi.getConfig();
        if (!cancelled) setConfig(data);
      } catch {
        // Silencieux : informatif uniquement.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
        <CircularProgress size={14} />
      </Box>
    );
  }

  // Aucune config provisionnée par la plateforme pour cette org.
  if (!config) {
    return (
      <Alert severity="info" sx={{ borderRadius: '8px' }}>
        <AlertTitle sx={{ fontWeight: 600 }}>
          {t('messaging.whatsappStatus.notConfiguredTitle', 'WhatsApp non configuré')}
        </AlertTitle>
        {t(
          'messaging.whatsappStatus.notConfiguredBody',
          "L'envoi WhatsApp n'est pas encore configuré pour votre organisation. Contactez votre gestionnaire de plateforme pour l'activer.",
        )}
      </Alert>
    );
  }

  const providerLabel = config.provider === 'OPENWA' ? 'OpenWA' : 'Meta Cloud API';
  const isConfigured =
    config.provider === 'OPENWA'
      ? !!(config.hasOpenwaApiKey && config.openwaSessionId)
      : !!(config.hasApiToken && config.phoneNumberId);

  // Config présente mais désactivée ou incomplète.
  if (!config.enabled || !isConfigured) {
    return (
      <Alert severity="warning" sx={{ borderRadius: '8px' }}>
        <AlertTitle sx={{ fontWeight: 600 }}>
          {t('messaging.whatsappStatus.disabledTitle', 'WhatsApp désactivé')}
        </AlertTitle>
        {t(
          'messaging.whatsappStatus.disabledBody',
          "L'envoi WhatsApp est géré par votre plateforme et n'est pas actif actuellement. Vos messages voyageurs ne partiront pas sur ce canal.",
        )}
      </Alert>
    );
  }

  // WhatsApp actif et configuré.
  return (
    <Alert severity="success" sx={{ borderRadius: '8px' }}>
      <AlertTitle sx={{ fontWeight: 600 }}>
        {t('messaging.whatsappStatus.activeTitle', 'WhatsApp actif')}
      </AlertTitle>
      {t(
        'messaging.whatsappStatus.activeBody',
        "L'envoi WhatsApp est actif via {{provider}}, géré par votre plateforme.",
        { provider: providerLabel },
      )}
    </Alert>
  );
}

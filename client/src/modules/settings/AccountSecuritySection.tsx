import React, { useState } from 'react';
import { Alert, Button, CircularProgress } from '@mui/material';
import { Security } from '../../icons';
import apiClient from '../../services/apiClient';
import SettingsSection from './components/SettingsSection';

/**
 * Section « Sécurité » de Paramètres > Général.
 *
 * <p>Changement de mot de passe de l'utilisateur connecté : le backend déclenche
 * l'email Keycloak (action token UPDATE_PASSWORD) — le mot de passe n'est jamais
 * saisi ni transité par le PMS, le lien email prouve la possession du compte.</p>
 */
export default function AccountSecuritySection() {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);

  const handleSendResetEmail = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      await apiClient.post('/auth/password-reset-email', {});
      setFeedback({
        severity: 'success',
        message: 'Un email vient de vous être envoyé avec un lien sécurisé pour changer votre mot de passe. Pensez à vérifier vos spams.',
      });
    } catch {
      setFeedback({
        severity: 'error',
        message: "Impossible d'envoyer l'email pour le moment. Réessayez dans un instant ou contactez le support.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsSection
      title="Sécurité"
      icon={Security}
      accent="info"
      description="Mot de passe et protection du compte"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="cn-text-body1 text-[0.8125rem] font-semibold text-foreground mb-0">
            Mot de passe
          </p>
          <p className="cn-text-body1 text-[0.72rem] text-muted-foreground">
            Recevez par email un lien sécurisé pour définir un nouveau mot de passe.
          </p>
        </div>
        <Button
          variant="outlined"
          size="small"
          onClick={handleSendResetEmail}
          disabled={loading}
          sx={{ textTransform: 'none', fontWeight: 600, flexShrink: 0 }}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : 'Changer mon mot de passe'}
        </Button>
      </div>
      {feedback && (
        <Alert severity={feedback.severity} sx={{ mt: 1.5, borderRadius: 1.5 }}>
          <p className="cn-text-body2 text-[0.8125rem]">{feedback.message}</p>
        </Alert>
      )}
    </SettingsSection>
  );
}

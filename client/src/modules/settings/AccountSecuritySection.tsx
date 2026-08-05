import React, { useState } from 'react';
import { Alert, AlertDescription, Button, Spinner } from '../../components/ui';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { Security } from '../../icons';
import apiClient from '../../services/apiClient';
import SettingsSection from './components/SettingsSection';
import SettingsToggleRow from './components/SettingsToggleRow';

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
      {/* La rangee « libelle + aide + action » est la primitive de l'ecran
          (`SettingsToggleRow`), pas une mise en page a redessiner ici. */}
      <SettingsToggleRow
        title="Mot de passe"
        description="Recevez par email un lien sécurisé pour définir un nouveau mot de passe."
        divider={false}
        control={(
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={handleSendResetEmail}
            disabled={loading}
          >
            {loading ? <Spinner className="size-[18px]" /> : 'Changer mon mot de passe'}
          </Button>
        )}
      />
      {feedback && (
        <Alert variant={feedback.severity === 'success' ? 'success' : 'destructive'} className="mt-2">
          {feedback.severity === 'success' ? <CircleCheck /> : <TriangleAlert />}
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}
    </SettingsSection>
  );
}

import React, { useState } from 'react';
import { Alert, AlertDescription, Button, Spinner } from '../../components/ui';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { Lock, Security } from '../../icons';
import apiClient from '../../services/apiClient';
import SettingsSection from './components/SettingsSection';
import SettingsToggleRow from './components/SettingsToggleRow';

interface AccountSecuritySectionProps {
  /**
   * Registre RGPD rendu dans la MÊME carte, sous le mot de passe (cf.
   * PrivacyRequestsSection). Absent quand le rôle n'y a pas droit : la carte
   * se réduit alors au mot de passe, et son titre avec.
   */
  privacyRegister?: React.ReactNode;
}

/**
 * Section « Sécurité et confidentialité » de Paramètres > Général.
 *
 * <p>Changement de mot de passe de l'utilisateur connecté : le backend déclenche
 * l'email Keycloak (action token UPDATE_PASSWORD) — le mot de passe n'est jamais
 * saisi ni transité par le PMS, le lien email prouve la possession du compte.</p>
 *
 * <p>Le registre des demandes RGPD partage cette carte plutôt que d'en occuper
 * une seconde : c'est le même sujet — ce que le compte protège, et ce qu'il doit
 * rendre — et le mot de passe, seul, laissait une carte aux trois quarts vide à
 * côté de « Mon compte ».</p>
 */
export default function AccountSecuritySection({ privacyRegister }: AccountSecuritySectionProps) {
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

  const withPrivacy = Boolean(privacyRegister);

  return (
    <SettingsSection
      title={withPrivacy ? 'Sécurité et confidentialité' : 'Sécurité'}
      icon={Security}
      accent="info"
      description={withPrivacy
        ? 'Mot de passe, protection du compte et demandes RGPD des voyageurs'
        : 'Mot de passe et protection du compte'}
    >
      {/* La rangee « libelle + aide + action » est la primitive de l'ecran
          (`SettingsToggleRow`), pas une mise en page a redessiner ici. */}
      <SettingsToggleRow
        icon={Lock}
        iconColor="var(--bui-info)"
        title="Mot de passe"
        description="Recevez par email un lien sécurisé pour définir un nouveau mot de passe."
        divider={withPrivacy}
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

      {privacyRegister}
    </SettingsSection>
  );
}

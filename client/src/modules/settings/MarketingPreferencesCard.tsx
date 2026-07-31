import React, { useEffect, useState, useCallback } from 'react';
import { Alert as UiAlert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Switch, Alert, Snackbar } from '@mui/material';
import { Card } from '../../components/ui';
import { Mail } from '../../icons';
import { usersApi } from '../../services/api/usersApi';

/**
 * Card de gestion des preferences marketing — actuellement uniquement l'opt-in
 * newsletter Baitly.
 *
 * <p><b>Conformite RGPD article 7-3</b> : le retrait du consentement doit etre
 * aussi simple que son octroi. Cette card permet a l'utilisateur de retirer
 * son consentement newsletter en un clic, sans contact support, sans email
 * de confirmation requis.</p>
 *
 * <p>Auto-save au toggle : pas de bouton "Enregistrer" — la valeur est
 * persistee immediatement (optimistic update + rollback en cas d'erreur).</p>
 */
export default function MarketingPreferencesCard() {
  const [newsletterOptIn, setNewsletterOptIn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const loadPreferences = useCallback(async () => {
    try {
      const data = await usersApi.getMyMarketingPreferences();
      setNewsletterOptIn(data.newsletterOptIn);
    } catch {
      setLoadError('Impossible de charger vos préférences marketing.');
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const handleToggle = async (next: boolean) => {
    if (newsletterOptIn === null) return;

    const previous = newsletterOptIn;
    // Optimistic update — l'utilisateur voit le changement immediatement
    setNewsletterOptIn(next);
    setSaving(true);

    try {
      const result = await usersApi.updateMyMarketingPreferences(next);
      setNewsletterOptIn(result.newsletterOptIn);
      setSnackbar({
        open: true,
        message: next
          ? 'Vous recevrez désormais notre newsletter.'
          : 'Vous ne recevrez plus notre newsletter.',
        severity: 'success',
      });
    } catch {
      // Rollback en cas d'erreur
      setNewsletterOptIn(previous);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la sauvegarde. Réessayez.',
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="gap-0 py-0 p-3">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="inline-flex text-[secondary.main]">
          <Mail size={20} strokeWidth={1.75} />
        </span>
        <h6 className="cn-text-subtitle1 font-semibold text-[0.95rem]">
          Préférences marketing
        </h6>
      </div>

      <p className="cn-text-body2 text-muted-foreground mb-3 text-[0.8rem]">
        Gérez les communications marketing que vous recevez de Baitly. Vous pouvez retirer
        votre consentement à tout moment, conformément à l'article 7-3 du RGPD.
      </p>

      {loadError && (
        <UiAlert variant="warning" className="mb-3">
          <TriangleAlert />
          <AlertDescription>{loadError}</AlertDescription>
        </UiAlert>
      )}

      {newsletterOptIn === null && !loadError ? (
        <div className="flex justify-center py-3">
          <Spinner className="size-5" />
        </div>
      ) : (
        <div className="flex items-center justify-between py-1.5 px-2 border border-[divider] rounded-[1.5px]">
          <div className="flex-1 min-w-0 pe-3">
            <p className="cn-text-body2 font-semibold text-[0.875rem]">
              Newsletter Baitly
            </p>
            <span className="cn-text-caption text-muted-foreground block text-[0.75rem]">
              Nouveautés produit, conseils gestion locative, témoignages clients.
              Environ 1 email par mois.
            </span>
          </div>
          <Switch
            checked={!!newsletterOptIn}
            onChange={(e) => handleToggle(e.target.checked)}
            disabled={saving}
            inputProps={{ 'aria-label': 'Activer ou désactiver la newsletter Baitly' }}
          />
        </div>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Card>
  );
}

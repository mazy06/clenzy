import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Switch,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import { Mail } from '../../icons';
import { usersApi } from '../../services/api';

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
    <Paper sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'secondary.main' }}>
          <Mail size={20} strokeWidth={1.75} />
        </Box>
        <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
          Préférences marketing
        </Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.8rem' }}>
        Gérez les communications marketing que vous recevez de Baitly. Vous pouvez retirer
        votre consentement à tout moment, conformément à l'article 7-3 du RGPD.
      </Typography>

      {loadError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}

      {newsletterOptIn === null && !loadError ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={20} />
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            py: 1,
            px: 1.5,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0, pr: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
              Newsletter Baitly
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem' }}>
              Nouveautés produit, conseils gestion locative, témoignages clients.
              Environ 1 email par mois.
            </Typography>
          </Box>
          <Switch
            checked={!!newsletterOptIn}
            onChange={(e) => handleToggle(e.target.checked)}
            disabled={saving}
            inputProps={{ 'aria-label': 'Activer ou désactiver la newsletter Baitly' }}
          />
        </Box>
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
    </Paper>
  );
}

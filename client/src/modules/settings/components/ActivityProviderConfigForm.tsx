import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Snackbar,
  Switch,
  TextField,
} from '@mui/material';
import type { AlertColor } from '@mui/material';
import { useTranslation } from '../../../hooks/useTranslation';
import { activitiesApi, type ActivityProvider } from '../../../services/api/activitiesApi';

/**
 * Config d'affiliation d'UN seul fournisseur d'activités (clé API + ID affilié + actif),
 * destinée à être rendue dans le modal du marketplace concerné. La clé API n'est jamais
 * renvoyée par l'API (chiffrée) — on affiche « déjà configurée » si une clé existe.
 */
export default function ActivityProviderConfigForm({ provider }: { provider: ActivityProvider }) {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [affiliateId, setAffiliateId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: AlertColor }>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    let active = true;
    activitiesApi
      .listConfigs()
      .then((configs) => {
        if (!active) return;
        const c = configs.find((x) => x.provider === provider);
        setAffiliateId(c?.affiliateId ?? '');
        setEnabled(c?.enabled ?? false);
        setHasKey(c?.hasKey ?? false);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [provider]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await activitiesApi.upsertConfig(provider, {
        apiKey: apiKey.trim() || null,
        affiliateId: affiliateId.trim() || null,
        enabled,
      });
      setApiKey('');
      setHasKey(saved.hasKey);
      setEnabled(saved.enabled);
      setAffiliateId(saved.affiliateId ?? '');
      setSnackbar({ open: true, message: t('welcomeGuide.messages.updated', 'Enregistré'), severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: t('welcomeGuide.messages.error', 'Une erreur est survenue'), severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={22} />
      </Box>
    );
  }

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5, mb: 1.5 }}>
      <FormControlLabel
        control={<Switch size="small" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
        label={t('welcomeGuide.activities.enabled', 'Actif')}
      />
      <TextField
        label={
          hasKey
            ? t('welcomeGuide.activities.apiKeySet', 'Clé API (déjà configurée)')
            : t('welcomeGuide.activities.apiKey', 'Clé API')
        }
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        size="small"
        fullWidth
        placeholder={hasKey ? '••••••••' : ''}
        sx={{ mt: 0.5, mb: 1 }}
      />
      <TextField
        label={t('welcomeGuide.activities.affiliateId', 'ID affilié')}
        value={affiliateId}
        onChange={(e) => setAffiliateId(e.target.value)}
        size="small"
        fullWidth
        sx={{ mb: 1 }}
      />
      <Button
        size="small"
        variant="contained"
        onClick={handleSave}
        disabled={saving}
        startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
      >
        {t('welcomeGuide.actions.save', 'Enregistrer')}
      </Button>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

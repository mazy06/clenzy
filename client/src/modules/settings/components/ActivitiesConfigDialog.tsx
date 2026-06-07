import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { AlertColor } from '@mui/material';
import { useTranslation } from '../../../hooks/useTranslation';
import { activitiesApi, type ActivityProvider } from '../../../services/api/activitiesApi';

type ActRow = { apiKey: string; affiliateId: string; enabled: boolean; hasKey: boolean };

const ACT_PROVIDERS: { id: ActivityProvider; name: string }[] = [
  { id: 'VIATOR', name: 'Viator' },
  { id: 'GETYOURGUIDE', name: 'GetYourGuide' },
  { id: 'KLOOK', name: 'Klook' },
];

interface ActivitiesConfigDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Connexion des fournisseurs d'activités (clé API + ID affilié par provider, org-scopé).
 * Vit dans la tab Intégrations (sa place naturelle parmi les autres connexions),
 * et alimente la section « Activités » du livret d'accueil.
 */
export default function ActivitiesConfigDialog({ open, onClose }: ActivitiesConfigDialogProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Record<string, ActRow>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: AlertColor }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const notify = (message: string, severity: AlertColor = 'success') =>
    setSnackbar({ open: true, message, severity });

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    activitiesApi
      .listConfigs()
      .then((configs) => {
        if (!active) return;
        const byProvider = new Map(configs.map((c) => [c.provider, c]));
        const next: Record<string, ActRow> = {};
        for (const p of ACT_PROVIDERS) {
          const c = byProvider.get(p.id);
          next[p.id] = {
            apiKey: '',
            affiliateId: c?.affiliateId ?? '',
            enabled: c?.enabled ?? false,
            hasKey: c?.hasKey ?? false,
          };
        }
        setRows(next);
      })
      .catch(() => notify(t('welcomeGuide.messages.error', 'Une erreur est survenue'), 'error'))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, t]);

  const updateRow = (provider: string, patch: Partial<ActRow>) =>
    setRows((s) => ({ ...s, [provider]: { ...s[provider], ...patch } }));

  const save = async (provider: ActivityProvider) => {
    const row = rows[provider];
    if (!row) return;
    try {
      const saved = await activitiesApi.upsertConfig(provider, {
        apiKey: row.apiKey.trim() || null,
        affiliateId: row.affiliateId.trim() || null,
        enabled: row.enabled,
      });
      updateRow(provider, {
        apiKey: '',
        hasKey: saved.hasKey,
        enabled: saved.enabled,
        affiliateId: saved.affiliateId ?? '',
      });
      notify(t('welcomeGuide.messages.updated', 'Enregistré'));
    } catch {
      notify(t('welcomeGuide.messages.error', 'Une erreur est survenue'), 'error');
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{t('welcomeGuide.activities.title', 'Activités (affiliation)')}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(
              'welcomeGuide.activities.note',
              "Connectez un service d'activités pour proposer des excursions à vos voyageurs (et toucher une commission). Renseignez votre clé API partenaire.",
            )}
          </Typography>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Stack spacing={2.5}>
              {ACT_PROVIDERS.map((p) => {
                const row = rows[p.id];
                if (!row) return null;
                return (
                  <Box key={p.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {p.name}
                      </Typography>
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={row.enabled}
                            onChange={(e) => updateRow(p.id, { enabled: e.target.checked })}
                          />
                        }
                        label={t('welcomeGuide.activities.enabled', 'Actif')}
                      />
                    </Box>
                    <TextField
                      label={
                        row.hasKey
                          ? t('welcomeGuide.activities.apiKeySet', 'Clé API (déjà configurée)')
                          : t('welcomeGuide.activities.apiKey', 'Clé API')
                      }
                      type="password"
                      value={row.apiKey}
                      onChange={(e) => updateRow(p.id, { apiKey: e.target.value })}
                      size="small"
                      fullWidth
                      placeholder={row.hasKey ? '••••••••' : ''}
                      sx={{ mb: 1 }}
                    />
                    <TextField
                      label={t('welcomeGuide.activities.affiliateId', 'ID affilié')}
                      value={row.affiliateId}
                      onChange={(e) => updateRow(p.id, { affiliateId: e.target.value })}
                      size="small"
                      fullWidth
                      sx={{ mb: 1 }}
                    />
                    <Button size="small" variant="contained" onClick={() => save(p.id)}>
                      {t('welcomeGuide.actions.save', 'Enregistrer')}
                    </Button>
                  </Box>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('welcomeGuide.actions.close', 'Fermer')}</Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

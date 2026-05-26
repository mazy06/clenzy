import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  TextField,
  FormGroup,
  Checkbox,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import apiClient from '../../services/apiClient';
import { useNotification } from '../../hooks/useNotification';

/**
 * Section "Briefings IA" du panneau /settings → onglet IA.
 *
 * Permet a l'user de configurer ses briefings proactifs :
 *  - on/off global
 *  - frequence : daily_morning / weekly_sunday / only_alerts
 *  - canaux : in_app / email / whatsapp (multi-select)
 *  - heure locale + timezone (auto-detectee au premier chargement si pas set)
 *
 * Backend : GET/PUT /api/assistant/briefings/prefs + POST /trigger pour test.
 */

type Frequency = 'daily_morning' | 'weekly_sunday' | 'only_alerts';

interface BriefingPrefs {
  enabled: boolean;
  frequency: Frequency;
  channels: string[];
  timeLocal: string; // HH:mm
  timezone: string;
}

const FREQUENCY_OPTIONS: Array<{ value: Frequency; label: string; description: string }> = [
  {
    value: 'daily_morning',
    label: 'Tous les matins',
    description: 'KPIs de la veille + journée du jour + recommandations.',
  },
  {
    value: 'weekly_sunday',
    label: 'Hebdomadaire (dimanche)',
    description: 'Revue de la semaine + priorités semaine prochaine.',
  },
  {
    value: 'only_alerts',
    label: 'Seulement les alertes',
    description: 'Quotidien, mais envoyé uniquement si une anomalie critique est détectée.',
  },
];

const CHANNEL_OPTIONS: Array<{ value: string; label: string; description: string }> = [
  { value: 'in_app', label: 'In-app', description: 'Notification dans Clenzy + lien direct vers la conversation.' },
  { value: 'email', label: 'Email', description: 'Briefing complet envoyé à ton adresse email.' },
  { value: 'whatsapp', label: 'WhatsApp', description: 'Court résumé via template approuvé.' },
];

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
  } catch {
    return 'Europe/Paris';
  }
}

export const AssistantBriefingPrefs: React.FC = () => {
  const theme = useTheme();
  const { notify } = useNotification();
  const [prefs, setPrefs] = useState<BriefingPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chargement initial
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<BriefingPrefs>('/assistant/briefings/prefs')
      .then((data) => {
        if (cancelled) return;
        // Auto-detect timezone si la valeur retournee est generique et que le browser
        // peut faire mieux.
        const tz = data.timezone || detectTimezone();
        setPrefs({ ...data, timezone: tz });
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Chargement impossible');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const update = useCallback(<K extends keyof BriefingPrefs>(key: K, value: BriefingPrefs[K]) => {
    setPrefs((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const toggleChannel = useCallback((channel: string) => {
    setPrefs((prev) => {
      if (!prev) return prev;
      const has = prev.channels.includes(channel);
      const next = has ? prev.channels.filter((c) => c !== channel) : [...prev.channels, channel];
      // On garantit au moins 1 canal — sinon les briefings ne servent a rien.
      return { ...prev, channels: next.length > 0 ? next : prev.channels };
    });
  }, []);

  const save = useCallback(async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      const updated = await apiClient.put<BriefingPrefs>('/assistant/briefings/prefs', prefs);
      setPrefs(updated);
      notify.success('Préférences de briefing enregistrées.');
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Sauvegarde impossible.');
    } finally {
      setSaving(false);
    }
  }, [prefs, notify]);

  const triggerTest = useCallback(async () => {
    setTriggering(true);
    try {
      const result = await apiClient.post<{ delivered: string[]; conversationId?: number }>(
        '/assistant/briefings/trigger',
        {},
      );
      const channels = result.delivered.length > 0
        ? result.delivered.join(', ')
        : 'aucun (vérifie tes canaux)';
      notify.success(`Briefing test envoyé via : ${channels}`);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Trigger test échoué.');
    } finally {
      setTriggering(false);
    }
  }, [notify]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress size={24} />
      </Box>
    );
  }
  if (error || !prefs) {
    return <Alert severity="error">{error ?? 'Données indisponibles.'}</Alert>;
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, md: 3 },
        bgcolor: alpha(theme.palette.primary.main, 0.025),
        border: 'none',
        borderRadius: 2,
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
        Briefings IA
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Reçois automatiquement un résumé proactif de ton activité aux horaires
        choisis. Sans configuration, l'assistant reste réactif uniquement.
      </Typography>

      {/* Toggle on/off */}
      <FormControlLabel
        control={
          <Switch
            checked={prefs.enabled}
            onChange={(e) => update('enabled', e.target.checked)}
          />
        }
        label={
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Activer les briefings
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Aucun envoi tant que cette option est désactivée.
            </Typography>
          </Box>
        }
        sx={{ alignItems: 'center', mb: 2 }}
      />

      <Divider sx={{ my: 2, opacity: prefs.enabled ? 1 : 0.3 }} />

      <Box sx={{ opacity: prefs.enabled ? 1 : 0.5, pointerEvents: prefs.enabled ? 'auto' : 'none' }}>
        {/* Frequence */}
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          Fréquence
        </Typography>
        <Select
          value={prefs.frequency}
          onChange={(e) => update('frequency', e.target.value as Frequency)}
          size="small"
          fullWidth
          sx={{ mb: 0.5, maxWidth: 420 }}
        >
          {FREQUENCY_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2.5 }}>
          {FREQUENCY_OPTIONS.find((o) => o.value === prefs.frequency)?.description}
        </Typography>

        {/* Canaux */}
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          Canaux
        </Typography>
        <FormGroup sx={{ mb: 2.5 }}>
          {CHANNEL_OPTIONS.map((opt) => (
            <FormControlLabel
              key={opt.value}
              control={
                <Checkbox
                  checked={prefs.channels.includes(opt.value)}
                  onChange={() => toggleChannel(opt.value)}
                  size="small"
                />
              }
              label={
                <Box>
                  <Typography variant="body2">{opt.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {opt.description}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', mb: 0.25 }}
            />
          ))}
        </FormGroup>

        {/* Heure et timezone */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2.5 }}>
          <TextField
            label="Heure d'envoi"
            type="time"
            size="small"
            value={prefs.timeLocal}
            onChange={(e) => update('timeLocal', e.target.value)}
            inputProps={{ step: 300 }}
            sx={{ minWidth: 140 }}
          />
          <TextField
            label="Fuseau horaire"
            size="small"
            value={prefs.timezone}
            onChange={(e) => update('timezone', e.target.value)}
            helperText={`Détecté : ${detectTimezone()}`}
            sx={{ minWidth: 220 }}
          />
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        <Button
          variant="contained"
          onClick={save}
          disabled={saving || loading}
          sx={{ textTransform: 'none', cursor: 'pointer' }}
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
        <Button
          variant="outlined"
          onClick={triggerTest}
          disabled={triggering || !prefs.enabled}
          sx={{ textTransform: 'none', cursor: 'pointer' }}
        >
          {triggering ? 'Envoi en cours...' : 'Envoyer un test'}
        </Button>
      </Box>
    </Paper>
  );
};

export default AssistantBriefingPrefs;

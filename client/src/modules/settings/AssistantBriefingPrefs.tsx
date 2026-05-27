import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  TextField,
  Checkbox,
  Button,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import apiClient from '../../services/apiClient';
import { useNotification } from '../../hooks/useNotification';
import AiSettingsCard from './AiSettingsCard';

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
    <AiSettingsCard
      title="Briefings IA"
      subtitle="Reçois automatiquement un résumé proactif de ton activité aux horaires choisis. Sans configuration, l'assistant reste réactif uniquement."
      action={
        <FormControlLabel
          control={
            <Switch
              checked={prefs.enabled}
              onChange={(e) => update('enabled', e.target.checked)}
              size="small"
            />
          }
          label={
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {prefs.enabled ? 'Activé' : 'Désactivé'}
            </Typography>
          }
          sx={{ m: 0, gap: 0.5 }}
        />
      }
    >
      <Box
        sx={{
          opacity: prefs.enabled ? 1 : 0.5,
          pointerEvents: prefs.enabled ? 'auto' : 'none',
          transition: 'opacity 150ms ease',
        }}
      >
        {/* ── Ligne 1 : Frequence + Heure + Fuseau ─────────────────────── */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: '1fr 1fr',
              md: 'minmax(240px, 2fr) 140px minmax(220px, 1fr)',
            },
            gap: 2,
            alignItems: 'start',
            mb: 3,
          }}
        >
          <Box>
            <Typography
              variant="overline"
              sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 0.6, fontSize: '0.7rem' }}
            >
              Fréquence
            </Typography>
            <Select
              value={prefs.frequency}
              onChange={(e) => update('frequency', e.target.value as Frequency)}
              size="small"
              fullWidth
              sx={{ mt: 0.5 }}
            >
              {FREQUENCY_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.75, lineHeight: 1.4 }}
            >
              {FREQUENCY_OPTIONS.find((o) => o.value === prefs.frequency)?.description}
            </Typography>
          </Box>

          <Box>
            <Typography
              variant="overline"
              sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 0.6, fontSize: '0.7rem' }}
            >
              Heure d'envoi
            </Typography>
            <TextField
              type="time"
              size="small"
              fullWidth
              value={prefs.timeLocal}
              onChange={(e) => update('timeLocal', e.target.value)}
              inputProps={{ step: 300 }}
              sx={{ mt: 0.5 }}
            />
          </Box>

          <Box>
            <Typography
              variant="overline"
              sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 0.6, fontSize: '0.7rem' }}
            >
              Fuseau horaire
            </Typography>
            <TextField
              size="small"
              fullWidth
              value={prefs.timezone}
              onChange={(e) => update('timezone', e.target.value)}
              helperText={`Détecté : ${detectTimezone()}`}
              sx={{ mt: 0.5 }}
              FormHelperTextProps={{ sx: { ml: 0, fontSize: '0.7rem' } }}
            />
          </Box>
        </Box>

        {/* ── Ligne 2 : Canaux en grille 3 colonnes ───────────────────── */}
        <Box>
          <Typography
            variant="overline"
            sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 0.6, fontSize: '0.7rem' }}
          >
            Canaux
          </Typography>
          <Box
            sx={{
              mt: 0.75,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' },
              gap: 1.5,
            }}
          >
            {CHANNEL_OPTIONS.map((opt) => {
              const checked = prefs.channels.includes(opt.value);
              return (
                <Box
                  key={opt.value}
                  onClick={() => toggleChannel(opt.value)}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    p: 1.25,
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: checked ? 'primary.main' : 'divider',
                    bgcolor: checked
                      ? (theme) => alpha(theme.palette.primary.main, 0.04)
                      : 'transparent',
                    cursor: 'pointer',
                    transition: 'border-color 150ms ease, background-color 150ms ease',
                    '&:hover': {
                      borderColor: 'primary.light',
                    },
                  }}
                >
                  <Checkbox
                    checked={checked}
                    onChange={() => toggleChannel(opt.value)}
                    onClick={(e) => e.stopPropagation()}
                    size="small"
                    sx={{ p: 0, mt: 0.25 }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                      {opt.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', lineHeight: 1.4 }}
                    >
                      {opt.description}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <Divider sx={{ my: 3 }} />
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          onClick={triggerTest}
          disabled={triggering || !prefs.enabled}
          sx={{ textTransform: 'none', cursor: 'pointer' }}
        >
          {triggering ? 'Envoi en cours...' : 'Envoyer un test'}
        </Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={saving || loading}
          sx={{ textTransform: 'none', cursor: 'pointer' }}
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </Box>
    </AiSettingsCard>
  );
};

export default AssistantBriefingPrefs;

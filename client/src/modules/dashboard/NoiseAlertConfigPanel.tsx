import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Button,
  TextField,
  Slider,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  FormControl,
  Select,
  MenuItem,
  Grid,
} from '@mui/material';
import {
  Settings,
  Add,
  Delete,
  Save,
  NotificationsActive,
  Email,
  Chat,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { propertiesApi } from '../../services/api';
import { extractApiList } from '../../types';
import type { Property } from '../../services/api/propertiesApi';
import {
  useNoiseAlertConfig,
  useSaveNoiseAlertConfig,
  type SaveNoiseAlertConfigDto,
} from '../../hooks/useNoiseAlerts';
import type { TimeWindowDto } from '../../services/api/noiseAlertApi';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TimeWindowForm {
  label: string;
  startTime: string;
  endTime: string;
  warningThresholdDb: number;
  criticalThresholdDb: number;
}

interface ConfigForm {
  enabled: boolean;
  notifyInApp: boolean;
  notifyEmail: boolean;
  notifyGuestMessage: boolean;
  notifyWhatsapp: boolean;
  notifySms: boolean;
  cooldownMinutes: number;
  emailRecipients: string;
  timeWindows: TimeWindowForm[];
}

const DEFAULT_TIME_WINDOWS: TimeWindowForm[] = [
  { label: 'Jour', startTime: '07:00', endTime: '22:00', warningThresholdDb: 70, criticalThresholdDb: 85 },
  { label: 'Nuit', startTime: '22:00', endTime: '07:00', warningThresholdDb: 55, criticalThresholdDb: 70 },
];

const DEFAULT_CONFIG: ConfigForm = {
  enabled: true,
  notifyInApp: true,
  notifyEmail: true,
  notifyGuestMessage: false,
  notifyWhatsapp: false,
  notifySms: false,
  cooldownMinutes: 30,
  emailRecipients: '',
  timeWindows: DEFAULT_TIME_WINDOWS,
};

const COOLDOWN_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 heure' },
  { value: 120, label: '2 heures' },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface NoiseAlertConfigPanelProps {
  propertyIds: number[];
}

const NoiseAlertConfigPanel: React.FC<NoiseAlertConfigPanelProps> = ({ propertyIds }) => {
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(
    propertyIds.length > 0 ? propertyIds[0] : null,
  );
  const [form, setForm] = useState<ConfigForm>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);

  const propertiesQuery = useQuery({
    queryKey: ['properties-for-noise-alert-config'],
    queryFn: () => propertiesApi.getAll({ size: 1000 }),
    staleTime: 60_000,
  });
  const properties = React.useMemo(
    () => extractApiList<Property>(propertiesQuery.data).filter(p => propertyIds.includes(p.id)),
    [propertiesQuery.data, propertyIds],
  );

  const configQuery = useNoiseAlertConfig(selectedPropertyId);
  const saveMutation = useSaveNoiseAlertConfig();

  // Sync form from server config
  useEffect(() => {
    if (configQuery.data) {
      const cfg = configQuery.data;
      setForm({
        enabled: cfg.enabled,
        notifyInApp: cfg.notifyInApp,
        notifyEmail: cfg.notifyEmail,
        notifyGuestMessage: cfg.notifyGuestMessage,
        notifyWhatsapp: cfg.notifyWhatsapp,
        notifySms: cfg.notifySms,
        cooldownMinutes: cfg.cooldownMinutes,
        emailRecipients: cfg.emailRecipients || '',
        timeWindows: cfg.timeWindows.map((tw: TimeWindowDto) => ({
          label: tw.label,
          startTime: tw.startTime,
          endTime: tw.endTime,
          warningThresholdDb: tw.warningThresholdDb,
          criticalThresholdDb: tw.criticalThresholdDb,
        })),
      });
    } else if (!configQuery.isLoading) {
      setForm(DEFAULT_CONFIG);
    }
  }, [configQuery.data, configQuery.isLoading]);

  const updateField = useCallback(<K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const updateTimeWindow = useCallback((idx: number, field: keyof TimeWindowForm, value: string | number) => {
    setForm(prev => ({
      ...prev,
      timeWindows: prev.timeWindows.map((tw, i) =>
        i === idx ? { ...tw, [field]: value } : tw,
      ),
    }));
    setSaved(false);
  }, []);

  const addTimeWindow = useCallback(() => {
    setForm(prev => ({
      ...prev,
      timeWindows: [
        ...prev.timeWindows,
        { label: '', startTime: '00:00', endTime: '06:00', warningThresholdDb: 60, criticalThresholdDb: 80 },
      ],
    }));
    setSaved(false);
  }, []);

  const removeTimeWindow = useCallback((idx: number) => {
    setForm(prev => ({
      ...prev,
      timeWindows: prev.timeWindows.filter((_, i) => i !== idx),
    }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedPropertyId || form.timeWindows.length === 0) return;

    const dto: SaveNoiseAlertConfigDto = {
      enabled: form.enabled,
      notifyInApp: form.notifyInApp,
      notifyEmail: form.notifyEmail,
      notifyGuestMessage: form.notifyGuestMessage,
      notifyWhatsapp: form.notifyWhatsapp,
      notifySms: form.notifySms,
      cooldownMinutes: form.cooldownMinutes,
      emailRecipients: form.emailRecipients || null,
      timeWindows: form.timeWindows,
    };

    saveMutation.mutate(
      { propertyId: selectedPropertyId, data: dto },
      { onSuccess: () => setSaved(true) },
    );
  }, [selectedPropertyId, form, saveMutation]);

  if (propertyIds.length === 0) return null;

  return (
    <Card>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Settings sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: '0.875rem' }}>
            Configuration des alertes bruit
          </Typography>
        </Box>

        {/* Property selector */}
        <FormControl size="small" fullWidth sx={{ mb: 2 }}>
          <Select
            value={selectedPropertyId || ''}
            onChange={(e) => setSelectedPropertyId(Number(e.target.value))}
            sx={{ fontSize: '0.8125rem' }}
          >
            {properties.map(p => (
              <MenuItem key={p.id} value={p.id} sx={{ fontSize: '0.8125rem' }}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {configQuery.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            {/* Enable toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={form.enabled}
                  onChange={(e) => updateField('enabled', e.target.checked)}
                  color="primary"
                  size="small"
                />
              }
              label={
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                  Alertes activees
                </Typography>
              }
              sx={{ mb: 1 }}
            />

            {form.enabled && (
              <>
                <Divider sx={{ my: 1.5 }} />

                {/* Time windows */}
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.04em' }}>
                      Creneaux horaires
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<Add sx={{ fontSize: 14 }} />}
                      onClick={addTimeWindow}
                      sx={{ fontSize: '0.6875rem', textTransform: 'none' }}
                    >
                      Ajouter
                    </Button>
                  </Box>

                  {form.timeWindows.map((tw, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        p: 1.5,
                        mb: 1,
                        borderRadius: 1,
                        bgcolor: 'grey.50',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <TextField
                          size="small"
                          label="Label"
                          value={tw.label}
                          onChange={(e) => updateTimeWindow(idx, 'label', e.target.value)}
                          sx={{ flex: 1, '& input': { fontSize: '0.8125rem' } }}
                        />
                        <TextField
                          size="small"
                          label="Debut"
                          type="time"
                          value={tw.startTime}
                          onChange={(e) => updateTimeWindow(idx, 'startTime', e.target.value)}
                          sx={{ width: 120, '& input': { fontSize: '0.8125rem' } }}
                          InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                          size="small"
                          label="Fin"
                          type="time"
                          value={tw.endTime}
                          onChange={(e) => updateTimeWindow(idx, 'endTime', e.target.value)}
                          sx={{ width: 120, '& input': { fontSize: '0.8125rem' } }}
                          InputLabelProps={{ shrink: true }}
                        />
                        {form.timeWindows.length > 1 && (
                          <IconButton
                            size="small"
                            onClick={() => removeTimeWindow(idx)}
                            sx={{ color: 'error.main' }}
                          >
                            <Delete sx={{ fontSize: 16 }} />
                          </IconButton>
                        )}
                      </Box>

                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', mb: 0.5 }}>
                            Seuil avertissement : {tw.warningThresholdDb} dB
                          </Typography>
                          <Slider
                            size="small"
                            value={tw.warningThresholdDb}
                            onChange={(_, val) => updateTimeWindow(idx, 'warningThresholdDb', val as number)}
                            min={30}
                            max={100}
                            sx={{ color: '#ED6C02' }}
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', mb: 0.5 }}>
                            Seuil critique : {tw.criticalThresholdDb} dB
                          </Typography>
                          <Slider
                            size="small"
                            value={tw.criticalThresholdDb}
                            onChange={(_, val) => updateTimeWindow(idx, 'criticalThresholdDb', val as number)}
                            min={30}
                            max={120}
                            sx={{ color: '#D32F2F' }}
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  ))}
                </Box>

                <Divider sx={{ my: 1.5 }} />

                {/* Notification channels */}
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.04em', mb: 1 }}>
                  Canaux de notification
                </Typography>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.notifyInApp}
                        onChange={(e) => updateField('notifyInApp', e.target.checked)}
                        size="small"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <NotificationsActive sx={{ fontSize: 14 }} />
                        <Typography sx={{ fontSize: '0.75rem' }}>In-app</Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.notifyEmail}
                        onChange={(e) => updateField('notifyEmail', e.target.checked)}
                        size="small"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Email sx={{ fontSize: 14 }} />
                        <Typography sx={{ fontSize: '0.75rem' }}>Email</Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.notifyGuestMessage}
                        onChange={(e) => updateField('notifyGuestMessage', e.target.checked)}
                        size="small"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Chat sx={{ fontSize: 14 }} />
                        <Typography sx={{ fontSize: '0.75rem' }}>Message voyageur</Typography>
                      </Box>
                    }
                  />
                </Box>

                {form.notifyEmail && (
                  <TextField
                    size="small"
                    fullWidth
                    label="Destinataires email (optionnel, separes par virgule)"
                    value={form.emailRecipients}
                    onChange={(e) => updateField('emailRecipients', e.target.value)}
                    sx={{ mb: 1.5, '& input': { fontSize: '0.8125rem' } }}
                    placeholder="email1@example.com, email2@example.com"
                  />
                )}

                {/* Cooldown */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    Cooldown entre alertes :
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 100 }}>
                    <Select
                      value={form.cooldownMinutes}
                      onChange={(e) => updateField('cooldownMinutes', Number(e.target.value))}
                      sx={{ fontSize: '0.75rem', height: 28 }}
                    >
                      {COOLDOWN_OPTIONS.map(opt => (
                        <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.75rem' }}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                {/* Save */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Save sx={{ fontSize: 14 }} />}
                    onClick={handleSave}
                    disabled={saveMutation.isPending || form.timeWindows.length === 0}
                    sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
                  >
                    {saveMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
                  </Button>
                  {saved && (
                    <Chip
                      label="Sauvegarde"
                      size="small"
                      color="success"
                      variant="outlined"
                      sx={{ fontSize: '0.6875rem', height: 22 }}
                    />
                  )}
                  {saveMutation.isError && (
                    <Alert severity="error" sx={{ py: 0, fontSize: '0.75rem', flex: 1 }}>
                      Erreur de sauvegarde
                    </Alert>
                  )}
                </Box>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default NoiseAlertConfigPanel;

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Alert,
  CircularProgress,
  MenuItem,
  Grid,
  Collapse,
} from '@mui/material';
import {
  Schedule,
  Email,
  Login,
  Logout,
} from '../../icons';
import SettingsSection from '../settings/components/SettingsSection';
import SettingsToggleRow from '../settings/components/SettingsToggleRow';
import { useTranslation } from '../../hooks/useTranslation';
import {
  guestMessagingApi,
  type MessagingAutomationConfig,
  type MessageTemplate,
} from '../../services/api/guestMessagingApi';

interface MessagingAutomationSectionProps {
  onSave?: () => void;
}

export default function MessagingAutomationSection({ onSave }: MessagingAutomationSectionProps) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<MessagingAutomationConfig | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [configData, templatesData] = await Promise.all([
        guestMessagingApi.getConfig(),
        guestMessagingApi.getTemplates(),
      ]);
      setConfig(configData);
      setTemplates(templatesData.filter((t) => t.isActive));
    } catch (err) {
      setError(t('messaging.automation.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (updates: Partial<MessagingAutomationConfig>) => {
    if (!config) return;
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);

    try {
      setSaving(true);
      setError(null);
      await guestMessagingApi.updateConfig(newConfig);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onSave?.();
    } catch (err) {
      setError(t('messaging.automation.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (!config) return null;

  const checkInTemplates = templates.filter(
    (t) => t.type === 'CHECK_IN' || t.type === 'CUSTOM'
  );
  const checkOutTemplates = templates.filter(
    (t) => t.type === 'CHECK_OUT' || t.type === 'CUSTOM'
  );

  return (
    <Grid container spacing={2}>
      {error && (
        <Grid item xs={12}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Grid>
      )}

      {success && (
        <Grid item xs={12}>
          <Alert severity="success">
            {t('messaging.automation.saved')}
          </Alert>
        </Grid>
      )}

      {/* Check-in automatique */}
      <Grid item xs={12} md={6}>
        <SettingsSection
          title={t('messaging.automation.checkIn.title')}
          icon={Login}
          accent="accent"
        >
          <SettingsToggleRow
            icon={Email}
            iconColor="#4A9B8E"
            title={t('messaging.automation.checkIn.autoSend')}
            description={t('messaging.automation.checkIn.autoSendDesc')}
            checked={config.autoSendCheckIn}
            onChange={(v) => handleUpdate({ autoSendCheckIn: v })}
            disabled={saving}
            divider={config.autoSendCheckIn}
          />
          <Collapse in={config.autoSendCheckIn}>
            <SettingsToggleRow
              icon={Schedule}
              iconColor="#7BA3C2"
              title={t('messaging.automation.checkIn.hoursBefore')}
              description={t('messaging.automation.checkIn.hoursBeforeDesc')}
              control={(
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TextField
                    type="number"
                    value={config.hoursBeforeCheckIn}
                    onChange={(e) =>
                      handleUpdate({ hoursBeforeCheckIn: Math.max(1, parseInt(e.target.value) || 24) })
                    }
                    sx={{
                      width: 72,
                      '& input': { textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontWeight: 600 },
                    }}
                    size="small"
                    inputProps={{ min: 1, max: 168 }}
                    disabled={saving}
                  />
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.02em' }}>
                    h
                  </Typography>
                </Box>
              )}
            />
            <Box sx={{ pt: 1.25 }}>
              <TextField
                select
                fullWidth
                size="small"
                label={t('messaging.automation.checkIn.template')}
                value={config.checkInTemplateId ?? ''}
                onChange={(e) =>
                  handleUpdate({
                    checkInTemplateId: e.target.value ? Number(e.target.value) : null,
                  })
                }
                disabled={saving}
              >
                <MenuItem value="">
                  <em>{t('messaging.automation.noTemplate')}</em>
                </MenuItem>
                {checkInTemplates.map((tpl) => (
                  <MenuItem key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Collapse>
        </SettingsSection>
      </Grid>

      {/* Check-out automatique */}
      <Grid item xs={12} md={6}>
        <SettingsSection
          title={t('messaging.automation.checkOut.title')}
          icon={Logout}
          accent="warm"
        >
          <SettingsToggleRow
            icon={Email}
            iconColor="#D4A574"
            title={t('messaging.automation.checkOut.autoSend')}
            description={t('messaging.automation.checkOut.autoSendDesc')}
            checked={config.autoSendCheckOut}
            onChange={(v) => handleUpdate({ autoSendCheckOut: v })}
            disabled={saving}
            divider={config.autoSendCheckOut}
          />
          <Collapse in={config.autoSendCheckOut}>
            <SettingsToggleRow
              icon={Schedule}
              iconColor="#7BA3C2"
              title={t('messaging.automation.checkOut.hoursBefore')}
              description={t('messaging.automation.checkOut.hoursBeforeDesc')}
              control={(
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TextField
                    type="number"
                    value={config.hoursBeforeCheckOut}
                    onChange={(e) =>
                      handleUpdate({ hoursBeforeCheckOut: Math.max(1, parseInt(e.target.value) || 12) })
                    }
                    sx={{
                      width: 72,
                      '& input': { textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontWeight: 600 },
                    }}
                    size="small"
                    inputProps={{ min: 1, max: 168 }}
                    disabled={saving}
                  />
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.02em' }}>
                    h
                  </Typography>
                </Box>
              )}
            />
            <Box sx={{ pt: 1.25 }}>
              <TextField
                select
                fullWidth
                size="small"
                label={t('messaging.automation.checkOut.template')}
                value={config.checkOutTemplateId ?? ''}
                onChange={(e) =>
                  handleUpdate({
                    checkOutTemplateId: e.target.value ? Number(e.target.value) : null,
                  })
                }
                disabled={saving}
              >
                <MenuItem value="">
                  <em>{t('messaging.automation.noTemplate')}</em>
                </MenuItem>
                {checkOutTemplates.map((tpl) => (
                  <MenuItem key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Collapse>
        </SettingsSection>
      </Grid>

      {/* Info */}
      {templates.length === 0 && (
        <Grid item xs={12}>
          <Alert severity="info">
            {t('messaging.automation.noTemplatesYet')}
          </Alert>
        </Grid>
      )}
    </Grid>
  );
}

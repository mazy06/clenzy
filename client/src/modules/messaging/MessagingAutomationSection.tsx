import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Switch,
  TextField,
  Alert,
  CircularProgress,
  MenuItem,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemIcon,
} from '@mui/material';
import {
  Schedule,
  Email,
  Login,
  Logout,
} from '@mui/icons-material';
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
        <Paper sx={{ p: 2, height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Login sx={{ color: 'success.main', fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
              {t('messaging.automation.checkIn.title')}
            </Typography>
          </Box>

          <List>
            <ListItem>
              <ListItemIcon>
                <Email />
              </ListItemIcon>
              <ListItemText
                primary={t('messaging.automation.checkIn.autoSend')}
                secondary={t('messaging.automation.checkIn.autoSendDesc')}
              />
              <ListItemSecondaryAction>
                <Switch
                  edge="end"
                  checked={config.autoSendCheckIn}
                  onChange={(e) => handleUpdate({ autoSendCheckIn: e.target.checked })}
                  disabled={saving}
                />
              </ListItemSecondaryAction>
            </ListItem>

            {config.autoSendCheckIn && (
              <>
                <ListItem>
                  <ListItemIcon>
                    <Schedule />
                  </ListItemIcon>
                  <ListItemText
                    primary={t('messaging.automation.checkIn.hoursBefore')}
                    secondary={t('messaging.automation.checkIn.hoursBeforeDesc')}
                  />
                  <TextField
                    type="number"
                    value={config.hoursBeforeCheckIn}
                    onChange={(e) =>
                      handleUpdate({ hoursBeforeCheckIn: Math.max(1, parseInt(e.target.value) || 24) })
                    }
                    sx={{ width: 80 }}
                    size="small"
                    inputProps={{ min: 1, max: 168 }}
                    disabled={saving}
                  />
                </ListItem>

                <ListItem sx={{ display: 'block' }}>
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
                </ListItem>
              </>
            )}
          </List>
        </Paper>
      </Grid>

      {/* Check-out automatique */}
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2, height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Logout sx={{ color: 'warning.main', fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
              {t('messaging.automation.checkOut.title')}
            </Typography>
          </Box>

          <List>
            <ListItem>
              <ListItemIcon>
                <Email />
              </ListItemIcon>
              <ListItemText
                primary={t('messaging.automation.checkOut.autoSend')}
                secondary={t('messaging.automation.checkOut.autoSendDesc')}
              />
              <ListItemSecondaryAction>
                <Switch
                  edge="end"
                  checked={config.autoSendCheckOut}
                  onChange={(e) => handleUpdate({ autoSendCheckOut: e.target.checked })}
                  disabled={saving}
                />
              </ListItemSecondaryAction>
            </ListItem>

            {config.autoSendCheckOut && (
              <>
                <ListItem>
                  <ListItemIcon>
                    <Schedule />
                  </ListItemIcon>
                  <ListItemText
                    primary={t('messaging.automation.checkOut.hoursBefore')}
                    secondary={t('messaging.automation.checkOut.hoursBeforeDesc')}
                  />
                  <TextField
                    type="number"
                    value={config.hoursBeforeCheckOut}
                    onChange={(e) =>
                      handleUpdate({ hoursBeforeCheckOut: Math.max(1, parseInt(e.target.value) || 12) })
                    }
                    sx={{ width: 80 }}
                    size="small"
                    inputProps={{ min: 1, max: 168 }}
                    disabled={saving}
                  />
                </ListItem>

                <ListItem sx={{ display: 'block' }}>
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
                </ListItem>
              </>
            )}
          </List>
        </Paper>
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

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Switch,
  Paper,
  TextField,

  Button,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  Stack,
} from '@mui/material';
import { Save, CalendarMonth } from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import { usePayoutSchedule, useUpdatePayoutSchedule } from '../../hooks/usePayoutSchedule';

const VALID_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

export default function PayoutScheduleSettings() {
  const { t } = useTranslation();
  const { data: config, isLoading } = usePayoutSchedule();
  const updateMutation = useUpdatePayoutSchedule();

  const [selectedDays, setSelectedDays] = useState<number[]>([1, 15]);
  const [gracePeriod, setGracePeriod] = useState(2);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => {
    if (!config) return;
    setSelectedDays(config.payoutDaysOfMonth);
    setGracePeriod(config.gracePeriodDays);
    setAutoGenerate(config.autoGenerateEnabled);
  }, [config]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b),
    );
  };

  const handleSave = () => {
    if (selectedDays.length === 0) {
      setSnackbar({ open: true, message: t('settings.payoutSchedule.validationDays'), severity: 'error' });
      return;
    }

    updateMutation.mutate(
      {
        payoutDaysOfMonth: selectedDays,
        gracePeriodDays: gracePeriod,
        autoGenerateEnabled: autoGenerate,
      },
      {
        onSuccess: () => {
          setSnackbar({ open: true, message: t('settings.payoutSchedule.saved'), severity: 'success' });
        },
        onError: () => {
          setSnackbar({ open: true, message: t('settings.payoutSchedule.error'), severity: 'error' });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5, height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <CalendarMonth sx={{ color: '#A6C0CE', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
          {t('settings.payoutSchedule.title')}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('settings.payoutSchedule.subtitle')}
      </Typography>

      {/* Auto-generate toggle */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body1" fontWeight={600}>
              {t('settings.payoutSchedule.autoGenerate')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('settings.payoutSchedule.autoGenerateHelper')}
            </Typography>
          </Box>
          <Switch
            checked={autoGenerate}
            onChange={(e) => setAutoGenerate(e.target.checked)}
          />
        </Box>
      </Paper>

      {/* Days of month selector */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, opacity: autoGenerate ? 1 : 0.5, pointerEvents: autoGenerate ? 'auto' : 'none' }}>
        <Typography variant="body1" fontWeight={600} gutterBottom>
          {t('settings.payoutSchedule.daysOfMonth')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t('settings.payoutSchedule.daysOfMonthHelper')}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          {VALID_DAYS.map((day) => (
            <Chip
              key={day}
              label={day}
              size="small"
              onClick={() => toggleDay(day)}
              color={selectedDays.includes(day) ? 'primary' : 'default'}
              variant={selectedDays.includes(day) ? 'filled' : 'outlined'}
              sx={{
                minWidth: 36,
                fontWeight: selectedDays.includes(day) ? 700 : 400,
                cursor: 'pointer',
              }}
            />
          ))}
        </Stack>
      </Paper>

      {/* Grace period */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="body1" fontWeight={600} gutterBottom>
          {t('settings.payoutSchedule.gracePeriod')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t('settings.payoutSchedule.gracePeriodHelper')}
        </Typography>
        <TextField
          type="number"
          value={gracePeriod}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val >= 0 && val <= 30) setGracePeriod(val);
          }}
          size="small"
          inputProps={{ min: 0, max: 30 }}
          sx={{ width: 120 }}
        />
      </Paper>

      {/* Save button */}
      <Button
        variant="contained"
        startIcon={<Save />}
        onClick={handleSave}
        disabled={updateMutation.isPending || selectedDays.length === 0}
        sx={{ textTransform: 'none' }}
      >
        {updateMutation.isPending ? t('common.saving') : t('settings.payoutSchedule.save')}
      </Button>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
}

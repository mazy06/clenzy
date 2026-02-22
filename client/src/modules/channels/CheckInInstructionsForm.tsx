import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  VpnKey as KeyIcon,
  Wifi as WifiIcon,
  LocalParking as ParkingIcon,
  FlightLand as ArrivalIcon,
  FlightTakeoff as DepartureIcon,
  Gavel as RulesIcon,
  Phone as PhoneIcon,
  Notes as NotesIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import { airbnbApi } from '../../services/api/airbnbApi';
import type { CheckInInstructions, UpdateCheckInInstructions } from '../../services/api/airbnbApi';

// ─── Style Constants ────────────────────────────────────────────────────────

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
  p: 2,
} as const;

const FIELD_SX = {
  '& .MuiInputBase-input': { fontSize: '0.8125rem' },
  '& .MuiInputLabel-root': { fontSize: '0.8125rem' },
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────

interface CheckInInstructionsFormProps {
  propertyId: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

const CheckInInstructionsForm: React.FC<CheckInInstructionsFormProps> = ({ propertyId }) => {
  const { t } = useTranslation();
  const [instructions, setInstructions] = useState<CheckInInstructions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<UpdateCheckInInstructions>({
    accessCode: null,
    wifiName: null,
    wifiPassword: null,
    parkingInfo: null,
    arrivalInstructions: null,
    departureInstructions: null,
    houseRules: null,
    emergencyContact: null,
    additionalNotes: null,
  });

  // Fetch existing instructions
  useEffect(() => {
    setLoading(true);
    setError(null);
    airbnbApi.getCheckInInstructions(propertyId)
      .then((data) => {
        setInstructions(data);
        setForm({
          accessCode: data.accessCode,
          wifiName: data.wifiName,
          wifiPassword: data.wifiPassword,
          parkingInfo: data.parkingInfo,
          arrivalInstructions: data.arrivalInstructions,
          departureInstructions: data.departureInstructions,
          houseRules: data.houseRules,
          emergencyContact: data.emergencyContact,
          additionalNotes: data.additionalNotes,
        });
      })
      .catch(() => {
        // No instructions yet — form stays empty
      })
      .finally(() => setLoading(false));
  }, [propertyId]);

  const handleChange = useCallback((field: keyof UpdateCheckInInstructions, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value || null }));
    setSuccess(false);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await airbnbApi.updateCheckInInstructions(propertyId, form);
      setInstructions(updated);
      setSuccess(true);
    } catch {
      setError(t('channels.checkIn.errorSaving'));
    } finally {
      setSaving(false);
    }
  }, [propertyId, form, t]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Paper sx={CARD_SX}>
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, mb: 1.5 }}>
        {t('channels.checkIn.title')}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 1, fontSize: '0.75rem' }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 1, fontSize: '0.75rem' }}>{t('channels.checkIn.saved')}</Alert>}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* Access & WiFi */}
        <SectionTitle icon={<KeyIcon />} label={t('channels.checkIn.accessSection')} />
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <TextField
            label={t('channels.checkIn.accessCode')}
            value={form.accessCode ?? ''}
            onChange={(e) => handleChange('accessCode', e.target.value)}
            size="small"
            sx={{ ...FIELD_SX, flex: 1, minWidth: 200 }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <TextField
            label={t('channels.checkIn.wifiName')}
            value={form.wifiName ?? ''}
            onChange={(e) => handleChange('wifiName', e.target.value)}
            size="small"
            sx={{ ...FIELD_SX, flex: 1, minWidth: 200 }}
            InputProps={{ startAdornment: <WifiIcon sx={{ fontSize: '1rem', mr: 0.5, color: 'text.secondary' }} /> }}
          />
          <TextField
            label={t('channels.checkIn.wifiPassword')}
            value={form.wifiPassword ?? ''}
            onChange={(e) => handleChange('wifiPassword', e.target.value)}
            size="small"
            sx={{ ...FIELD_SX, flex: 1, minWidth: 200 }}
          />
        </Box>

        <Divider />

        {/* Parking */}
        <SectionTitle icon={<ParkingIcon />} label={t('channels.checkIn.parkingSection')} />
        <TextField
          label={t('channels.checkIn.parkingInfo')}
          value={form.parkingInfo ?? ''}
          onChange={(e) => handleChange('parkingInfo', e.target.value)}
          size="small"
          multiline
          rows={2}
          sx={FIELD_SX}
        />

        <Divider />

        {/* Arrival / Departure instructions */}
        <SectionTitle icon={<ArrivalIcon />} label={t('channels.checkIn.arrivalSection')} />
        <TextField
          label={t('channels.checkIn.arrivalInstructions')}
          value={form.arrivalInstructions ?? ''}
          onChange={(e) => handleChange('arrivalInstructions', e.target.value)}
          size="small"
          multiline
          rows={3}
          sx={FIELD_SX}
          placeholder={t('channels.checkIn.arrivalPlaceholder')}
        />

        <SectionTitle icon={<DepartureIcon />} label={t('channels.checkIn.departureSection')} />
        <TextField
          label={t('channels.checkIn.departureInstructions')}
          value={form.departureInstructions ?? ''}
          onChange={(e) => handleChange('departureInstructions', e.target.value)}
          size="small"
          multiline
          rows={3}
          sx={FIELD_SX}
          placeholder={t('channels.checkIn.departurePlaceholder')}
        />

        <Divider />

        {/* House rules */}
        <SectionTitle icon={<RulesIcon />} label={t('channels.checkIn.rulesSection')} />
        <TextField
          label={t('channels.checkIn.houseRules')}
          value={form.houseRules ?? ''}
          onChange={(e) => handleChange('houseRules', e.target.value)}
          size="small"
          multiline
          rows={3}
          sx={FIELD_SX}
        />

        <Divider />

        {/* Emergency contact & Notes */}
        <SectionTitle icon={<PhoneIcon />} label={t('channels.checkIn.emergencySection')} />
        <TextField
          label={t('channels.checkIn.emergencyContact')}
          value={form.emergencyContact ?? ''}
          onChange={(e) => handleChange('emergencyContact', e.target.value)}
          size="small"
          sx={FIELD_SX}
        />

        <SectionTitle icon={<NotesIcon />} label={t('channels.checkIn.additionalSection')} />
        <TextField
          label={t('channels.checkIn.additionalNotes')}
          value={form.additionalNotes ?? ''}
          onChange={(e) => handleChange('additionalNotes', e.target.value)}
          size="small"
          multiline
          rows={2}
          sx={FIELD_SX}
        />

        {/* Save button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            sx={{ fontSize: '0.8125rem' }}
          >
            {t('common.save')}
          </Button>
        </Box>

        {/* Last update */}
        {instructions?.updatedAt && (
          <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', textAlign: 'right' }}>
            {t('channels.checkIn.lastUpdated')}: {new Date(instructions.updatedAt).toLocaleString('fr-FR')}
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {React.cloneElement(icon as React.ReactElement, { sx: { fontSize: '0.875rem', color: 'primary.main' } })}
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary' }}>
        {label}
      </Typography>
    </Box>
  );
}

export default CheckInInstructionsForm;

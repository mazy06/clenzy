import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  CircularProgress,
  IconButton,
  alpha,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from '../../hooks/useTranslation';
import MiniDateRangePicker from '../../components/MiniDateRangePicker';
import type { RatePlan, CreateRatePlanData } from '../../services/api/calendarPricingApi';

// ─── Style Constants ────────────────────────────────────────────────────────

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
  p: 1.5,
} as const;

const PLAN_TYPES = ['BASE', 'SEASONAL', 'PROMOTIONAL', 'LAST_MINUTE'] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

interface RatePlanFormProps {
  propertyId: number;
  editingPlan?: RatePlan | null;
  onSave: (data: CreateRatePlanData) => Promise<unknown>;
  onCancel: () => void;
  loading: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

const RatePlanForm: React.FC<RatePlanFormProps> = ({
  propertyId,
  editingPlan,
  onSave,
  onCancel,
  loading,
}) => {
  const { t, isFrench } = useTranslation();

  const [name, setName] = useState('');
  const [type, setType] = useState<string>('BASE');
  const [nightlyPrice, setNightlyPrice] = useState<string>('');
  const [priority, setPriority] = useState<string>('1');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [isActive, setIsActive] = useState(true);

  // Reset form when editingPlan changes
  useEffect(() => {
    if (editingPlan) {
      setName(editingPlan.name);
      setType(editingPlan.type);
      setNightlyPrice(String(editingPlan.nightlyPrice));
      setPriority(String(editingPlan.priority));
      setStartDate(editingPlan.startDate ?? '');
      setEndDate(editingPlan.endDate ?? '');
      setDaysOfWeek(editingPlan.daysOfWeek ?? []);
      setIsActive(editingPlan.isActive);
    } else {
      setName('');
      setType('BASE');
      setNightlyPrice('');
      setPriority('1');
      setStartDate('');
      setEndDate('');
      setDaysOfWeek([]);
      setIsActive(true);
    }
  }, [editingPlan]);

  const dayLabels = isFrench
    ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleSave = async () => {
    const data: CreateRatePlanData = {
      propertyId,
      name,
      type,
      nightlyPrice: parseFloat(nightlyPrice),
      priority: parseInt(priority, 10),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : undefined,
      isActive,
    };
    await onSave(data);
  };

  const isValid = name.trim() !== '' && nightlyPrice !== '' && !isNaN(parseFloat(nightlyPrice));

  return (
    <Paper sx={CARD_SX}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.8125rem' }}>
          {editingPlan ? t('dynamicPricing.ratePlan.edit') : t('dynamicPricing.ratePlan.create')}
        </Typography>
        {editingPlan && (
          <IconButton size="small" onClick={onCancel} sx={{ p: 0.25 }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* Name */}
        <TextField
          label={t('dynamicPricing.ratePlan.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          size="small"
        />

        {/* Type */}
        <FormControl fullWidth size="small">
          <InputLabel>{t('common.type')}</InputLabel>
          <Select value={type} label={t('common.type')} onChange={(e) => setType(e.target.value)}>
            {PLAN_TYPES.map((pt) => (
              <MenuItem key={pt} value={pt}>
                {t(`dynamicPricing.ratePlan.types.${pt}`)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Price + Priority row */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            label={t('dynamicPricing.ratePlan.nightlyPrice')}
            type="number"
            value={nightlyPrice}
            onChange={(e) => setNightlyPrice(e.target.value)}
            fullWidth
            size="small"
            inputProps={{ min: 0, step: 1 }}
          />
          <TextField
            label={t('dynamicPricing.ratePlan.priority')}
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            size="small"
            sx={{ width: 100 }}
            inputProps={{ min: 0, step: 1 }}
          />
        </Box>

        {/* Date range — shared mini calendar */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem', mb: 0.5, display: 'block' }}>
            {t('dynamicPricing.ratePlan.dateRange')}
          </Typography>
          <MiniDateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChangeStart={setStartDate}
            onChangeEnd={setEndDate}
            isFrench={isFrench}
          />
        </Box>

        {/* Days of week */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem', mb: 0.5, display: 'block' }}>
            {t('dynamicPricing.ratePlan.daysOfWeek')}
          </Typography>
          <Box sx={{ display: 'flex', gap: '3px' }}>
            {dayLabels.map((label, idx) => {
              const dayValue = idx + 1;
              const selected = daysOfWeek.includes(dayValue);
              return (
                <Box
                  key={dayValue}
                  onClick={() => toggleDay(dayValue)}
                  sx={{
                    flex: 1,
                    textAlign: 'center',
                    py: 0.5,
                    borderRadius: 1,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: selected ? 'primary.main' : 'divider',
                    bgcolor: selected ? (theme) => alpha(theme.palette.primary.main, 0.12) : 'transparent',
                    transition: 'all 0.15s',
                    '&:hover': {
                      borderColor: 'primary.light',
                    },
                  }}
                >
                  <Typography
                    variant="caption"
                    fontWeight={selected ? 700 : 400}
                    sx={{
                      fontSize: '0.5625rem',
                      color: selected ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {label}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Active toggle */}
        <FormControlLabel
          control={
            <Switch size="small" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          }
          label={
            <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
              {isActive ? t('dynamicPricing.ratePlan.active') : t('dynamicPricing.ratePlan.inactive')}
            </Typography>
          }
        />

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          {editingPlan && (
            <Button
              size="small"
              onClick={onCancel}
              disabled={loading}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              {t('common.cancel')}
            </Button>
          )}
          <Button
            variant="contained"
            size="small"
            onClick={handleSave}
            disabled={loading || !isValid}
            startIcon={loading ? <CircularProgress size={14} /> : undefined}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
          >
            {editingPlan ? t('common.save') : t('dynamicPricing.ratePlan.create')}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};

export default RatePlanForm;

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
} from '@mui/material';
import { Close as CloseIcon } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import { CurrencySymbol } from '../../components/Money';
import MiniDateRangePicker from '../../components/MiniDateRangePicker';
import type { RatePlan, CreateRatePlanData } from '../../services/api/calendarPricingApi';

// ─── Style Constants ────────────────────────────────────────────────────────

const CARD_SX = {
  border: '1px solid',
  borderColor: 'var(--line)',
  bgcolor: 'var(--card)',
  boxShadow: 'none',
  borderRadius: '14px',
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

  const { currency: activeCurrency } = useCurrency();
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
      currency: activeCurrency,
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
      <div className="flex justify-between items-center mb-2">
        <p className="cn-text-body1 text-[10.5px] font-bold text-[var(--faint)] uppercase tracking-[0.06em]">
          {editingPlan ? t('dynamicPricing.ratePlan.edit') : t('dynamicPricing.ratePlan.create')}
        </p>
        {editingPlan && (
          <IconButton size="small" onClick={onCancel} sx={{ p: 0.25 }}>
            <CloseIcon size={16} strokeWidth={1.75} />
          </IconButton>
        )}
      </div>

      <div className="flex flex-col gap-2">
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

        {/* Price + Currency + Priority row */}
        <div className="flex gap-1.5">
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
            label={t('common.currency') || 'Devise'}
            value={activeCurrency}
            disabled
            size="small"
            sx={{ width: 90 }}
            InputProps={{
              startAdornment: (
                <p className="cn-text-body2 me-0.5 font-semibold text-muted-foreground">
                  <CurrencySymbol code={activeCurrency} />
                </p>
              ),
            }}
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
        </div>

        {/* Date range — shared mini calendar */}
        <div>
          <span className="cn-text-caption text-muted-foreground text-[0.625rem] mb-0.5 block">
            {t('dynamicPricing.ratePlan.dateRange')}
          </span>
          <MiniDateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChangeStart={setStartDate}
            onChangeEnd={setEndDate}
            isFrench={isFrench}
          />
        </div>

        {/* Days of week */}
        <div>
          <span className="cn-text-caption text-muted-foreground text-[0.625rem] mb-0.5 block">
            {t('dynamicPricing.ratePlan.daysOfWeek')}
          </span>
          <Box sx={{ display: 'flex', gap: '3px' }}>
            {(() => {
              const daysOfWeekSet = new Set(daysOfWeek);
              return dayLabels.map((label, idx) => {
              const dayValue = idx + 1;
              const selected = daysOfWeekSet.has(dayValue);
              return (
                <Box
                  key={label}
                  onClick={() => toggleDay(dayValue)}
                  aria-pressed={selected}
                  sx={{
                    flex: 1,
                    textAlign: 'center',
                    py: 0.5,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: selected ? 'var(--accent)' : 'var(--field-line)',
                    bgcolor: selected ? 'var(--accent-soft)' : 'var(--field)',
                    transition: 'border-color 0.15s, background-color 0.15s',
                    '&:hover': {
                      borderColor: selected ? 'var(--accent)' : 'var(--faint)',
                    },
                  }}
                >
                  <Typography
                    variant="caption"
                    fontWeight={selected ? 700 : 500}
                    sx={{
                      fontSize: '0.5625rem',
                      color: selected ? 'var(--accent)' : 'var(--muted)',
                    }}
                  >
                    {label}
                  </Typography>
                </Box>
              );
              });
            })()}
          </Box>
        </div>

        {/* Active toggle */}
        <FormControlLabel
          control={
            <Switch size="small" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          }
          label={
            <span className="cn-text-caption text-[0.75rem]">
              {isActive ? t('dynamicPricing.ratePlan.active') : t('dynamicPricing.ratePlan.inactive')}
            </span>
          }
        />

        {/* Actions */}
        <div className="flex gap-1.5 justify-end">
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
        </div>
      </div>
    </Paper>
  );
};

export default RatePlanForm;

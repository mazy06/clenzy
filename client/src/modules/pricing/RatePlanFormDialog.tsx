import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Typography,
  CircularProgress,
  Checkbox,
} from '@mui/material';
import { useTranslation } from '../../hooks/useTranslation';
import type { RatePlan, CreateRatePlanData } from '../../services/api/calendarPricingApi';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RatePlanFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateRatePlanData) => Promise<void>;
  propertyId: number;
  editingPlan?: RatePlan | null;
  loading: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PLAN_TYPES = ['BASE', 'SEASONAL', 'PROMOTIONAL', 'LAST_MINUTE'] as const;

// ─── Component ──────────────────────────────────────────────────────────────

const RatePlanFormDialog: React.FC<RatePlanFormDialogProps> = ({
  open,
  onClose,
  onSave,
  propertyId,
  editingPlan,
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

  // Reset form when dialog opens or editingPlan changes
  useEffect(() => {
    if (open && editingPlan) {
      setName(editingPlan.name);
      setType(editingPlan.type);
      setNightlyPrice(String(editingPlan.nightlyPrice));
      setPriority(String(editingPlan.priority));
      setStartDate(editingPlan.startDate ?? '');
      setEndDate(editingPlan.endDate ?? '');
      setDaysOfWeek(editingPlan.daysOfWeek ?? []);
      setIsActive(editingPlan.isActive);
    } else if (open) {
      setName('');
      setType('BASE');
      setNightlyPrice('');
      setPriority('1');
      setStartDate('');
      setEndDate('');
      setDaysOfWeek([]);
      setIsActive(true);
    }
  }, [open, editingPlan]);

  const dayNames = isFrench
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
    onClose();
  };

  const isValid = name.trim() !== '' && nightlyPrice !== '' && !isNaN(parseFloat(nightlyPrice));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {editingPlan ? t('dynamicPricing.ratePlan.edit') : t('dynamicPricing.ratePlan.create')}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Name */}
          <TextField
            label={t('dynamicPricing.ratePlan.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
          />

          {/* Type */}
          <FormControl fullWidth>
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
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label={t('dynamicPricing.ratePlan.nightlyPrice')}
              type="number"
              value={nightlyPrice}
              onChange={(e) => setNightlyPrice(e.target.value)}
              fullWidth
              inputProps={{ min: 0, step: 1 }}
            />
            <TextField
              label={t('dynamicPricing.ratePlan.priority')}
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              sx={{ width: 140 }}
              inputProps={{ min: 0, step: 1 }}
            />
          </Box>

          {/* Date range */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label={t('dynamicPricing.ratePlan.startDate')}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('dynamicPricing.ratePlan.endDate')}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          {/* Days of week */}
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              {t('dynamicPricing.ratePlan.daysOfWeek')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {dayNames.map((label, idx) => {
                const dayValue = idx + 1;
                return (
                  <FormControlLabel
                    key={dayValue}
                    control={
                      <Checkbox
                        checked={daysOfWeek.includes(dayValue)}
                        onChange={() => toggleDay(dayValue)}
                        size="small"
                      />
                    }
                    label={label}
                    sx={{ mr: 0 }}
                  />
                );
              })}
            </Box>
          </Box>

          {/* Active toggle */}
          <FormControlLabel
            control={
              <Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            }
            label={isActive ? t('dynamicPricing.ratePlan.active') : t('dynamicPricing.ratePlan.inactive')}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading || !isValid}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RatePlanFormDialog;

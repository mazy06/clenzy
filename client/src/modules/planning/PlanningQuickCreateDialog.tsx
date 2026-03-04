import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Chip,
  Autocomplete,
  CircularProgress,
  Collapse,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
  Switch,
  FormControlLabel,
  alpha,
} from '@mui/material';
import {
  Close,
  Home,
  PersonAdd,
  Person,
  NightsStay,
  Euro,
  Percent,
  Edit as EditIcon,
  Remove as RemoveIcon,
  Add as AddIcon,
  Group as GroupIcon,
  CleaningServices,
  AccessTime,
  ConfirmationNumber,
  AccountBalance,
  CheckCircle,
  Schedule,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QuickCreateData, PlanningEvent } from './types';
import type { CreateReservationData } from '../../services/api';
import { reservationsApi, guestsApi } from '../../services/api';
import type { GuestDto, CreateGuestData } from '../../services/api';
import { planningKeys } from './hooks/usePlanningData';
import MiniDateRangePicker from '../../components/MiniDateRangePicker';
import { Warning as WarningIcon } from '@mui/icons-material';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PlanningQuickCreateDialogProps {
  open: boolean;
  data: QuickCreateData | null;
  onClose: () => void;
  /** All planning events for conflict detection */
  events?: PlanningEvent[];
}

type PricingMode = 'custom' | 'discount_euro' | 'discount_percent';

// ─── Styles constants ───────────────────────────────────────────────────────

const SECTION_LABEL_SX = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'text.secondary',
  mb: 0.75,
} as const;

const FIELD_SX = { '& .MuiInputBase-root': { fontSize: '0.84rem' } } as const;

/** Generate a random confirmation code for direct reservations */
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `DIR-${code}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PlanningQuickCreateDialog: React.FC<PlanningQuickCreateDialogProps> = ({
  open,
  data,
  onClose,
  events = [],
}) => {
  const queryClient = useQueryClient();

  // ── Dates ──────────────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // ── Guest ──────────────────────────────────────────────────────────────
  const [guestSearchQuery, setGuestSearchQuery] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<GuestDto | null>(null);
  const [showCreateGuestForm, setShowCreateGuestForm] = useState(false);
  const [newGuestFirstName, setNewGuestFirstName] = useState('');
  const [newGuestLastName, setNewGuestLastName] = useState('');
  const [newGuestEmail, setNewGuestEmail] = useState('');
  const [newGuestPhone, setNewGuestPhone] = useState('');

  // ── Pricing ────────────────────────────────────────────────────────────
  const [pricingMode, setPricingMode] = useState<PricingMode>('custom');
  const [pricingValue, setPricingValue] = useState('');

  // ── Status ────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<'confirmed' | 'pending'>('pending');

  // ── Times ─────────────────────────────────────────────────────────────
  const [checkInTime, setCheckInTime] = useState('15:00');
  const [checkOutTime, setCheckOutTime] = useState('11:00');

  // ── Cleaning ──────────────────────────────────────────────────────────
  const [createCleaning, setCreateCleaning] = useState(false);
  const [cleaningFee, setCleaningFee] = useState('');

  // ── Tourist tax ───────────────────────────────────────────────────────
  const [touristTaxPerPerson, setTouristTaxPerPerson] = useState('');

  // ── Confirmation code ─────────────────────────────────────────────────
  const [confirmationCode, setConfirmationCode] = useState('');

  // ── Other fields ──────────────────────────────────────────────────────
  const [guestCount, setGuestCount] = useState(2);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ── Init state from data ──────────────────────────────────────────────
  useEffect(() => {
    if (data && open) {
      const defaultCheckIn = data.defaultCheckInTime ?? '15:00';
      const defaultCheckOut = data.defaultCheckOutTime ?? '11:00';

      // ── Auto-adjust start: find the latest event end within the selected range ──
      let adjustedStartDate = data.startDate;
      let adjustedCheckInTime = defaultCheckIn;

      const toTs = (date: string, time?: string) => time ? `${date} ${time}` : date;
      const samePropertyEvents = events.filter((e) => e.propertyId === data.propertyId);

      // Find events that overlap with the selected range
      let latestEndTs = '';
      let latestEndDate = '';
      let latestEndTime = '';

      for (const evt of samePropertyEvents) {
        const evtEnd = toTs(evt.endDate, evt.endTime);
        const evtStart = toTs(evt.startDate, evt.startTime);
        const rangeStart = toTs(data.startDate, defaultCheckIn);
        const rangeEnd = toTs(data.endDate, defaultCheckOut);

        // Event overlaps with the selected range
        if (evtStart < rangeEnd && evtEnd > rangeStart) {
          if (evtEnd > latestEndTs) {
            latestEndTs = evtEnd;
            latestEndDate = evt.endDate;
            latestEndTime = evt.endTime || '';
          }
        }
      }

      // If conflicting events found, push start after the latest one
      if (latestEndTs && latestEndDate) {
        // For reservations ending on a date with a checkout time (e.g. 11:00),
        // the cleaning starts at checkout. We need to find the latest intervention
        // linked to that checkout date too — already handled since interventions
        // are included in events list.
        adjustedStartDate = latestEndDate;

        // If the latest event ends with a time, use it as the new check-in time
        // (or default check-in if it's earlier)
        if (latestEndTime) {
          // Use the later of: latest event end time vs default check-in
          adjustedCheckInTime = latestEndTime > defaultCheckIn ? latestEndTime : defaultCheckIn;
        }

        // If adjusted start equals or exceeds the end date, keep at least 1 night
        if (adjustedStartDate >= data.endDate) {
          adjustedStartDate = data.endDate;
          // Push end date by 1 day to ensure at least 1 night
          const newEnd = new Date(data.endDate);
          newEnd.setDate(newEnd.getDate() + 1);
          setEndDate(newEnd.toISOString().split('T')[0]);
        } else {
          setEndDate(data.endDate);
        }
      } else {
        setEndDate(data.endDate);
      }

      setStartDate(adjustedStartDate);
      setCheckInTime(adjustedCheckInTime);
      setCheckOutTime(defaultCheckOut);
      setStatus('pending');
      setCreateCleaning(data.cleaningFrequency === 'AFTER_EACH_STAY');
      setCleaningFee(data.cleaningBasePrice ? String(data.cleaningBasePrice) : '');
      setTouristTaxPerPerson('');
      setConfirmationCode(generateConfirmationCode());
      setGuestSearchQuery('');
      setSelectedGuest(null);
      setShowCreateGuestForm(false);
      setNewGuestFirstName('');
      setNewGuestLastName('');
      setNewGuestEmail('');
      setNewGuestPhone('');
      setPricingMode('custom');
      setPricingValue('');
      setGuestCount(2);
      setNotes('');
      setError(null);
    }
  }, [data, open, events]);

  // ── Conflict detection (reservations + interventions) ─────────────────
  const conflictWarnings = useMemo(() => {
    if (!data || !startDate || !endDate) return [];
    const warnings: string[] = [];

    // Combine date + time into a comparable timestamp
    const toTs = (date: string, time?: string) => time ? `${date} ${time}` : date;
    const newStart = toTs(startDate, checkInTime);
    const newEnd = toTs(endDate, checkOutTime);

    // Check events on the same property
    const samePropertyEvents = events.filter((e) => e.propertyId === data.propertyId);

    for (const evt of samePropertyEvents) {
      const evtStart = toTs(evt.startDate, evt.startTime);
      const evtEnd = toTs(evt.endDate, evt.endTime);

      // Overlap: newStart < evtEnd AND evtStart < newEnd
      if (newStart < evtEnd && evtStart < newEnd) {
        if (evt.type === 'reservation') {
          warnings.push(`Conflit avec la reservation de ${evt.label} (${evt.startDate} → ${evt.endDate})`);
        } else if (evt.type === 'cleaning') {
          warnings.push(`Conflit avec un menage prevu (${evt.startDate} ${evt.startTime || ''} → ${evt.endDate} ${evt.endTime || ''})`);
        } else if (evt.type === 'maintenance') {
          warnings.push(`Conflit avec une maintenance prevue (${evt.startDate} ${evt.startTime || ''} → ${evt.endDate} ${evt.endTime || ''})`);
        } else {
          warnings.push(`Conflit avec un blocage (${evt.startDate} → ${evt.endDate})`);
        }
      }
    }

    return warnings;
  }, [data, startDate, endDate, checkInTime, checkOutTime, events]);

  const hasConflict = conflictWarnings.length > 0;

  // ── Computed values ────────────────────────────────────────────────────
  const numberOfNights = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
  }, [startDate, endDate]);

  const baseNightlyPrice = data?.nightlyPrice ?? 0;

  const effectiveNightlyPrice = useMemo(() => {
    if (!pricingValue || isNaN(parseFloat(pricingValue))) return baseNightlyPrice;
    const val = parseFloat(pricingValue);
    switch (pricingMode) {
      case 'custom':
        return val;
      case 'discount_euro':
        return Math.max(0, baseNightlyPrice - val);
      case 'discount_percent':
        return Math.max(0, baseNightlyPrice * (1 - val / 100));
    }
  }, [pricingMode, pricingValue, baseNightlyPrice]);

  const cleaningFeeAmount = useMemo(() => {
    if (!createCleaning || !cleaningFee) return 0;
    return parseFloat(cleaningFee) || 0;
  }, [createCleaning, cleaningFee]);

  const touristTaxAmount = useMemo(() => {
    const rate = parseFloat(touristTaxPerPerson) || 0;
    return Math.round(rate * guestCount * numberOfNights * 100) / 100;
  }, [touristTaxPerPerson, guestCount, numberOfNights]);

  const accommodationTotal = useMemo(
    () => Math.round(effectiveNightlyPrice * numberOfNights * 100) / 100,
    [effectiveNightlyPrice, numberOfNights],
  );

  const totalPrice = useMemo(
    () => Math.round((accommodationTotal + cleaningFeeAmount + touristTaxAmount) * 100) / 100,
    [accommodationTotal, cleaningFeeAmount, touristTaxAmount],
  );

  // ── Guest search (debounced via staleTime) ─────────────────────────────
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(guestSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [guestSearchQuery]);

  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['guest-search', debouncedSearch],
    queryFn: () => guestsApi.search(debouncedSearch),
    enabled: debouncedSearch.length >= 2 && !selectedGuest,
    staleTime: 10_000,
  });

  // ── Guest create mutation ──────────────────────────────────────────────
  const createGuestMutation = useMutation({
    mutationFn: (guestData: CreateGuestData) => guestsApi.create(guestData),
    onSuccess: (guest) => {
      setSelectedGuest(guest);
      setShowCreateGuestForm(false);
      setNewGuestFirstName('');
      setNewGuestLastName('');
      setNewGuestEmail('');
      setNewGuestPhone('');
    },
  });

  const handleCreateGuest = useCallback(() => {
    if (!newGuestFirstName.trim() || !newGuestLastName.trim()) return;
    createGuestMutation.mutate({
      firstName: newGuestFirstName.trim(),
      lastName: newGuestLastName.trim(),
      email: newGuestEmail.trim() || undefined,
      phone: newGuestPhone.trim() || undefined,
    });
  }, [newGuestFirstName, newGuestLastName, newGuestEmail, newGuestPhone, createGuestMutation]);

  // ── Reservation create mutation ────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (createData: CreateReservationData) => reservationsApi.create(createData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planningKeys.all });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'Erreur lors de la creation');
    },
  });

  const handleSubmit = useCallback(() => {
    if (!data) return;
    if (!selectedGuest) {
      setError('Veuillez selectionner ou creer un voyageur');
      return;
    }
    if (!startDate || !endDate) {
      setError('Veuillez selectionner les dates');
      return;
    }
    if (hasConflict) {
      setError('Impossible de creer la reservation : conflit avec un evenement existant sur ce creneau');
      return;
    }

    setError(null);
    createMutation.mutate({
      propertyId: data.propertyId,
      guestName: selectedGuest.fullName,
      guestId: selectedGuest.id,
      guestCount,
      checkIn: startDate,
      checkOut: endDate,
      checkInTime,
      checkOutTime,
      status,
      totalPrice: totalPrice || undefined,
      cleaningFee: cleaningFeeAmount || undefined,
      touristTaxAmount: touristTaxAmount || undefined,
      confirmationCode: confirmationCode || undefined,
      createCleaning,
      notes: notes || undefined,
    });
  }, [data, selectedGuest, startDate, endDate, checkInTime, checkOutTime, status, guestCount, totalPrice, cleaningFeeAmount, touristTaxAmount, confirmationCode, createCleaning, notes, hasConflict, createMutation]);

  if (!data) return null;

  const pricingLabel =
    pricingMode === 'custom'
      ? 'Prix personnalise (EUR/nuit)'
      : pricingMode === 'discount_euro'
        ? 'Reduction (EUR)'
        : 'Reduction (%)';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          borderRadius: 2.5,
          width: 780,
          maxWidth: '95vw',
          maxHeight: '92vh',
        },
      }}
      slotProps={{
        backdrop: {
          sx: { backgroundColor: 'rgba(0,0,0,0.5)' },
        },
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 700 }}>
            Nouvelle reservation
          </Typography>
          <Chip
            label="Direct"
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 600, fontSize: '0.68rem', height: 22 }}
          />
          <ToggleButtonGroup
            value={status}
            exclusive
            onChange={(_, val) => { if (val) setStatus(val); }}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                fontSize: '0.65rem',
                fontWeight: 600,
                py: 0.25,
                px: 0.75,
                gap: 0.3,
                lineHeight: 1.2,
              },
            }}
          >
            <ToggleButton value="pending">
              <Schedule sx={{ fontSize: 13 }} />
              En attente
            </ToggleButton>
            <ToggleButton value="confirmed">
              <CheckCircle sx={{ fontSize: 13 }} />
              Confirmee
            </ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 0.5 }}>
            <Home sx={{ fontSize: 15, color: 'primary.main' }} />
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.84rem' }}>
              {data.propertyName}
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <Close sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1, pb: 2, px: 3 }}>
        {/* ═══════════════════════════════════════════════════════════════════
            TWO-COLUMN LAYOUT
            Left: Calendar + Times + Guest
            Right: Pricing + Cleaning + Tax + Code + Notes
        ═══════════════════════════════════════════════════════════════════ */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mt: 1 }}>

          {/* ── LEFT COLUMN ──────────────────────────────────────────────── */}
          <Box>
            {/* Dates */}
            <Typography sx={SECTION_LABEL_SX}>Dates du sejour</Typography>
            <MiniDateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChangeStart={setStartDate}
              onChangeEnd={setEndDate}
              isFrench
              startLabel="Arrivee"
              endLabel="Depart"
            />

            {/* Times + Nights — single row */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1, mb: 2 }}>
              <TextField
                label="Arrivee"
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                size="small"
                fullWidth
                InputProps={{
                  startAdornment: <AccessTime sx={{ fontSize: 14, color: 'text.secondary', mr: 0.5 }} />,
                }}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1, ...FIELD_SX }}
              />
              <TextField
                label="Depart"
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                size="small"
                fullWidth
                InputProps={{
                  startAdornment: <AccessTime sx={{ fontSize: 14, color: 'text.secondary', mr: 0.5 }} />,
                }}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1, ...FIELD_SX }}
              />
              {numberOfNights > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, whiteSpace: 'nowrap' }}>
                  <NightsStay sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ fontSize: '0.78rem', fontWeight: 700 }}>
                    {numberOfNights} nuit{numberOfNights > 1 ? 's' : ''}
                  </Typography>
                </Box>
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Guest */}
            <Typography sx={SECTION_LABEL_SX}>Voyageur</Typography>

            {selectedGuest ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Chip
                  icon={<Person sx={{ fontSize: 16 }} />}
                  label={selectedGuest.fullName}
                  onDelete={() => {
                    setSelectedGuest(null);
                    setGuestSearchQuery('');
                  }}
                  sx={{ fontWeight: 600, fontSize: '0.8rem' }}
                />
                {selectedGuest.email && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                    {selectedGuest.email}
                  </Typography>
                )}
              </Box>
            ) : (
              <Autocomplete
                freeSolo={false}
                options={searchResults}
                getOptionLabel={(option) => option.fullName}
                renderOption={(props, option) => (
                  <Box component="li" {...props} key={option.id}>
                    <Box>
                      <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.84rem' }}>
                        {option.fullName}
                      </Typography>
                      {option.email && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                          {option.email}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
                inputValue={guestSearchQuery}
                onInputChange={(_, val) => setGuestSearchQuery(val)}
                value={null}
                onChange={(_, val) => {
                  if (val) setSelectedGuest(val);
                }}
                loading={isSearching}
                noOptionsText={debouncedSearch.length >= 2 ? 'Aucun voyageur trouve' : 'Tapez au moins 2 caracteres'}
                size="small"
                sx={{ mb: 0.5 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Rechercher un voyageur"
                    placeholder="Nom ou prenom..."
                    sx={FIELD_SX}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {isSearching ? <CircularProgress size={16} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            )}

            {/* Create guest link + form */}
            {!selectedGuest && (
              <>
                <Button
                  size="small"
                  startIcon={<PersonAdd sx={{ fontSize: 14 }} />}
                  onClick={() => setShowCreateGuestForm(!showCreateGuestForm)}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'primary.main',
                    mb: 0.5,
                    px: 0.5,
                  }}
                >
                  {showCreateGuestForm ? 'Annuler' : 'Creer une fiche client'}
                </Button>

                <Collapse in={showCreateGuestForm}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.02),
                      mb: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <TextField
                        label="Prenom"
                        value={newGuestFirstName}
                        onChange={(e) => setNewGuestFirstName(e.target.value)}
                        size="small"
                        required
                        InputLabelProps={{ shrink: true }}
                        sx={{ flex: 1, ...FIELD_SX }}
                      />
                      <TextField
                        label="Nom"
                        value={newGuestLastName}
                        onChange={(e) => setNewGuestLastName(e.target.value)}
                        size="small"
                        required
                        InputLabelProps={{ shrink: true }}
                        sx={{ flex: 1, ...FIELD_SX }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <TextField
                        label="Email"
                        type="email"
                        value={newGuestEmail}
                        onChange={(e) => setNewGuestEmail(e.target.value)}
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        sx={{ flex: 1, ...FIELD_SX }}
                      />
                      <TextField
                        label="Telephone"
                        value={newGuestPhone}
                        onChange={(e) => setNewGuestPhone(e.target.value)}
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        sx={{ flex: 1, ...FIELD_SX }}
                      />
                    </Box>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleCreateGuest}
                      disabled={!newGuestFirstName.trim() || !newGuestLastName.trim() || createGuestMutation.isPending}
                      sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600, height: 30 }}
                    >
                      {createGuestMutation.isPending ? <CircularProgress size={16} /> : 'Creer le voyageur'}
                    </Button>
                    {createGuestMutation.isError && (
                      <Typography color="error" variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                        Erreur lors de la creation
                      </Typography>
                    )}
                  </Box>
                </Collapse>
              </>
            )}

            {/* Guest count */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
              <GroupIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 600, mr: 0.5 }}>
                Voyageurs
              </Typography>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <IconButton
                  size="small"
                  onClick={() => setGuestCount((c) => Math.max(1, c - 1))}
                  disabled={guestCount <= 1}
                  sx={{
                    borderRadius: 0,
                    width: 30,
                    height: 30,
                    '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.08) },
                  }}
                >
                  <RemoveIcon sx={{ fontSize: 15 }} />
                </IconButton>
                <Typography
                  sx={{
                    minWidth: 32,
                    textAlign: 'center',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    userSelect: 'none',
                    lineHeight: '30px',
                    borderLeft: '1px solid',
                    borderRight: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {guestCount}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setGuestCount((c) => Math.min(20, c + 1))}
                  disabled={guestCount >= 20}
                  sx={{
                    borderRadius: 0,
                    width: 30,
                    height: 30,
                    '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.08) },
                  }}
                >
                  <AddIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Box>
            </Box>
          </Box>

          {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
            {/* ── Tarification ─────────────────────────────────────────── */}
            <Typography sx={SECTION_LABEL_SX}>Tarification</Typography>

            {/* Base + Mode row */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <TextField
                label="Base (EUR/nuit)"
                value={baseNightlyPrice > 0 ? baseNightlyPrice : ''}
                size="small"
                fullWidth
                disabled
                InputProps={{
                  startAdornment: <Euro sx={{ fontSize: 14, color: 'text.secondary', mr: 0.5 }} />,
                }}
                InputLabelProps={{ shrink: true }}
                sx={FIELD_SX}
              />
              <TextField
                label={pricingLabel}
                type="number"
                value={pricingValue}
                onChange={(e) => setPricingValue(e.target.value)}
                size="small"
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
                InputLabelProps={{ shrink: true }}
                sx={FIELD_SX}
              />
            </Box>

            {/* Pricing mode toggles */}
            <ToggleButtonGroup
              value={pricingMode}
              exclusive
              onChange={(_, val) => {
                if (val) {
                  setPricingMode(val);
                  setPricingValue('');
                }
              }}
              size="small"
              fullWidth
              sx={{
                '& .MuiToggleButton-root': {
                  textTransform: 'none',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  py: 0.35,
                  gap: 0.4,
                },
              }}
            >
              <ToggleButton value="custom">
                <EditIcon sx={{ fontSize: 12 }} />
                Personnalise
              </ToggleButton>
              <ToggleButton value="discount_euro">
                <Euro sx={{ fontSize: 12 }} />
                Reduction EUR
              </ToggleButton>
              <ToggleButton value="discount_percent">
                <Percent sx={{ fontSize: 12 }} />
                Reduction %
              </ToggleButton>
            </ToggleButtonGroup>

            {/* Price summary */}
            {numberOfNights > 0 && (
              <Box
                sx={{
                  p: 1.25,
                  borderRadius: 1.5,
                  bgcolor: (theme) => alpha(theme.palette.success.main, 0.06),
                  border: '1px solid',
                  borderColor: (theme) => alpha(theme.palette.success.main, 0.18),
                }}
              >
                <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  {numberOfNights} nuit{numberOfNights > 1 ? 's' : ''} x {effectiveNightlyPrice.toFixed(2)} EUR = {accommodationTotal.toFixed(2)} EUR
                </Typography>
                {cleaningFeeAmount > 0 && (
                  <Typography variant="body2" sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                    + Menage : {cleaningFeeAmount.toFixed(2)} EUR
                  </Typography>
                )}
                {touristTaxAmount > 0 && (
                  <Typography variant="body2" sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                    + Taxe de sejour : {touristTaxAmount.toFixed(2)} EUR
                  </Typography>
                )}
                <Divider sx={{ my: 0.5 }} />
                <Typography component="div" sx={{ fontSize: '0.88rem', fontWeight: 700, color: 'success.dark' }}>
                  Total : {totalPrice.toFixed(2)} EUR
                </Typography>
              </Box>
            )}

            <Divider />

            {/* ── Menage ───────────────────────────────────────────────── */}
            <FormControlLabel
              control={
                <Switch
                  checked={createCleaning}
                  onChange={(e) => setCreateCleaning(e.target.checked)}
                  size="small"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CleaningServices sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    Menage au depart
                  </Typography>
                </Box>
              }
              sx={{ ml: 0, mr: 0 }}
            />
            <Collapse in={createCleaning}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {data.cleaningBasePrice != null && data.cleaningBasePrice > 0 && (
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', fontStyle: 'italic' }}>
                    Montant estime du logement : {data.cleaningBasePrice.toFixed(2)} EUR
                  </Typography>
                )}
                <TextField
                  label="Frais de menage (EUR)"
                  type="number"
                  value={cleaningFee}
                  onChange={(e) => setCleaningFee(e.target.value)}
                  size="small"
                  fullWidth
                  inputProps={{ min: 0, step: 0.01 }}
                  InputProps={{
                    startAdornment: <CleaningServices sx={{ fontSize: 14, color: 'text.secondary', mr: 0.5 }} />,
                  }}
                  InputLabelProps={{ shrink: true }}
                  placeholder={data.cleaningBasePrice ? String(data.cleaningBasePrice) : ''}
                  sx={FIELD_SX}
                />
              </Box>
            </Collapse>

            {/* ── Taxe de sejour ────────────────────────────────────────── */}
            <TextField
              label="Taxe de sejour / pers. / nuit (EUR)"
              type="number"
              value={touristTaxPerPerson}
              onChange={(e) => setTouristTaxPerPerson(e.target.value)}
              size="small"
              fullWidth
              inputProps={{ min: 0, step: 0.01 }}
              InputProps={{
                startAdornment: <AccountBalance sx={{ fontSize: 14, color: 'text.secondary', mr: 0.5 }} />,
                endAdornment: touristTaxAmount > 0 ? (
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap', color: 'text.secondary' }}>
                    = {touristTaxAmount.toFixed(2)} EUR
                  </Typography>
                ) : undefined,
              }}
              InputLabelProps={{ shrink: true }}
              sx={FIELD_SX}
            />

            <Divider />

            {/* ── Code + Notes ──────────────────────────────────────────── */}
            <TextField
              label="Code de confirmation"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: <ConfirmationNumber sx={{ fontSize: 14, color: 'text.secondary', mr: 0.5 }} />,
              }}
              InputLabelProps={{ shrink: true }}
              sx={FIELD_SX}
            />

            <TextField
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
              size="small"
              multiline
              rows={2}
              InputLabelProps={{ shrink: true }}
              sx={FIELD_SX}
            />
          </Box>
        </Box>

        {/* Conflict warnings */}
        {hasConflict && (
          <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1.5, backgroundColor: (theme) => alpha(theme.palette.warning.main, 0.1), border: '1px solid', borderColor: 'warning.main' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
              <WarningIcon sx={{ fontSize: 16, color: 'warning.main' }} />
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'warning.main' }}>
                Conflit detecte
              </Typography>
            </Box>
            {conflictWarnings.map((w, i) => (
              <Typography key={i} sx={{ fontSize: '0.7rem', color: 'text.secondary', pl: 2.75 }}>
                {w}
              </Typography>
            ))}
          </Box>
        )}

        {/* Error message */}
        {error && (
          <Typography color="error" variant="caption" sx={{ mt: 1, display: 'block', fontSize: '0.75rem' }}>
            {error}
          </Typography>
        )}
      </DialogContent>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', fontSize: '0.8rem' }}>
          Annuler
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={createMutation.isPending || !selectedGuest || !startDate || !endDate || hasConflict}
          sx={{ textTransform: 'none', fontSize: '0.8rem', fontWeight: 600, px: 3 }}
        >
          {createMutation.isPending ? 'Creation...' : 'Creer la reservation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlanningQuickCreateDialog;

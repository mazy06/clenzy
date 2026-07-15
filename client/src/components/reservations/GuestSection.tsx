import React from 'react';
import { Box, Typography, TextField, MenuItem, Chip, Autocomplete, CircularProgress } from '@mui/material';
import { Person, PersonOutline, Search as SearchIcon, Group as GroupIcon, Remove as RemoveIcon, Add as AddIcon } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { UseReservationFormResult } from './useReservationForm';
import { SEC_SX, COMPACT_FIELD_SX, COMPACT_TEXTAREA_SX, STEP_BTN_SX, AdornIcon } from './reservationDialogStyles';

interface Props {
  form: UseReservationFormResult;
}

// Pays courants (ISO 3166-1 alpha-2) pour la nationalité — liste courte et éditable.
const COUNTRY_OPTIONS = ['FR', 'GB', 'US', 'DE', 'ES', 'IT', 'MA', 'BE', 'CH', 'NL', 'PT', 'CA'];
// Langues supportées pour la communication voyageur.
const LANGUAGE_OPTIONS = ['fr', 'en', 'ar', 'es', 'de', 'it'];

/**
 * Voyageur.
 * - Création : recherche d'un voyageur existant (préremplit) + champs TOUJOURS éditables.
 *   Aucun bouton « Créer la fiche » : la persistance (upsert create/update) se fait au submit.
 * - Édition d'une réservation : comportement inchangé — infos du voyageur en lecture seule.
 */
const GuestSection: React.FC<Props> = ({ form }) => {
  const { t } = useTranslation();

  // Stepper -/valeur/+ cohérent (voyageurs et enfants).
  const renderStepper = (
    value: number,
    onDec: () => void,
    onInc: () => void,
    decDisabled: boolean,
    incDisabled: boolean,
    ariaLabel: string,
  ) => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: 'var(--field)',
        border: '1px solid var(--field-line)',
        borderRadius: '10px',
        padding: '3px',
        flexShrink: 0,
      }}
    >
      <Box component="button" type="button" aria-label={`${ariaLabel} −`} onClick={onDec} disabled={decDisabled} sx={STEP_BTN_SX}>
        <RemoveIcon size={15} strokeWidth={1.75} />
      </Box>
      <Box
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--ink)',
          minWidth: 28,
          textAlign: 'center',
          userSelect: 'none',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Box>
      <Box component="button" type="button" aria-label={`${ariaLabel} +`} onClick={onInc} disabled={incDisabled} sx={STEP_BTN_SX}>
        <AddIcon size={15} strokeWidth={1.75} />
      </Box>
    </Box>
  );

  // Champ en lecture seule (infos d'un voyageur — édition de réservation uniquement).
  const roField = (label: string, value?: string | null, multiline = false) => (
    <TextField
      label={label}
      value={value || '—'}
      disabled
      fullWidth
      multiline={multiline}
      minRows={multiline ? 2 : undefined}
      InputLabelProps={{ shrink: true }}
      sx={multiline ? COMPACT_TEXTAREA_SX : COMPACT_FIELD_SX}
    />
  );

  const guestChip = (
    <Chip
      icon={<Person size={15} strokeWidth={1.75} />}
      label={form.selectedGuest?.fullName}
      onDelete={form.fieldsLocked ? undefined : form.clearGuest}
      sx={{
        height: 32,
        borderRadius: '10px',
        backgroundColor: 'var(--accent-soft)',
        color: 'var(--ink)',
        fontWeight: 600,
        fontSize: '12.5px',
        '& .MuiChip-icon': { color: 'var(--accent)' },
        '& .MuiChip-deleteIcon': { color: 'var(--accent)', '&:hover': { color: 'var(--accent-deep)' } },
      }}
    />
  );

  const searchField = (
    <Autocomplete
      freeSolo={false}
      options={form.searchResults}
      getOptionLabel={(option) => option.fullName}
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        return (
          <Box component="li" key={key} {...optionProps}>
            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{option.fullName}</Typography>
              {option.email && <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)' }}>{option.email}</Typography>}
            </Box>
          </Box>
        );
      }}
      inputValue={form.guestSearchQuery}
      onInputChange={(_, val) => form.setGuestSearchQuery(val)}
      value={null}
      onChange={(_, val) => { if (val) form.setSelectedGuest(val); }}
      loading={form.isSearching}
      noOptionsText={form.debouncedSearch.length >= 2 ? t('reservations.dialog.noGuestFound') : t('reservations.dialog.typeToSearch')}
      slotProps={{
        paper: {
          sx: {
            borderRadius: '12px',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow-pop)',
            backgroundColor: 'var(--card)',
            backgroundImage: 'none',
          },
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={t('reservations.dialog.searchGuest')}
          sx={[
            COMPACT_FIELD_SX,
            {
              '& .MuiOutlinedInput-root': { padding: '0 39px 0 11px' },
              '& .MuiOutlinedInput-root .MuiAutocomplete-input': { padding: '0 0 0 8px', height: 36, fontWeight: 500 },
            },
          ]}
          InputProps={{
            ...params.InputProps,
            startAdornment: <AdornIcon><SearchIcon size={15} strokeWidth={1.75} /></AdornIcon>,
            endAdornment: (
              <>
                {form.isSearching ? <CircularProgress size={16} sx={{ color: 'var(--accent)' }} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );

  // Formulaire voyageur ÉDITABLE (création) — champs newGuest*, persistés au submit.
  const editableGuestForm = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
        <Typography sx={{ ...SEC_SX, whiteSpace: 'nowrap' }}>
          {form.selectedGuest ? t('reservations.dialog.editGuest') : t('reservations.dialog.newGuest')}
        </Typography>
        <Box sx={{ flex: 1, height: '1px', backgroundColor: 'var(--line)' }} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <TextField
          label={t('reservations.dialog.firstName')}
          value={form.newGuestFirstName}
          onChange={(e) => form.setNewGuestFirstName(e.target.value)}
          required
          InputLabelProps={{ shrink: true }}
          sx={COMPACT_FIELD_SX}
        />
        <TextField
          label={t('reservations.dialog.lastName')}
          value={form.newGuestLastName}
          onChange={(e) => form.setNewGuestLastName(e.target.value)}
          required
          InputLabelProps={{ shrink: true }}
          sx={COMPACT_FIELD_SX}
        />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <TextField
          label={t('reservations.fields.guestEmail')}
          type="email"
          value={form.newGuestEmail}
          onChange={(e) => form.setNewGuestEmail(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={COMPACT_FIELD_SX}
        />
        <TextField
          label={t('reservations.fields.guestPhone')}
          value={form.newGuestPhone}
          onChange={(e) => form.setNewGuestPhone(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={COMPACT_FIELD_SX}
        />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <TextField
          select
          label={t('reservations.dialog.nationality')}
          value={form.newGuestCountry}
          onChange={(e) => form.setNewGuestCountry(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={COMPACT_FIELD_SX}
          SelectProps={{ displayEmpty: true }}
        >
          <MenuItem value="">—</MenuItem>
          {COUNTRY_OPTIONS.map((c) => (
            <MenuItem key={c} value={c}>{c}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label={t('reservations.dialog.language')}
          value={form.newGuestLanguage}
          onChange={(e) => form.setNewGuestLanguage(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={COMPACT_FIELD_SX}
        >
          {LANGUAGE_OPTIONS.map((l) => (
            <MenuItem key={l} value={l}>{l.toUpperCase()}</MenuItem>
          ))}
        </TextField>
      </Box>
      <TextField
        label={t('reservations.dialog.guestNotes')}
        value={form.newGuestNotes}
        onChange={(e) => form.setNewGuestNotes(e.target.value)}
        fullWidth
        multiline
        minRows={1}
        placeholder={t('reservations.dialog.notesPlaceholder')}
        InputLabelProps={{ shrink: true }}
        sx={COMPACT_TEXTAREA_SX}
      />
    </Box>
  );

  return (
    <>
      <Typography sx={{ ...SEC_SX, marginTop: '4px' }}>{t('reservations.dialog.traveler')}</Typography>

      {form.isEdit ? (
        // ── ÉDITION : comportement inchangé — voyageur en lecture seule ──
        form.selectedGuest && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              {guestChip}
              {form.selectedGuest.email && (
                <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {form.selectedGuest.email}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {roField(t('reservations.dialog.firstName'), form.selectedGuest.firstName)}
                {roField(t('reservations.dialog.lastName'), form.selectedGuest.lastName)}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {roField(t('reservations.fields.guestEmail'), form.selectedGuest.email)}
                {roField(t('reservations.fields.guestPhone'), form.selectedGuest.phone)}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {roField(t('reservations.dialog.nationality'), form.selectedGuest.countryCode)}
                {roField(t('reservations.dialog.language'), form.selectedGuest.language)}
              </Box>
              {form.selectedGuest.notes && roField(t('reservations.dialog.guestNotes'), form.selectedGuest.notes, true)}
            </Box>
          </Box>
        )
      ) : (
        // ── CRÉATION : recherche/chip + champs toujours éditables ──
        <>
          {form.selectedGuest ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>{guestChip}</Box>
          ) : (
            searchField
          )}
          {editableGuestForm}
        </>
      )}

      {/* Occupation — voyageurs + dont enfants, regroupés (steppers cohérents). */}
      <Box sx={{ border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--card)' }}>
        {/* Voyageurs */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px' }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', flexShrink: 0 }}>
            <GroupIcon size={18} strokeWidth={1.75} />
          </Box>
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)' }}>
            {t('reservations.dialog.travelers')}
          </Typography>
          {renderStepper(
            form.guestCount,
            () => form.setGuestCount((c) => Math.max(1, c - 1)),
            () => form.setGuestCount((c) => Math.min(20, c + 1)),
            form.guestCount <= 1 || form.fieldsLocked,
            form.guestCount >= 20 || form.fieldsLocked,
            t('reservations.dialog.travelers'),
          )}
        </Box>

        <Box sx={{ height: '1px', backgroundColor: 'var(--line)' }} />

        {/* dont enfants (mineurs) — exonérés de la taxe de séjour */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px' }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', flexShrink: 0 }}>
            <PersonOutline size={18} strokeWidth={1.75} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
              {t('reservations.fields.childrenCount')}
            </Typography>
            <Typography sx={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.3 }}>
              {t('reservations.fields.childrenCountHelp')}
            </Typography>
          </Box>
          {renderStepper(
            form.childrenCount,
            () => form.setChildrenCount(Math.max(0, form.childrenCount - 1)),
            () => form.setChildrenCount(Math.min(form.guestCount, form.childrenCount + 1)),
            form.childrenCount <= 0 || form.fieldsLocked,
            form.childrenCount >= form.guestCount || form.fieldsLocked,
            t('reservations.fields.childrenCount'),
          )}
        </Box>
      </Box>
    </>
  );
};

export default GuestSection;

import React from 'react';
import { Spinner } from '../ui';
import { Box, Typography, TextField, MenuItem, Autocomplete } from '@mui/material';
import StatusChip from '../StatusChip';
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
    <div className="font-[var(--font-display)] text-[15px] font-semibold text-[var(--ink)] min-w-[28px] text-center select-none tabular-nums">
      {value}
    </div>
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

/**
 * Voyageur.
 * - Création : recherche d'un voyageur existant (préremplit) + champs TOUJOURS éditables.
 *   Aucun bouton « Créer la fiche » : la persistance (upsert create/update) se fait au submit.
 * - Édition d'une réservation : comportement inchangé — infos du voyageur en lecture seule.
 */
const GuestSection: React.FC<Props> = ({ form }) => {
  const { t } = useTranslation();

  // Gabarit plus haut que la puce de statut : ici la puce porte une identite
  // (le voyageur choisi), pas un etat — d'ou l'encre `--ink` et l'accent reserve
  // aux deux affordances (icone, croix).
  const guestChip = (
    <StatusChip
      icon={<Person size={15} strokeWidth={1.75} />}
      label={form.selectedGuest?.fullName}
      onDelete={form.fieldsLocked ? undefined : form.clearGuest}
      tokens={{ color: 'var(--ink)', bg: 'var(--accent-soft)' }}
      className="h-8 rounded-[10px] text-[12.5px] [&>svg]:text-[var(--accent)] [&>button>svg]:text-[var(--accent)]"
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
            <div>
              <p className="cn-text-body1 text-[13px] font-semibold text-[var(--ink)]">{option.fullName}</p>
              {option.email && <p className="cn-text-body1 text-[11.5px] text-[var(--muted)]">{option.email}</p>}
            </div>
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
                {form.isSearching ? <Spinner className="size-4 text-[var(--accent)]" /> : null}
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
    <div className="flex flex-col gap-2.5">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
        <Typography sx={{ ...SEC_SX, whiteSpace: 'nowrap' }}>
          {form.selectedGuest ? t('reservations.dialog.editGuest') : t('reservations.dialog.newGuest')}
        </Typography>
        <div className="flex-1 h-[1px] bg-[var(--line)]" />
      </Box>

      <div className="grid grid-cols-[1fr_1fr] gap-2.5">
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
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-2.5">
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
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-2.5">
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
      </div>
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
    </div>
  );

  return (
    <>
      <Typography sx={{ ...SEC_SX, marginTop: '4px' }}>{t('reservations.dialog.traveler')}</Typography>

      {form.isEdit ? (
        // ── ÉDITION : comportement inchangé — voyageur en lecture seule ──
        form.selectedGuest && (
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {guestChip}
              {form.selectedGuest.email && (
                <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] overflow-hidden text-ellipsis whitespace-nowrap">
                  {form.selectedGuest.email}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3.5">
              <div className="grid grid-cols-[1fr_1fr] gap-3">
                {roField(t('reservations.dialog.firstName'), form.selectedGuest.firstName)}
                {roField(t('reservations.dialog.lastName'), form.selectedGuest.lastName)}
              </div>
              <div className="grid grid-cols-[1fr_1fr] gap-3">
                {roField(t('reservations.fields.guestEmail'), form.selectedGuest.email)}
                {roField(t('reservations.fields.guestPhone'), form.selectedGuest.phone)}
              </div>
              <div className="grid grid-cols-[1fr_1fr] gap-3">
                {roField(t('reservations.dialog.nationality'), form.selectedGuest.countryCode)}
                {roField(t('reservations.dialog.language'), form.selectedGuest.language)}
              </div>
              {form.selectedGuest.notes && roField(t('reservations.dialog.guestNotes'), form.selectedGuest.notes, true)}
            </div>
          </div>
        )
      ) : (
        // ── CRÉATION : recherche/chip + champs toujours éditables ──
        <>
          {form.selectedGuest ? (
            <div className="flex items-center gap-2.5 min-w-0">{guestChip}</div>
          ) : (
            searchField
          )}
          {editableGuestForm}
        </>
      )}

      {/* Occupation — voyageurs + dont enfants, regroupés (steppers cohérents). */}
      <div className="border border-[var(--line)] rounded-[12px] overflow-hidden bg-[var(--card)]">
        {/* Voyageurs */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px' }}>
          <span className="inline-flex text-[var(--accent)] shrink-0">
            <GroupIcon size={18} strokeWidth={1.75} />
          </span>
          <p className="cn-text-body1 flex-1 min-w-0 text-[13.5px] font-semibold text-[var(--ink)]">
            {t('reservations.dialog.travelers')}
          </p>
          {renderStepper(
            form.guestCount,
            () => form.setGuestCount((c) => Math.max(1, c - 1)),
            () => form.setGuestCount((c) => Math.min(20, c + 1)),
            form.guestCount <= 1 || form.fieldsLocked,
            form.guestCount >= 20 || form.fieldsLocked,
            t('reservations.dialog.travelers'),
          )}
        </Box>

        <div className="h-[1px] bg-[var(--line)]" />

        {/* dont enfants (mineurs) — exonérés de la taxe de séjour */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px' }}>
          <span className="inline-flex text-[var(--accent)] shrink-0">
            <PersonOutline size={18} strokeWidth={1.75} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="cn-text-body1 text-[13.5px] font-semibold text-[var(--ink)] leading-[1.3]">
              {t('reservations.fields.childrenCount')}
            </p>
            <p className="cn-text-body1 text-[11px] text-[var(--muted)] leading-[1.3]">
              {t('reservations.fields.childrenCountHelp')}
            </p>
          </div>
          {renderStepper(
            form.childrenCount,
            () => form.setChildrenCount(Math.max(0, form.childrenCount - 1)),
            () => form.setChildrenCount(Math.min(form.guestCount, form.childrenCount + 1)),
            form.childrenCount <= 0 || form.fieldsLocked,
            form.childrenCount >= form.guestCount || form.fieldsLocked,
            t('reservations.fields.childrenCount'),
          )}
        </Box>
      </div>
    </>
  );
};

export default GuestSection;
